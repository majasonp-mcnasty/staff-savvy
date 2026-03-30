// ── Shared HTTP utility with exponential backoff and typed errors ──
// SECURITY: no credentials stored here — callers pass auth headers (CLAUDE.md §1)

import { IntegrationPlatform } from './types';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export class IntegrationError extends Error {
  constructor(
    public readonly platform: IntegrationPlatform,
    public readonly statusCode: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(statusCode: number | null): boolean {
  if (statusCode === null) return true;   // network error
  if (statusCode === 429) return true;    // rate limited
  if (statusCode >= 500) return true;     // server error
  return false;                           // 4xx client errors — don't retry
}

/**
 * Fetch with exponential backoff and rate-limit awareness.
 * Respects Retry-After headers on 429 responses.
 * Throws IntegrationError on final failure.
 */
export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  platform: IntegrationPlatform,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let lastError: IntegrationError = new IntegrationError(platform, null, 'Unknown error');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      await sleep(delay);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (networkErr) {
      const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
      lastError = new IntegrationError(platform, null, `Network error: ${msg}`);
      continue; // retry network failures
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const waitMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : BASE_DELAY_MS * Math.pow(2, attempt);
      await sleep(waitMs);
      lastError = new IntegrationError(platform, 429, 'Rate limited');
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      lastError = new IntegrationError(
        platform,
        response.status,
        `HTTP ${response.status} ${response.statusText}: ${body.slice(0, 200)}`,
      );
      if (!isRetryable(response.status)) throw lastError;
      continue;
    }

    try {
      return (await response.json()) as T;
    } catch {
      lastError = new IntegrationError(platform, response.status, 'Failed to parse JSON response');
      throw lastError; // malformed JSON is not retryable
    }
  }

  throw lastError;
}

/**
 * Build a GET request init with Bearer token auth.
 */
export function bearerAuthHeaders(token: string): RequestInit {
  return {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
}

/**
 * Build a GET request init with an API key header.
 */
export function apiKeyHeaders(
  key: string,
  headerName = 'X-API-Key',
): RequestInit {
  return {
    method: 'GET',
    headers: {
      [headerName]: key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
}

/**
 * Build a POST request init with a JSON body.
 */
export function postJsonInit(body: Record<string, unknown>): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Format a Date as YYYYMMDD integer (Toast businessDate format).
 */
export function toToastBusinessDate(date: Date): number {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return parseInt(`${y}${m}${d}`, 10);
}

/**
 * Format a Date as YYYY-MM-DD string.
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Return a Date N days before today.
 */
export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Map JS day index (0=Sun…6=Sat) to DayOfWeek string.
 */
export const JS_DAY_TO_DOW = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;
