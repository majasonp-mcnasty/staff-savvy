// ── Push Operations Connector ──
// Auth:    Bearer token
// Pulls:   Employee records, wages, availability, timesheets
// Maps to: Employee model (hourlyWage, maxWeeklyHours, availability)
// Docs:    https://developers.pushoperations.com
//
// SECURITY: credentials loaded exclusively from env vars (CLAUDE.md §1)
//
// NOTE: Push Operations requires approved partner access for API tokens.
//       Contact Push Operations support to obtain credentials.
//       Set VITE_PUSH_API_KEY (Bearer token) and VITE_PUSH_BASE_URL in .env.
//       Labor/timesheet endpoints have a 2-day maximum date range per request.

import { Employee, DayOfWeek } from '@/lib/types';
import {
  IntegrationError,
  fetchWithRetry,
  bearerAuthHeaders,
  toISODateString,
  daysAgo,
  JS_DAY_TO_DOW,
} from './http';
import {
  PushEmployee,
  PushTimesheet,
  PushEmployeesResponse,
  PushTimesheetsResponse,
  ConnectionTestResult,
  SyncResult,
} from './types';

const PLATFORM = 'push' as const;
const DEFAULT_BASE_URL = 'https://api.pushoperations.com';

// ── Config ──

function getConfig() {
  const apiKey = import.meta.env.VITE_PUSH_API_KEY as string | undefined;
  // Base URL can be overridden — confirm your exact subdomain with Push Operations
  const baseUrl = (import.meta.env.VITE_PUSH_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL;

  if (!apiKey) {
    throw new IntegrationError(
      PLATFORM,
      null,
      'Missing Push Operations credentials. Set VITE_PUSH_API_KEY in .env. Obtain an API token from your Push Operations account manager.',
    );
  }

  return { apiKey, baseUrl };
}

// ── Data fetching ──

/** Fetch all employees with auto-pagination (page + limit). */
async function fetchAllEmployees(apiKey: string, baseUrl: string): Promise<PushEmployee[]> {
  const all: PushEmployee[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const url = `${baseUrl}/api/v1/employees?${params.toString()}`;

    const response = await fetchWithRetry<PushEmployeesResponse>(
      url,
      bearerAuthHeaders(apiKey),
      PLATFORM,
    );

    // Push Operations may return employees under 'employees' or 'data' key
    const batch = response.employees ?? response.data ?? [];
    all.push(...batch);

    if (batch.length < limit) break; // last page
    page++;
  }

  return all;
}

/**
 * Fetch timesheets in 2-day chunks (Push Operations enforces a 2-day max window).
 * Builds a wage map: employeeId → average observed hourly rate.
 */
async function fetchWageMap(
  apiKey: string,
  baseUrl: string,
  lookbackDays: number,
): Promise<Map<string, number>> {
  const wageMap = new Map<string, number>();
  const wageSamples = new Map<string, number[]>();

  const totalDays = lookbackDays;
  // Chunk into 2-day windows to comply with Push Operations API limit
  for (let offset = 0; offset < totalDays; offset += 2) {
    const from = daysAgo(totalDays - offset);
    const to = new Date(from);
    to.setDate(to.getDate() + 1); // 2-day window (inclusive)

    const params = new URLSearchParams({
      start_date: toISODateString(from),
      end_date: toISODateString(to),
    });

    const url = `${baseUrl}/api/v1/timesheets?${params.toString()}`;

    let response: PushTimesheetsResponse;
    try {
      response = await fetchWithRetry<PushTimesheetsResponse>(
        url,
        bearerAuthHeaders(apiKey),
        PLATFORM,
      );
    } catch {
      continue; // skip this window on error, best-effort
    }

    const entries = response.timesheets ?? response.data ?? [];
    for (const entry of entries) {
      if (!entry.employee_id || !entry.wage) continue;
      if (!wageSamples.has(entry.employee_id)) {
        wageSamples.set(entry.employee_id, []);
      }
      wageSamples.get(entry.employee_id)!.push(entry.wage);
    }
  }

  // Average the observed wages per employee
  for (const [empId, wages] of wageSamples.entries()) {
    const avg = wages.reduce((s, w) => s + w, 0) / wages.length;
    wageMap.set(empId, Math.round(avg * 100) / 100);
  }

  return wageMap;
}

// ── Normalization ──

/**
 * Map Push Operations day-of-week index to DayOfWeek.
 * Push uses: 0 = Sunday, 1 = Monday … 6 = Saturday (same as JS).
 */
function pushDayToDow(dayIndex: number): DayOfWeek {
  return JS_DAY_TO_DOW[dayIndex % 7];
}

/**
 * Derive seniority from employment type and position title.
 * Heuristic: promote to 'senior' if title contains supervisor/manager/lead.
 * Defaults to 'junior' for part-time, 'mid' for full-time.
 */
function inferSeniority(emp: PushEmployee): Employee['seniorityLevel'] {
  const titleLower = emp.positions.map(p => p.name.toLowerCase()).join(' ');
  if (titleLower.match(/supervisor|manager|director|lead|senior/)) return 'senior';
  if (emp.employment_type === 'full_time') return 'mid';
  return 'junior';
}

/**
 * Convert PushEmployee → Employee.
 * wage comes from the wageMap (timesheet-derived) when available,
 * falling back to the employee record's own wage field.
 */
function normalizeEmployee(
  pushEmp: PushEmployee,
  wageMap: Map<string, number>,
): Employee {
  // Build availability from PushAvailability windows
  const availability: Record<DayOfWeek, { start: string; end: string }[]> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };

  for (const avail of pushEmp.availability ?? []) {
    if (!avail.available) continue;
    const dow = pushDayToDow(avail.day_of_week);
    for (const win of avail.windows ?? []) {
      availability[dow].push({ start: win.start_time, end: win.end_time });
    }
  }

  const hourlyWage = wageMap.get(pushEmp.id) ?? pushEmp.wage ?? 0;
  const isFullTime = pushEmp.employment_type === 'full_time';

  return {
    id: `push_${pushEmp.id}`,
    name: `${pushEmp.first_name} ${pushEmp.last_name}`.trim(),
    hourlyWage,
    maxWeeklyHours: isFullTime ? 40 : 25,
    performanceRating: 3, // Push Operations doesn't expose performance; default neutral
    seniorityLevel: inferSeniority(pushEmp),
    qualifiedStations: pushEmp.positions.map(p => p.name),
    availability,
    timeOff: [],
    shiftPreference: 'any',
    certifications: [],
  };
}

