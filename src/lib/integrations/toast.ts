// ── Toast POS Connector ──
// Auth:    OAuth 2.0 client credentials
// Pulls:   Hourly sales, covers, labor reports
// Maps to: ForecastInputs.historicalSales[]
// Docs:    https://doc.toasttab.com/doc/platformguide/adminApiAuthentication.html
//
// SECURITY: credentials loaded exclusively from env vars (CLAUDE.md §1)
// NOTE: Direct browser calls to Toast API may require a CORS proxy or
//       Supabase Edge Function in production. See .env.example.

import { HistoricalSalesData, DayOfWeek } from '@/lib/types';
import {
  IntegrationError,
  fetchWithRetry,
  postJsonInit,
  bearerAuthHeaders,
  toToastBusinessDate,
  daysAgo,
  JS_DAY_TO_DOW,
} from './http';
import {
  ToastAuthResponse,
  ToastOrdersResponse,
  ToastOrder,
  ConnectionTestResult,
  SyncResult,
} from './types';

const BASE_URL = 'https://ws-api.toasttab.com';
const PLATFORM = 'toast' as const;

// ── Config ──

function getConfig() {
  const clientId = import.meta.env.VITE_TOAST_CLIENT_ID as string | undefined;
  const clientSecret = import.meta.env.VITE_TOAST_CLIENT_SECRET as string | undefined;
  const restaurantGuid = import.meta.env.VITE_TOAST_RESTAURANT_GUID as string | undefined;

  if (!clientId || !clientSecret || !restaurantGuid) {
    throw new IntegrationError(
      PLATFORM,
      null,
      'Missing Toast credentials. Set VITE_TOAST_CLIENT_ID, VITE_TOAST_CLIENT_SECRET, and VITE_TOAST_RESTAURANT_GUID in .env',
    );
  }

  return { clientId, clientSecret, restaurantGuid };
}

// ── Auth ──

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const { clientId, clientSecret } = getConfig();

  const response = await fetchWithRetry<ToastAuthResponse>(
    `${BASE_URL}/authentication/v1/authentication/login`,
    postJsonInit({
      clientId,
      clientSecret,
      userAccessType: 'TOAST_MACHINE_CLIENT',
    }),
    PLATFORM,
  );

  cachedToken = {
    value: response.token.accessToken,
    expiresAt: response.token.expiration,
  };

  return cachedToken.value;
}

// ── Data fetching ──

/** Fetch orders for a single business date (YYYYMMDD integer) */
async function fetchOrdersForDate(
  token: string,
  restaurantGuid: string,
  businessDate: number,
): Promise<ToastOrder[]> {
  const url = `${BASE_URL}/orders/v2/ordersBulk?businessDate=${businessDate}&restaurantGuid=${restaurantGuid}`;
  const response = await fetchWithRetry<ToastOrdersResponse>(
    url,
    {
      ...bearerAuthHeaders(token),
      headers: {
        ...bearerAuthHeaders(token).headers,
        'Toast-Restaurant-External-ID': restaurantGuid,
      },
    },
    PLATFORM,
  );
  return response.orders ?? [];
}

// ── Normalization ──

/**
 * Convert raw Toast orders into HistoricalSalesData[].
 * Aggregates hourly revenue across all fetched days, then averages
 * per (day-of-week, hour) bucket over the number of weeks sampled.
 */
function normalizeToHistoricalSales(
  orders: ToastOrder[],
  weeksSampled: number,
): HistoricalSalesData[] {
  // Accumulator: key = "dayOfWeek:hour", value = total revenue
  const buckets = new Map<string, number>();

  for (const order of orders) {
    if (!order.closedDate) continue; // skip open orders

    const closed = new Date(order.closedDate);
    const hour = closed.getHours();
    const dayIndex = closed.getDay(); // 0=Sun…6=Sat
    const dayOfWeek: DayOfWeek = JS_DAY_TO_DOW[dayIndex];

    const orderRevenue = order.checks.reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);
    const key = `${dayOfWeek}:${hour}`;
    buckets.set(key, (buckets.get(key) ?? 0) + orderRevenue);
  }

  // Average across sampled weeks
  const result: HistoricalSalesData[] = [];
  for (const [key, total] of buckets.entries()) {
    const [day, hourStr] = key.split(':');
    result.push({
      day: day as DayOfWeek,
      hour: parseInt(hourStr, 10),
      revenue: Math.round((total / weeksSampled) * 100) / 100,
    });
  }

  return result.sort((a, b) =>
    a.day.localeCompare(b.day) || a.hour - b.hour,
  );
}

// ── Public API ──

/**
 * Verify Toast credentials are valid by attempting to get an access token.
 */
export async function testConnection(): Promise<ConnectionTestResult> {
  const start = Date.now();
  try {
    await getAccessToken();
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Pull last `lookbackDays` days of Toast order data and normalize
 * to HistoricalSalesData[].
 *
 * @param lookbackDays  How many days of history to fetch (default 28 = 4 weeks)
 */
export async function fetchHistoricalSales(
  lookbackDays = 28,
): Promise<{ sales: HistoricalSalesData[]; rawOrders: ToastOrder[] }> {
  const { restaurantGuid } = getConfig();
  const token = await getAccessToken();

  const allOrders: ToastOrder[] = [];
  const today = new Date();

  // Fetch each day sequentially to respect rate limits
  for (let i = 1; i <= lookbackDays; i++) {
    const day = daysAgo(i);
    // Set to midnight to avoid time-of-day artifacts
    day.setHours(0, 0, 0, 0);
    const businessDate = toToastBusinessDate(day);

    const orders = await fetchOrdersForDate(token, restaurantGuid, businessDate);
    allOrders.push(...orders);
  }

  const weeksSampled = Math.max(1, Math.ceil(lookbackDays / 7));
  const sales = normalizeToHistoricalSales(allOrders, weeksSampled);

  return { sales, rawOrders: allOrders };
}

/**
 * Run the full Toast sync: fetch sales data and return a SyncResult.
 * Callers (index.ts) handle writing to Supabase.
 */
export async function sync(lookbackDays = 28): Promise<{
  result: SyncResult;
  sales: HistoricalSalesData[];
  rawOrders: ToastOrder[];
}> {
  const errors: string[] = [];
  let sales: HistoricalSalesData[] = [];
  let rawOrders: ToastOrder[] = [];

  try {
    ({ sales, rawOrders } = await fetchHistoricalSales(lookbackDays));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  return {
    result: {
      platform: PLATFORM,
      status: errors.length === 0 ? 'success' : sales.length > 0 ? 'partial' : 'error',
      recordsSynced: sales.length,
      errors,
      syncedAt: new Date().toISOString(),
    },
    sales,
    rawOrders,
  };
}
