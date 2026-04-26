import { createClient } from '@supabase/supabase-js';
import {
  Employee, Station, CoverageRequirement, BudgetSettings,
  ScoringWeights, ForecastWeights, ForecastInputs, ScheduleResult,
} from '@/lib/types';

// Loaded from environment variables — see .env.example
// SECURITY: never hardcode credentials here (CLAUDE.md §1)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill in your values.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Employees ──

export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from('employees').select('*').order('created_at');
  if (error) throw error;
  return data.map(rowToEmployee);
}

export async function upsertEmployees(employees: Employee[]): Promise<void> {
  if (employees.length === 0) return;
  const { error } = await supabase.from('employees').upsert(employees.map(employeeToRow));
  if (error) throw error;
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

function employeeToRow(e: Employee) {
  return {
    id: e.id,
    name: e.name,
    hourly_wage: e.hourlyWage,
    max_weekly_hours: e.maxWeeklyHours,
    performance_rating: e.performanceRating,
    seniority_level: e.seniorityLevel,
    qualified_stations: e.qualifiedStations,
    availability: e.availability,
    time_off: e.timeOff,
    shift_preference: e.shiftPreference,
    certifications: e.certifications,
    member_since: e.memberSince ?? null,
  };
}

function rowToEmployee(row: Record<string, unknown>): Employee {
  return {
    id: row.id as string,
    name: row.name as string,
    hourlyWage: row.hourly_wage as number,
    maxWeeklyHours: row.max_weekly_hours as number,
    performanceRating: row.performance_rating as number,
    seniorityLevel: row.seniority_level as Employee['seniorityLevel'],
    qualifiedStations: row.qualified_stations as string[],
    availability: row.availability as Employee['availability'],
    timeOff: row.time_off as Employee['timeOff'],
    shiftPreference: row.shift_preference as Employee['shiftPreference'],
    certifications: row.certifications as string[],
    memberSince: (row.member_since as string | null) ?? null,
  };
}

// ── Stations ──

export async function fetchStations(): Promise<Station[]> {
  const { data, error } = await supabase.from('stations').select('*').order('created_at');
  if (error) throw error;
  return data.map(rowToStation);
}

export async function upsertStations(stations: Station[]): Promise<void> {
  if (stations.length === 0) return;
  const { error } = await supabase.from('stations').upsert(stations.map(stationToRow));
  if (error) throw error;
}

export async function deleteStation(id: string): Promise<void> {
  const { error } = await supabase.from('stations').delete().eq('id', id);
  if (error) throw error;
}

export async function updateStationLastActive(stationIds: string[]): Promise<void> {
  if (stationIds.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('stations')
    .update({ last_active_at: now })
    .in('id', stationIds);
  if (error) throw error;
}

function stationToRow(s: Station) {
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    is_critical: s.isCritical,
    required_certifications: s.requiredCertifications ?? [],
    last_active_at: s.lastActiveAt ?? null,
  };
}

function rowToStation(row: Record<string, unknown>): Station {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    isCritical: row.is_critical as boolean,
    requiredCertifications: row.required_certifications as string[],
    lastActiveAt: (row.last_active_at as string | null) ?? null,
  };
}

// ── Coverage Requirements ──

export async function fetchRequirements(): Promise<CoverageRequirement[]> {
  const { data, error } = await supabase.from('coverage_requirements').select('*').order('created_at');
  if (error) throw error;
  return data.map(rowToRequirement);
}

export async function upsertRequirements(reqs: CoverageRequirement[]): Promise<void> {
  if (reqs.length === 0) return;
  const { error } = await supabase.from('coverage_requirements').upsert(reqs.map(requirementToRow));
  if (error) throw error;
}

export async function deleteRequirement(id: string): Promise<void> {
  const { error } = await supabase.from('coverage_requirements').delete().eq('id', id);
  if (error) throw error;
}

export async function replaceAllRequirements(reqs: CoverageRequirement[]): Promise<void> {
  await supabase.from('coverage_requirements').delete().neq('id', '');
  if (reqs.length > 0) {
    const { error } = await supabase.from('coverage_requirements').insert(reqs.map(requirementToRow));
    if (error) throw error;
  }
}

function requirementToRow(r: CoverageRequirement & { id?: string }) {
  return {
    id: r.id ?? Math.random().toString(36).substring(2, 11),
    station_id: r.stationId,
    day: r.day,
    time_window: r.timeWindow,
    required_count: r.requiredCount,
    min_seniority_level: r.minSeniorityLevel ?? null,
  };
}

function rowToRequirement(row: Record<string, unknown>): CoverageRequirement & { id: string } {
  return {
    id: row.id as string,
    stationId: row.station_id as string,
    day: row.day as CoverageRequirement['day'],
    timeWindow: row.time_window as CoverageRequirement['timeWindow'],
    requiredCount: row.required_count as number,
    minSeniorityLevel: row.min_seniority_level as CoverageRequirement['minSeniorityLevel'],
  };
}

// ── App Settings ──

export interface AppSettingsRow {
  budget: BudgetSettings;
  scoringWeights: ScoringWeights;
  forecastWeights: ForecastWeights;
  forecastInputs: ForecastInputs;
  useDemandForecast: boolean;
}

export async function fetchSettings(): Promise<AppSettingsRow | null> {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    budget: data.budget as BudgetSettings,
    scoringWeights: data.scoring_weights as ScoringWeights,
    forecastWeights: data.forecast_weights as ForecastWeights,
    forecastInputs: data.forecast_inputs as ForecastInputs,
    useDemandForecast: data.use_demand_forecast as boolean,
  };
}

export async function upsertSettings(s: AppSettingsRow): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({
    id: 1,
    budget: s.budget,
    scoring_weights: s.scoringWeights,
    forecast_weights: s.forecastWeights,
    forecast_inputs: s.forecastInputs,
    use_demand_forecast: s.useDemandForecast,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ── Schedule Results ──

export async function saveScheduleResult(result: ScheduleResult): Promise<void> {
  const { error } = await supabase.from('schedule_results').insert({
    result,
    generated_at: result.generatedAt,
  });
  if (error) throw error;
}

export async function fetchLatestSchedule(): Promise<ScheduleResult | null> {
  const { data, error } = await supabase
    .from('schedule_results')
    .select('result')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.result as ScheduleResult) : null;
}
