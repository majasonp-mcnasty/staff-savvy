import {
  Employee, TimeWindow, ScoringWeights, EmployeeScore,
  shiftDurationHours, getShiftPeriod,
} from './types';

const SENIORITY_EXPERIENCE: Record<string, number> = { junior: 60, mid: 80, senior: 100 };
const RATING_BONUS_PER_POINT = 5;

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  availability: 0.35,
  experience: 0.20,
  preference: 0.10,
  fairness: 0.15,
  laborEfficiency: 0.10,
  fatigue: 0.10,
};

function availabilityScore(overlapHours: number, shiftHours: number): number {
  if (shiftHours <= 0) return 0;
  const ratio = overlapHours / shiftHours;
  if (ratio >= 0.95) return 100;
  if (ratio >= 0.7) return 80;
  if (ratio >= 0.3) return 50;
  return 0;
}

function experienceScore(emp: Employee): number {
  const base = SENIORITY_EXPERIENCE[emp.seniorityLevel] || 60;
  const bonus = (emp.performanceRating - 1) * RATING_BONUS_PER_POINT;
  return Math.min(100, base + bonus);
}

function preferenceScore(emp: Employee, tw: TimeWindow): number {
  if (emp.shiftPreference === 'any') return 50;
  const period = getShiftPeriod(tw);
  if (period === emp.shiftPreference) return 100;
  return 20;
}

function fairnessScore(currentHours: number, maxHours: number): number {
  if (maxHours <= 0) return 0;
  const utilization = currentHours / maxHours;
  if (utilization < 0.3) return 100;
  if (utilization < 0.6) return 70;
  if (utilization < 0.85) return 40;
  return 10;
}

/**
 * Labor efficiency score (0-100). Lower-cost qualified employees score higher.
 * Normalized against a reference wage range ($10-$30/hr).
 */
function laborEfficiencyScore(hourlyWage: number): number {
  const minWage = 10;
  const maxWage = 30;
  const clamped = Math.max(minWage, Math.min(maxWage, hourlyWage));
  return Math.round(100 - ((clamped - minWage) / (maxWage - minWage)) * 60);
}

/**
 * Fatigue score (0-100). Well-rested employees score higher.
 * Based on consecutive shifts count in the current week.
 */
function fatigueScore(consecutiveShifts: number): number {
  if (consecutiveShifts <= 2) return 100;
  if (consecutiveShifts <= 3) return 80;
  if (consecutiveShifts <= 4) return 60;
  if (consecutiveShifts <= 5) return 30;
  return 20;
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
  consecutiveShifts: number = 0,
): EmployeeScore {
  const avail = availabilityScore(overlapHours, shiftHours);
  const exp = experienceScore(emp);
  const pref = preferenceScore(emp, tw);
  const fair = fairnessScore(currentWeeklyHours, emp.maxWeeklyHours);
  const labor = laborEfficiencyScore(emp.hourlyWage);
  const fatg = fatigueScore(consecutiveShifts);

  const total =
    avail * weights.availability +
    exp * weights.experience +
    pref * weights.preference +
    fair * weights.fairness +
    labor * weights.laborEfficiency +
    fatg * weights.fatigue;

  return {
    availability: Math.round(avail),
    experience: Math.round(exp),
    preference: Math.round(pref),
    fairness: Math.round(fair),
    laborEfficiency: Math.round(labor),
    fatigue: Math.round(fatg),
    total: Math.round(total),
  };
}
