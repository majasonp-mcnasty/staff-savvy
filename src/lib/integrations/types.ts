// ── Shared integration types ──
// SECURITY: no secrets or credentials in this file (CLAUDE.md §1)

export type IntegrationPlatform = 'toast' | 'sevenrooms' | 'tripleseat' | 'push';

export type SyncStatus = 'success' | 'error' | 'partial';

/** Returned by syncAllIntegrations() and individual sync functions */
export interface SyncResult {
  platform: IntegrationPlatform;
  status: SyncStatus;
  recordsSynced: number;
  errors: string[];
  syncedAt: string; // ISO timestamp
}

/** Returned by testConnection() on each connector */
export interface ConnectionTestResult {
  connected: boolean;
  latencyMs?: number;
  error?: string;
}

/** Row shape returned from integration_sync_log Supabase table */
export interface SyncLogRow {
  id: string;
  platform: IntegrationPlatform;
  status: SyncStatus;
  records_synced: number;
  error_message: string | null;
  synced_at: string;
}

// ── Toast POS raw API shapes ──

export interface ToastAuthResponse {
  token: {
    tokenType: string;
    accessToken: string;
    expiration: number; // Unix ms
  };
}

export interface ToastOrder {
  guid: string;
  businessDate: number; // YYYYMMDD integer
  closedDate: string | null; // ISO string
  checks: ToastCheck[];
}

export interface ToastCheck {
  totalAmount: number;
  displayNumber: string;
}

export interface ToastOrdersResponse {
  orders?: ToastOrder[];
}

export interface ToastTimeEntry {
  guid: string;
  employeeReference: { guid: string };
  jobReference: { guid: string; title: string };
  inDate: string; // ISO
  outDate: string | null;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
}

export interface ToastLaborResponse {
  timeEntries?: ToastTimeEntry[];
}

// ── SevenRooms raw API shapes ──

export interface SevenRoomsReservation {
  id: string;
  date: string; // YYYY-MM-DD
  arrival_time: string; // HH:MM
  party_size: number;
  status: string;
  type: string; // 'reservation' | 'walk-in' | etc
}

export interface SevenRoomsExperience {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  max_guests: number;
  booked_count: number;
}

export interface SevenRoomsReservationsResponse {
  data?: {
    results?: SevenRoomsReservation[];
  };
}

export interface SevenRoomsExperiencesResponse {
  data?: {
    results?: SevenRoomsExperience[];
  };
}

// ── Tripleseat raw API shapes ──

export interface TripleseatEvent {
  id: number;
  name: string;
  event_date: string; // YYYY-MM-DD
  guest_count: number;
  status: string;
  event_type: string;
}

export interface TripleseatLead {
  id: number;
  name: string;
  event_date: string; // YYYY-MM-DD
  guest_count: number;
  status: string;
}

export interface TripleseatEventsResponse {
  events?: TripleseatEvent[];
}

export interface TripleseatLeadsResponse {
  leads?: TripleseatLead[];
}

// ── Push Operations raw API shapes ──

export interface PushEmployee {
  id: string;
  first_name: string;
  last_name: string;
  status: string; // 'active' | 'inactive'
  wage: number;
  employment_type: string; // 'full_time' | 'part_time'
  positions: PushPosition[];
  availability: PushAvailability[];
}

export interface PushPosition {
  id: string;
  name: string;
}

export interface PushAvailabilityWindow {
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
}

export interface PushAvailability {
  day_of_week: number; // 0 = Sunday, 1 = Monday … 6 = Saturday
  available: boolean;
  windows: PushAvailabilityWindow[];
}

export interface PushEmployeesResponse {
  employees?: PushEmployee[];
  data?: PushEmployee[];
  pagination?: {
    total: number;
    page: number;
    per_page: number;
  };
}

export interface PushTimesheet {
  id: string;
  employee_id: string;
  clock_in: string;  // ISO
  clock_out: string | null;
  regular_hours: number;
  overtime_hours: number;
  wage: number;
}

export interface PushTimesheetsResponse {
  timesheets?: PushTimesheet[];
  data?: PushTimesheet[];
}
