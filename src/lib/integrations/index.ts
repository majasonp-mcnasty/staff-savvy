// ── Integration Orchestrator ──
// Coordinates all platform syncs and writes results to Supabase.
//
// SECURITY: no credentials here — each connector reads from env (CLAUDE.md §1)

import { supabase } from '@/lib/supabase';
import { upsertEmployees, upsertSettings, fetchSettings } from '@/lib/supabase';
import { ForecastInputs } from '@/lib/types';
import { IntegrationPlatform, SyncResult, SyncLogRow } from './types';
import { sync as syncToast } from './toast';
import { sync as syncSevenRooms } from './sevenrooms';
import { sync as syncTripleseat } from './tripleseat';
import { sync as syncPush } from './push';

export type { SyncResult, SyncLogRow, IntegrationPlatform } from './types';
export { testConnection as testToastConnection } from './toast';
export { testConnection as testSevenRoomsConnection } from './sevenrooms';
export { testConnection as testTripleseatConnection } from './tripleseat';
export { testConnection as testPushConnection } from './push';

// ── Supabase helpers for integration tables ──

/** Write a sync result to integration_sync_log. */
async function writeSyncLog(result: SyncResult): Promise<void> {
  const { error } = await supabase.from('integration_sync_log').insert({
    platform: result.platform,
    status: result.status,
    records_synced: result.recordsSynced,
    error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
    synced_at: result.syncedAt,
  });
  if (error) console.error(`[integrations] Failed to write sync log for ${result.platform}:`, error);
}

/** Store raw API response data for debugging and model retraining. */
async function writeRawData(platform: IntegrationPlatform, raw: unknown): Promise<void> {
  const { error } = await supabase.from('raw_integration_data').insert({
    platform,
    raw_json: raw,
    pulled_at: new Date().toISOString(),
  });
  if (error) console.error(`[integrations] Failed to write raw data for ${platform}:`, error);
}

