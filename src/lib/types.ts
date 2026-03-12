export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

export const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

export interface TimeWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface TimeOffRequest {
  day: DayOfWeek;
  reason?: string;
}

export type ShiftPreference = 'morning' | 'afternoon' | 'evening' | 'any';

export interface Employee {
  id: string;
  name: string;
  hourlyWage: number;
  maxWeeklyHours: number;
  performanceRating: number; // 1-5
  seniorityLevel: 'junior' | 'mid' | 'senior';
  qualifiedStations: string[];
  availability: Record<DayOfWeek, TimeWindow[]>;
  timeOff: TimeOffRequest[];
  shiftPreference: ShiftPreference;
  certifications: string[];
}

export interface Station {
  id: string;
  name: string;
  color: string;
  isCritical: boolean;
  requiredCertifications?: string[];
}

export interface CoverageRequirement {
  stationId: string;
  day: DayOfWeek;
  timeWindow: TimeWindow;
  requiredCount: number;
  minSeniorityLevel?: 'junior' | 'mid' | 'senior';
}

export interface ScheduleShift {
  employeeId: string;
  stationId: string;
  day: DayOfWeek;
  timeWindow: TimeWindow;
  shiftCost: number;
  score?: EmployeeScore;
}

export interface EmployeeScore {
  availability: number;
  experience: number;
  preference: number;
  fairness: number;
  total: number;
}

export interface LaborSummary {
  totalLaborCost: number;
  laborBudget: number | null;
  budgetStatus: 'within_budget' | 'over_budget' | 'no_budget';
  overtimeCost: number;
  regularCost: number;
}

export interface ScheduleResult {
  shifts: ScheduleShift[];
  totalCost: number;
  costPerDay: Record<DayOfWeek, number>;
  hoursPerEmployee: Record<string, number>;
  overtimeWarnings: string[];
  understaffedAlerts: string[];
  generatedAt: string;
  laborSummary: LaborSummary;
  demandForecast?: DemandForecastEntry[];
}

export interface BudgetSettings {
  weeklyBudgetCap: number | null;
  overtimeThreshold: number;
  overtimeMultiplier: number;
  minRestHours: number;
}

export interface ScoringWeights {
  availability: number;
  experience: number;
  preference: number;
  fairness: number;
}

export interface ForecastWeights {
  historicalSales: number;
  events: number;
  weather: number;
  seasonal: number;
}

export type DemandLevel = 'low' | 'normal' | 'high' | 'peak';

export interface DemandForecastEntry {
  day: DayOfWeek;
  shift: string; // "HH:MM-HH:MM"
  predictedDemand: DemandLevel;
  demandScore: number;
  recommendedStaff: number;
  staffingMultiplier: number;
}

export interface HistoricalSalesData {
  day: DayOfWeek;
  hour: number;
  revenue: number;
}

export interface EventData {
  day: DayOfWeek;
  eventType: string;
  expectedAttendance: number;
}

export interface WeatherData {
  day: DayOfWeek;
  temperature: number;
  rainProbability: number;
}

export interface ForecastInputs {
  historicalSales: HistoricalSalesData[];
  events: EventData[];
  weather: WeatherData[];
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function shiftDurationHours(tw: TimeWindow): number {
  return (timeToMinutes(tw.end) - timeToMinutes(tw.start)) / 60;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function getShiftPeriod(tw: TimeWindow): ShiftPreference {
  const mid = (timeToMinutes(tw.start) + timeToMinutes(tw.end)) / 2;
  if (mid < 720) return 'morning';      // before noon
  if (mid < 1020) return 'afternoon';   // before 5pm
  return 'evening';
}
