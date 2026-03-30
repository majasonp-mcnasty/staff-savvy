// ── SevenRooms Connector ──
// Auth:    API key (header: X-Api-Key)
// Pulls:   Reservation counts, covers, event bookings
// Maps to: ForecastInputs.events[]
// Docs:    https://api.sevenrooms.com/2_4
//
// SECURITY: credentials loaded exclusively from env vars (CLAUDE.md §1)
// NOTE: Direct browser calls may require a CORS proxy in production.

import { EventData, DayOfWeek } from '@/lib/types';
import {
  IntegrationError,
  fetchWithRetry,
  apiKeyHeaders,
  toISODateString,
  daysAgo,
  JS_DAY_TO_DOW,
} from './http';
import {
  SevenRoomsReservation,
  SevenRoomsExperience,
  SevenRoomsReservationsResponse,
  SevenRoomsExperiencesResponse,
  ConnectionTestResult,
  SyncResult,
} from './types';

const BASE_URL = 'https://api.sevenrooms.com/2_4';
const PLATFORM = 'sevenrooms' as const;

// ── Config ──

function getConfig() {
  const apiKey = import.meta.env.VITE_SEVENROOMS_API_KEY as string | undefined;
  const venueId = import.meta.env.VITE_SEVENROOMS_VENUE_ID as string | undefined;

  if (!apiKey || !venueId) {
    throw new IntegrationError(
      PLATFORM,
      null,
      'Missing SevenRooms credentials. Set VITE_SEVENROOMS_API_KEY and VITE_SEVENROOMS_VENUE_ID in .env',
    );
  }

  return { apiKey, venueId };
}

// ── Data fetching ──

async function fetchReservations(
  apiKey: string,
  venueId: string,
  from: Date,
  to: Date,
): Promise<SevenRoomsReservation[]> {
  const params = new URLSearchParams({
    venue_id: venueId,
    date_from: toISODateString(from),
    date_to: toISODateString(to),
    limit: '500',
  });

  const url = `${BASE_URL}/reservations?${params.toString()}`;
  const response = await fetchWithRetry<SevenRoomsReservationsResponse>(
    url,
    apiKeyHeaders(apiKey, 'X-Api-Key'),
    PLATFORM,
  );

  return response.data?.results ?? [];
}

async function fetchExperiences(
  apiKey: string,
  venueId: string,
  from: Date,
  to: Date,
): Promise<SevenRoomsExperience[]> {
  const params = new URLSearchParams({
    venue_id: venueId,
    date_from: toISODateString(from),
    date_to: toISODateString(to),
    limit: '200',
  });

  const url = `${BASE_URL}/experiences?${params.toString()}`;
  const response = await fetchWithRetry<SevenRoomsExperiencesResponse>(
    url,
    apiKeyHeaders(apiKey, 'X-Api-Key'),
    PLATFORM,
  );

  return response.data?.results ?? [];
}

// ── Normalization ──

/** Parse YYYY-MM-DD → DayOfWeek */
function dateToDayOfWeek(dateStr: string): DayOfWeek {
  // Append T00:00:00 to parse in local time rather than UTC
  const d = new Date(`${dateStr}T00:00:00`);
  return JS_DAY_TO_DOW[d.getDay()];
}

/**
 * Merge reservations and experiences into EventData[].
 * Each row = one occurrence on a specific day-of-week.
 */
function normalizeToEvents(
  reservations: SevenRoomsReservation[],
  experiences: SevenRoomsExperience[],
): EventData[] {
  const events: EventData[] = [];

  for (const res of reservations) {
    if (!res.date) continue;
    // Exclude cancelled/no-show reservations
    if (['cancelled', 'no_show', 'CANCELLED', 'NO_SHOW'].includes(res.status)) continue;

    events.push({
      day: dateToDayOfWeek(res.date),
      eventType: res.type ?? 'reservation',
      expectedAttendance: res.party_size ?? 1,
    });
  }

  for (const exp of experiences) {
    if (!exp.date) continue;

    events.push({
      day: dateToDayOfWeek(exp.date),
      eventType: exp.name ?? 'experience',
      expectedAttendance: exp.booked_count ?? exp.max_guests ?? 0,
    });
  }

  return events;
}

// ── Public API ──

/**
 * Verify SevenRooms credentials by fetching a single reservation page.
 */
export async function testConnection(): Promise<ConnectionTestResult> {
  const start = Date.now();
  try {
    const { apiKey, venueId } = getConfig();
    const today = new Date();
    await fetchReservations(apiKey, venueId, today, today);
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Pull reservation and event data for a date range and normalize to EventData[].
 *
 * @param lookbackDays  Days of history (default 28)
 * @param lookaheadDays Days of upcoming reservations (default 14)
 */
export async function fetchEvents(
  lookbackDays = 28,
  lookaheadDays = 14,
): Promise<{
  events: EventData[];
  rawReservations: SevenRoomsReservation[];
  rawExperiences: SevenRoomsExperience[];
}> {
  const { apiKey, venueId } = getConfig();

  const from = daysAgo(lookbackDays);
  const to = new Date();
  to.setDate(to.getDate() + lookaheadDays);

  const [rawReservations, rawExperiences] = await Promise.all([
    fetchReservations(apiKey, venueId, from, to),
    fetchExperiences(apiKey, venueId, from, to),
  ]);

  const events = normalizeToEvents(rawReservations, rawExperiences);

  return { events, rawReservations, rawExperiences };
}

/**
 * Run the full SevenRooms sync. Callers (index.ts) handle writing to Supabase.
 */
export async function sync(): Promise<{
  result: SyncResult;
  events: EventData[];
  rawReservations: SevenRoomsReservation[];
  rawExperiences: SevenRoomsExperience[];
}> {
  const errors: string[] = [];
  let events: EventData[] = [];
  let rawReservations: SevenRoomsReservation[] = [];
  let rawExperiences: SevenRoomsExperience[] = [];

  try {
    ({ events, rawReservations, rawExperiences } = await fetchEvents());
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
    rawReservations,
    rawExperiences,
  };
}
