import {
  Employee, TimeWindow, ScheduleShift, ScoringWeights, EmployeeScore,
  shiftDurationHours, getShiftPeriod, ShiftPreference,
} from './types';

const SENIORITY_EXPERIENCE: Record<string, number> = { junior: 60, mid: 80, senior: 100 };
const RATING_BONUS_PER_POINT = 5; // 5 points per rating point, linear scale

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  availability: 0.40,
  experience: 0.25,
  preference: 0.20,
  fairness: 0.15,
};

/**
 * Calculate the availability score (0-100) for an employee on a given shift.
 * Fully available → 100, partial overlap → 70, limited → 30, none → 0
 */
function availabilityScore(overlapHours: number, shiftHours: number): number {
  if (shiftHours <= 0) return 0;
  const ratio = overlapHours / shiftHours;
  if (ratio >= 0.95) return 100;
  if (ratio >= 0.7) return 70;
  if (ratio >= 0.3) return 30;
  return 0;
}

/**
 * Calculate the experience score (0-100) based on seniority + performance rating.
 */
function experienceScore(emp: Employee): number {
  const base = SENIORITY_EXPERIENCE[emp.seniorityLevel] || 60;
  const bonus = (emp.performanceRating - 1) * RATING_BONUS_PER_POINT; // 0 at 1.0, 20 at 5.0
  return Math.min(100, base + bonus);
}

/**
 * Calculate the preference score (0-100) based on shift timing match.
 */
function preferenceScore(emp: Employee, tw: TimeWindow): number {
  if (emp.shiftPreference === 'any') return 50;
  const period = getShiftPeriod(tw);
  if (period === emp.shiftPreference) return 100;
  return 20;
}

/**
 * Calculate the fairness score (0-100) based on current weekly hours vs max.
 */
function fairnessScore(currentHours: number, maxHours: number): number {
  if (maxHours <= 0) return 0;
  const utilization = currentHours / maxHours;
  if (utilization < 0.3) return 100;    // under-scheduled
  if (utilization < 0.6) return 70;     // balanced
  if (utilization < 0.85) return 40;    // above average
  return 10;                            // near limit
}

/**
 * Calculate the composite employee score for a given shift.
 */
export function calculateEmployeeScore(
  emp: Employee,
  tw: TimeWindow,
  overlapHours: number,
  shiftHours: number,
  currentWeeklyHours: number,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): EmployeeScore {
  const avail = availabilityScore(overlapHours, shiftHours);
  const exp = experienceScore(emp);
  const pref = preferenceScore(emp, tw);
  const fair = fairnessScore(currentWeeklyHours, emp.maxWeeklyHours);

  const total =
    avail * weights.availability +
    exp * weights.experience +
    pref * weights.preference +
    fair * weights.fairness;

  return {
    availability: Math.round(avail),
    experience: Math.round(exp),
    preference: Math.round(pref),
    fairness: Math.round(fair),
    total: Math.round(total),
  };
}