/** Fetch the most recent sync log row per platform. */
export async function fetchLatestSyncLogs(): Promise<SyncLogRow[]> {
  const platforms: IntegrationPlatform[] = ['toast', 'sevenrooms', 'tripleseat', 'push'];

  const results = await Promise.all(
    platforms.map(platform =>
      supabase
        .from('integration_sync_log')
        .select('*')
        .eq('platform', platform)
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );

  return results
    .map(r => r.data)
    .filter((r): r is SyncLogRow => r !== null);
}

// ── Individual platform sync functions ──

/**
 * Sync Toast POS → historicalSales in app_settings.
 * Merges with existing forecast inputs, preserving weather and event data.
 */
export async function syncToastPlatform(): Promise<SyncResult> {
  const { result, sales, rawOrders } = await syncToast();

  if (sales.length > 0) {
    const current = await fetchSettings();
    const forecastInputs: ForecastInputs = {
      historicalSales: sales,
      events: current?.forecastInputs?.events ?? [],
      weather: current?.forecastInputs?.weather ?? [],
    };
    await upsertSettings({
      budget: current?.budget ?? { weeklyBudgetCap: null, overtimeThreshold: 40, overtimeMultiplier: 1.5, minRestHours: 8 },
      scoringWeights: current?.scoringWeights ?? { availability: 0.35, experience: 0.20, preference: 0.10, fairness: 0.15, laborEfficiency: 0.10, fatigue: 0.10 },
      forecastWeights: current?.forecastWeights ?? { historicalSales: 0.50, events: 0.25, weather: 0.15, seasonal: 0.10 },
      forecastInputs,
      useDemandForecast: current?.useDemandForecast ?? true,
    });

    await writeRawData('toast', { orders_sample: rawOrders.slice(0, 50) });
  }

  await writeSyncLog(result);
  return result;
}

/**
 * Sync SevenRooms → events in app_settings forecast inputs.
 */
export async function syncSevenRoomsPlatform(): Promise<SyncResult> {
  const { result, events, rawReservations, rawExperiences } = await syncSevenRooms();

  if (events.length > 0) {
    const current = await fetchSettings();
    const forecastInputs: ForecastInputs = {
      historicalSales: current?.forecastInputs?.historicalSales ?? [],
      events,
      weather: current?.forecastInputs?.weather ?? [],
    };
    await upsertSettings({
      budget: current?.budget ?? { weeklyBudgetCap: null, overtimeThreshold: 40, overtimeMultiplier: 1.5, minRestHours: 8 },
      scoringWeights: current?.scoringWeights ?? { availability: 0.35, experience: 0.20, preference: 0.10, fairness: 0.15, laborEfficiency: 0.10, fatigue: 0.10 },
      forecastWeights: current?.forecastWeights ?? { historicalSales: 0.50, events: 0.25, weather: 0.15, seasonal: 0.10 },
      forecastInputs,
      useDemandForecast: current?.useDemandForecast ?? true,
    });

    await writeRawData('sevenrooms', {
      reservations_sample: rawReservations.slice(0, 50),
      experiences_sample: rawExperiences.slice(0, 20),
    });
  }

  await writeSyncLog(result);
  return result;
}

/**
 * Sync Tripleseat → events in app_settings forecast inputs.
 * Merges with SevenRooms events already stored (appends, does not replace).
 */
export async function syncTripleseatPlatform(): Promise<SyncResult> {
  const { result, events, rawEvents, rawLeads } = await syncTripleseat();

  if (events.length > 0) {
    const current = await fetchSettings();
    // Merge Tripleseat events with any existing events (e.g. from SevenRooms)
    const existingEvents = current?.forecastInputs?.events ?? [];
    // De-dupe by day+type+attendance fingerprint
    const existingSet = new Set(existingEvents.map(e => `${e.day}:${e.eventType}:${e.expectedAttendance}`));
    const newEvents = events.filter(e => !existingSet.has(`${e.day}:${e.eventType}:${e.expectedAttendance}`));

    const forecastInputs: ForecastInputs = {
      historicalSales: current?.forecastInputs?.historicalSales ?? [],
      events: [...existingEvents, ...newEvents],
      weather: current?.forecastInputs?.weather ?? [],
    };
    await upsertSettings({
      budget: current?.budget ?? { weeklyBudgetCap: null, overtimeThreshold: 40, overtimeMultiplier: 1.5, minRestHours: 8 },
      scoringWeights: current?.scoringWeights ?? { availability: 0.35, experience: 0.20, preference: 0.10, fairness: 0.15, laborEfficiency: 0.10, fatigue: 0.10 },
      forecastWeights: current?.forecastWeights ?? { historicalSales: 0.50, events: 0.25, weather: 0.15, seasonal: 0.10 },
      forecastInputs,
      useDemandForecast: current?.useDemandForecast ?? true,
    });

    await writeRawData('tripleseat', {
      events_sample: rawEvents.slice(0, 50),
      leads_sample: rawLeads.slice(0, 50),
    });
  }

  await writeSyncLog(result);
  return result;
}

/**
 * Sync Push Operations → employees in Supabase.
 * Upserts employee records using push_<id> as the stable ID.
 */
export async function syncPushPlatform(): Promise<SyncResult> {
  const { result, employees, rawEmployees } = await syncPush();

  if (employees.length > 0) {
    await upsertEmployees(employees);
    await writeRawData('push', { employees_sample: rawEmployees.slice(0, 20) });
  }

  await writeSyncLog(result);
  return result;
}

// ── Full sync ──

export interface AllSyncResults {
  toast: SyncResult;
  sevenrooms: SyncResult;
  tripleseat: SyncResult;
  push: SyncResult;
}

/**
 * Run all 4 platform syncs.
 * Each runs independently — a failure in one does not block the others.
 */
export async function syncAllIntegrations(): Promise<AllSyncResults> {
  const errorResult = (platform: IntegrationPlatform, err: unknown): SyncResult => ({
    platform,
    status: 'error',
    recordsSynced: 0,
    errors: [err instanceof Error ? err.message : String(err)],
    syncedAt: new Date().toISOString(),
  });

  const [toast, sevenrooms, tripleseat, push] = await Promise.allSettled([
    syncToastPlatform(),
    syncSevenRoomsPlatform(),
    syncTripleseatPlatform(),
    syncPushPlatform(),
  ]);

  return {
    toast:       toast.status       === 'fulfilled' ? toast.value       : errorResult('toast',       toast.reason),
    sevenrooms:  sevenrooms.status  === 'fulfilled' ? sevenrooms.value  : errorResult('sevenrooms',  sevenrooms.reason),
    tripleseat:  tripleseat.status  === 'fulfilled' ? tripleseat.value  : errorResult('tripleseat',  tripleseat.reason),
    push:        push.status        === 'fulfilled' ? push.value        : errorResult('push',        push.reason),
  };
}