// ── Public API ──

/**
 * Verify Push Operations credentials by fetching the first page of employees.
 */
export async function testConnection(): Promise<ConnectionTestResult> {
  const start = Date.now();
  try {
    const { apiKey, baseUrl } = getConfig();
    const params = new URLSearchParams({ page: '1', limit: '1' });
    await fetchWithRetry<PushEmployeesResponse>(
      `${baseUrl}/api/v1/employees?${params.toString()}`,
      bearerAuthHeaders(apiKey),
      PLATFORM,
    );
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Pull employee and timesheet data from Push Operations.
 * Normalizes to Employee[].
 *
 * @param lookbackDays  Days of timesheet history to build wage estimates (default 14)
 */
export async function fetchEmployeeData(lookbackDays = 14): Promise<{
  employees: Employee[];
  rawEmployees: PushEmployee[];
}> {
  const { apiKey, baseUrl } = getConfig();

  const [rawEmployees, wageMap] = await Promise.all([
    fetchAllEmployees(apiKey, baseUrl),
    fetchWageMap(apiKey, baseUrl, lookbackDays),
  ]);

  // Only import active employees
  const activeRaw = rawEmployees.filter(e => e.status === 'active');
  const employees = activeRaw.map(e => normalizeEmployee(e, wageMap));

  return { employees, rawEmployees };
}

/**
 * Run the full Push Operations sync. Callers (index.ts) handle writing to Supabase.
 */
export async function sync(): Promise<{
  result: SyncResult;
  employees: Employee[];
  rawEmployees: PushEmployee[];
}> {
  const errors: string[] = [];
  let employees: Employee[] = [];
  let rawEmployees: PushEmployee[] = [];

  try {
    ({ employees, rawEmployees } = await fetchEmployeeData());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  return {
    result: {
      platform: PLATFORM,
      status: errors.length === 0 ? 'success' : employees.length > 0 ? 'partial' : 'error',
      recordsSynced: employees.length,
      errors,
      syncedAt: new Date().toISOString(),
    },
    employees,
    rawEmployees,
  };
}
