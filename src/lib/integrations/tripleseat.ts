// ── Tripleseat Connector ──
// Auth:    API key + secret (Basic auth: key=username, secret=password)
// Pulls:   Private event bookings, headcounts, event dates
// Maps to: ForecastInputs.events[]
// Docs:    https://api.tripleseat.com/v1
//
// SECURITY: credentials loaded exclusively from env vars (CLAUDE.md §1)
// NOTE: Direct browser calls may require a CORS proxy in production.

import { EventData, DayOfWeek } from '@/lib/types';
import {
  IntegrationError,
  fetchWithRetry,
  toISODateString,
  daysAgo,
  JS_DAY_TO_DOW,
} from './http';
import {
  TripleseatEvent,
  TripleseatLead,
  TripleseatEventsResponse,
  TripleseatLeadsResponse,
  ConnectionTestResult,
  SyncResult,
} from './types';

const BASE_URL = 'https://api.tripleseat.com/v1';
const PLATFORM = 'tripleseat' as const;

// ── Config ──

function getConfig() {
  const apiKey = import.meta.env.VITE_TRIPLESEAT_API_KEY as string | undefined;
  const secret = import.meta.env.VITE_TRIPLESEAT_SECRET as string | undefined;

  if (!apiKey || !secret) {
    throw new IntegrationError(
      PLATFORM,
      null,
      'Missing Tripleseat credentials. Set VITE_TRIPLESEAT_API_KEY and VITE_TRIPLESEAT_SECRET in .env',
    );
  }

  return { apiKey, secret };
}

/** Tripleseat uses HTTP Basic auth: base64(apiKey:secret) */
function basicAuthHeaders(apiKey: string, secret: string): RequestInit {
  const encoded = btoa(`${apiKey}:${secret}`);
  return {
    method: 'GET',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
}

// ── Data fetching ──

async function fetchEvents(
  apiKey: string,
  secret: string,
  from: Date,
  to: Date,
  page = 1,
): Promise<TripleseatEvent[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    start_date: toISODateString(from),
    end_date: toISODateString(to),
    page: String(page),
    per_page: '100',
  });

  const url = `${BASE_URL}/events.json?${params.toString()}`;
  const response = await fetchWithRetry<TripleseatEventsResponse>(
    url,
    basicAuthHeaders(apiKey, secret),
    PLATFORM,
  );

  const events = response.events ?? [];

  // Auto-paginate if full page returned
  if (events.length === 100) {
    const nextPage = await fetchEvents(apiKey, secret, from, to, page + 1);
    return [...events, ...nextPage];
  }

  return events;
}

async function fetchLeads(
  apiKey: string,
  secret: string,
  from: Date,
  to: Date,
  page = 1,
): Promise<TripleseatLead[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    start_date: toISODateString(from),
    end_date: toISODateString(to),
    page: String(page),
    per_page: '100',
  });

  const url = `${BASE_URL}/leads.json?${params.toString()}`;
  const response = await fetchWithRetry<TripleseatLeadsResponse>(
    url,
    basicAuthHeaders(apiKey, secret),
    PLATFORM,
  );

  const leads = response.leads ?? [];

  if (leads.length === 100) {
    const nextPage = await fetchLeads(apiKey, secret, from, to, page + 1);
    return [...leads, ...nextPage];
  }

  return leads;
}

// ── Normalization ──

const EXCLUDED_STATUSES = new Set([
  'cancelled', 'CANCELLED', 'Cancelled',
  'lost', 'LOST', 'Lost',
  'tentative', 'TENTATIVE', 'Tentative', // optionally include — adjust per business needs
]);

function dateToDayOfWeek(dateStr: string): DayOfWeek {
  const d = new Date(`${dateStr}T00:00:00`);
  return JS_DAY_TO_DOW[d.getDay()];
}

/**
 * Map Tripleseat events + leads to EventData[].
 * Excludes cancelled/lost records.
 */
function normalizeToEvents(
  events: TripleseatEvent[],
  leads: TripleseatLead[],
): EventData[] {
  const result: EventData[] = [];

  for (const evt of events) {
    if (!evt.event_date) continue;
    if (EXCLUDED_STATUSES.has(evt.status)) continue;

    result.push({
      day: dateToDayOfWeek(evt.event_date),
      eventType: evt.event_type ?? 'private_event',
      expectedAttendance: evt.guest_count ?? 0,
    });
  }

  for (const lead of leads) {
    if (!lead.event_date) continue;
    if (EXCLUDED_STATUSES.has(lead.status)) continue;

    result.push({
      day: dateToDayOfWeek(lead.event_date),
      eventType: 'lead_event',
      expectedAttendance: lead.guest_count ?? 0,
    });
  }

  return result;
}

// ── Public API ──

/**
 * Verify Tripleseat credentials by fetching a single page of events.
 */
export async function testConnection(): Promise<ConnectionTestResult> {
  const start = Date.now();
  try {
    const { apiKey, secret } = getConfig();
    const today = new Date();
    await fetchEvents(apiKey, secret, today, today);
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Pull event and lead data for a date range and normalize to EventData[].
 *
 * @param lookbackDays  Days of history (default 28)
 * @param lookaheadDays Days of future bookings to include (default 30)
 */
export async function fetchEventData(
  lookbackDays = 28,
  lookaheadDays = 30,
): Promise<{
  events: EventData[];
  rawEvents: TripleseatEvent[];
  rawLeads: TripleseatLead[];
}> {
  const { apiKey, secret } = getConfig();

  const from = daysAgo(lookbackDays);
  const to = new Date();
  to.setDate(to.getDate() + lookaheadDays);

  const [rawEvents, rawLeads] = await Promise.all([
    fetchEvents(apiKey, secret, from, to),
    fetchLeads(apiKey, secret, from, to),
  ]);

  const events = normalizeToEvents(rawEvents, rawLeads);

  return { events, rawEvents, rawLeads };
}

/**
 * Run the full Tripleseat sync. Callers (index.ts) handle writing to Supabase.
 */
export async function sync(): Promise<{
  result: SyncResult;
  events: EventData[];
  rawEvents: TripleseatEvent[];
  rawLeads: TripleseatLead[];
}> {
  const errors: string[] = [];
  let events: EventData[] = [];
  let rawEvents: TripleseatEvent[] = [];
  let rawLeads: TripleseatLead[] = [];

  try {
    ({ events, rawEvents, rawLeads } = await fetchEventData());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  return {
    result: {
      platform: PLATFORM,
      status: errors.length === 0 ? 'success' : events.length > 0 ? 'partial' : 'error',
      recordsSynced: events.length,
      errors,
      syncedAt: new Date().toISOString(),
    },
    events,
    rawEvents,
    rawLeads,
  };
}
