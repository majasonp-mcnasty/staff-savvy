export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export interface TimeWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface Employee {
  id: string;
  name: string;
  hourlyWage: number;
  maxWeeklyHours: number;
  performanceRating: number; // 1-5
  seniorityLevel: 'junior' | 'mid' | 'senior';
  qualifiedStations: string[];
  availability: Record<DayOfWeek, TimeWindow[]>;
}

export interface Station {
  id: string;
  name: string;
  color: string;
  isCritical: boolean;
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
}

export interface ScheduleResult {
  shifts: ScheduleShift[];
  totalCost: number;
  costPerDay: Record<DayOfWeek, number>;
  hoursPerEmployee: Record<string, number>;
  overtimeWarnings: string[];
  understaffedAlerts: string[];
  generatedAt: string;
}

export interface BudgetSettings {
  weeklyBudgetCap: number | null;
  overtimeThreshold: number; // hours per week before overtime kicks in
  overtimeMultiplier: number;
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
