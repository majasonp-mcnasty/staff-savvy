import {
  Employee, Station, CoverageRequirement, ScheduleResult, ScheduleShift,
  BudgetSettings, DayOfWeek, DAYS_OF_WEEK, timeToMinutes, shiftDurationHours,
  TimeWindow, ScoringWeights, LaborSummary, ForecastInputs, DemandForecastEntry,
  ValidationSummary,
} from './types';
import { calculateEmployeeScore, DEFAULT_SCORING_WEIGHTS } from './scoring-engine';
import { generateDemandForecast, getDefaultForecastInputs, DEFAULT_FORECAST_WEIGHTS } from './demand-forecast';
import type { ForecastWeights } from './types';

const SENIORITY_RANK: Record<string, number> = { junior: 1, mid: 2, senior: 3 };

const DAY_INDEX: Record<DayOfWeek, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
};

function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  return timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end);
}

function intersection(a: TimeWindow, b: TimeWindow): TimeWindow | null {
  const start = Math.max(timeToMinutes(a.start), timeToMinutes(b.start));
  const end = Math.min(timeToMinutes(a.end), timeToMinutes(b.end));
  if (start >= end) return null;
  const h1 = Math.floor(start / 60), m1 = start % 60;
  const h2 = Math.floor(end / 60), m2 = end % 60;
  return {
    start: `${h1.toString().padStart(2, '0')}:${m1.toString().padStart(2, '0')}`,
    end: `${h2.toString().padStart(2, '0')}:${m2.toString().padStart(2, '0')}`,
  };
}

function employeeHasConflict(shifts: ScheduleShift[], employeeId: string, day: DayOfWeek, tw: TimeWindow): boolean {
  return shifts.some(s =>
    s.employeeId === employeeId && s.day === day && overlaps(s.timeWindow, tw)
  );
}

function hasRestViolation(shifts: ScheduleShift[], employeeId: string, day: DayOfWeek, tw: TimeWindow, minRestHours: number): boolean {
  if (minRestHours <= 0) return false;
  const dayIdx = DAY_INDEX[day];
  const minRestMinutes = minRestHours * 60;
  const shiftStart = timeToMinutes(tw.start);
  const shiftEnd = timeToMinutes(tw.end);

  for (const s of shifts) {
    if (s.employeeId !== employeeId) continue;
    const sDayIdx = DAY_INDEX[s.day];
    if (sDayIdx === dayIdx - 1 || (dayIdx === 0 && sDayIdx === 6)) {
      const prevEnd = timeToMinutes(s.timeWindow.end);
      const gap = (24 * 60 - prevEnd) + shiftStart;
      if (gap < minRestMinutes) return true;
    }
    if (sDayIdx === dayIdx + 1 || (dayIdx === 6 && sDayIdx === 0)) {
      const nextStart = timeToMinutes(s.timeWindow.start);
      const gap = (24 * 60 - shiftEnd) + nextStart;
      if (gap < minRestMinutes) return true;
    }
  }
  return false;
}

function totalEmployeeHours(shifts: ScheduleShift[], employeeId: string): number {
  return shifts
    .filter(s => s.employeeId === employeeId)
    .reduce((sum, s) => sum + shiftDurationHours(s.timeWindow), 0);
}

function countConsecutiveShiftDays(shifts: ScheduleShift[], employeeId: string): number {
  const daysWorked = new Set(shifts.filter(s => s.employeeId === employeeId).map(s => DAY_INDEX[s.day]));
  if (daysWorked.size === 0) return 0;
  const sorted = [...daysWorked].sort((a, b) => a - b);
  let maxConsecutive = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current++;
      maxConsecutive = Math.max(maxConsecutive, current);
    } else {
      current = 1;
    }
  }
  return maxConsecutive;
}

function calculateShiftCost(hours: number, wage: number, currentWeeklyHours: number, budget: BudgetSettings): number {
  const threshold = budget.overtimeThreshold;
  if (currentWeeklyHours >= threshold) {
    return hours * wage * budget.overtimeMultiplier;
  }
  const regularHoursLeft = Math.max(0, threshold - currentWeeklyHours);
  if (hours <= regularHoursLeft) {
    return hours * wage;
  }
  return regularHoursLeft * wage + (hours - regularHoursLeft) * wage * budget.overtimeMultiplier;
}

export interface ScheduleOptions {
  scoringWeights?: ScoringWeights;
  forecastWeights?: ForecastWeights;
  forecastInputs?: ForecastInputs;
  useDemandForecast?: boolean;
}

export function generateSchedule(
  employees: Employee[],
  stations: Station[],
  requirements: CoverageRequirement[],
  budget: BudgetSettings,
  options: ScheduleOptions = {},
): ScheduleResult {
  const shifts: ScheduleShift[] = [];
  const overtimeWarnings: string[] = [];
  const understaffedAlerts: string[] = [];
  const weights = options.scoringWeights || DEFAULT_SCORING_WEIGHTS;
  const forecastWeights = options.forecastWeights || DEFAULT_FORECAST_WEIGHTS;
  const forecastInputs = options.forecastInputs || getDefaultForecastInputs();

  const demandForecast = generateDemandForecast(requirements, forecastInputs, forecastWeights);

  const adjustedReqs = (options.useDemandForecast !== false)
    ? adjustRequirementsForDemand(requirements, demandForecast)
    : [...requirements];

  const sortedReqs = adjustedReqs.sort((a, b) => {
    const stA = stations.find(s => s.id === a.stationId);
    const stB = stations.find(s => s.id === b.stationId);
    if (stA?.isCritical && !stB?.isCritical) return -1;
    if (!stA?.isCritical && stB?.isCritical) return 1;
    return b.requiredCount - a.requiredCount;
  });

  const reqsByDay = DAYS_OF_WEEK.map(day =>
    sortedReqs.filter(r => r.day === day)
  );

  for (const dayReqs of reqsByDay) {
    const specialized = dayReqs.filter(r => {
      const st = stations.find(s => s.id === r.stationId);
      return r.minSeniorityLevel || st?.isCritical;
    });
    const general = dayReqs.filter(r => {
      const st = stations.find(s => s.id === r.stationId);
      return !r.minSeniorityLevel && !st?.isCritical;
    });

    for (const req of [...specialized, ...general]) {
      assignShifts(req, employees, stations, shifts, budget, weights);
    }
  }

  // Check for unfilled requirements
  for (const req of adjustedReqs) {
    const station = stations.find(s => s.id === req.stationId);
    if (!station) continue;
    const assigned = shifts.filter(s =>
      s.stationId === req.stationId && s.day === req.day &&
      overlaps(s.timeWindow, req.timeWindow)
    ).length;
    if (assigned < req.requiredCount) {
      understaffedAlerts.push(
        `${station.name} on ${req.day} (${req.timeWindow.start}-${req.timeWindow.end}): need ${req.requiredCount}, assigned ${assigned}`
      );
    }
  }

  // Calculate costs and labor summary
  const hoursPerEmployee: Record<string, number> = {};
  const costPerDay: Record<DayOfWeek, number> = {} as any;
  let totalCost = 0;
  let regularCost = 0;
  let overtimeCost = 0;

  for (const day of DAYS_OF_WEEK) costPerDay[day] = 0;

  for (const emp of employees) {
    hoursPerEmployee[emp.id] = totalEmployeeHours(shifts, emp.id);
    if (hoursPerEmployee[emp.id] > budget.overtimeThreshold) {
      overtimeWarnings.push(
        `${emp.name}: ${hoursPerEmployee[emp.id].toFixed(1)}h (overtime threshold: ${budget.overtimeThreshold}h)`
      );
    }
  }

  for (const shift of shifts) {
    costPerDay[shift.day] += shift.shiftCost;
    totalCost += shift.shiftCost;
  }

  for (const emp of employees) {
    const empHours = hoursPerEmployee[emp.id] || 0;
    const regHours = Math.min(empHours, budget.overtimeThreshold);
    const otHours = Math.max(0, empHours - budget.overtimeThreshold);
    regularCost += regHours * emp.hourlyWage;
    overtimeCost += otHours * emp.hourlyWage * budget.overtimeMultiplier;
  }

  const laborSummary: LaborSummary = {
    totalLaborCost: totalCost,
    laborBudget: budget.weeklyBudgetCap,
    budgetStatus: budget.weeklyBudgetCap
      ? (totalCost <= budget.weeklyBudgetCap ? 'within_budget' : 'over_budget')
      : 'no_budget',
    overtimeCost,
    regularCost,
  };

  if (budget.weeklyBudgetCap && totalCost > budget.weeklyBudgetCap) {
    overtimeWarnings.unshift(
      `⚠️ Total cost $${totalCost.toFixed(2)} exceeds budget cap $${budget.weeklyBudgetCap.toFixed(2)}`
    );
  }

  // Build validation summary
  const validationSummary = buildValidationSummary(
    shifts, employees, stations, adjustedReqs, hoursPerEmployee, budget
  );

  return {
    shifts,
    totalCost,
    costPerDay,
    hoursPerEmployee,
    overtimeWarnings,
    understaffedAlerts,
    generatedAt: new Date().toISOString(),
    laborSummary,
    demandForecast,
    validationSummary,
  };
}

function assignShifts(
  req: CoverageRequirement,
  employees: Employee[],
  stations: Station[],
  shifts: ScheduleShift[],
  budget: BudgetSettings,
  weights: ScoringWeights,
) {
  const station = stations.find(s => s.id === req.stationId);
  if (!station) return;

  const alreadyAssigned = shifts.filter(s =>
    s.stationId === req.stationId && s.day === req.day &&
    overlaps(s.timeWindow, req.timeWindow)
  ).length;
  let needed = req.requiredCount - alreadyAssigned;
  if (needed <= 0) return;

  const eligible = employees
    .filter(emp => {
      if (!emp.qualifiedStations.includes(req.stationId)) return false;
      if (req.minSeniorityLevel && SENIORITY_RANK[emp.seniorityLevel] < SENIORITY_RANK[req.minSeniorityLevel]) return false;
      if ((emp.timeOff || []).some(to => to.day === req.day)) return false;
      if (station.requiredCertifications?.length) {
        const empCerts = emp.certifications || [];
        if (!station.requiredCertifications.every(c => empCerts.includes(c))) return false;
      }
      const dayAvail = emp.availability[req.day] || [];
      return dayAvail.some(tw => overlaps(tw, req.timeWindow));
    })
    .map(emp => {
      const currentHours = totalEmployeeHours(shifts, emp.id);
      const consecutiveShifts = countConsecutiveShiftDays(shifts, emp.id);
      const dayAvail = emp.availability[req.day] || [];
      const bestWindow = dayAvail
        .map(tw => intersection(tw, req.timeWindow))
        .filter(Boolean)
        .sort((a, b) => shiftDurationHours(b!) - shiftDurationHours(a!))[0];
      const shiftHours = bestWindow ? shiftDurationHours(bestWindow) : 0;
      const cost = calculateShiftCost(shiftHours, emp.hourlyWage, currentHours, budget);
      const score = calculateEmployeeScore(emp, req.timeWindow, shiftHours, shiftDurationHours(req.timeWindow), currentHours, weights, consecutiveShifts);

      return { emp, shiftHours, cost, currentHours, window: bestWindow, score };
    })
    .filter(x => {
      if (!x.window) return false;
      if (x.shiftHours < 1) return false;
      if (x.currentHours + x.shiftHours > x.emp.maxWeeklyHours) return false;
      if (employeeHasConflict(shifts, x.emp.id, req.day, x.window)) return false;
      if (hasRestViolation(shifts, x.emp.id, req.day, x.window, budget.minRestHours)) return false;
      return true;
    })
    .sort((a, b) => {
      const scoreDiff = b.score.total - a.score.total;
      if (Math.abs(scoreDiff) > 5) return scoreDiff;
      return a.cost - b.cost;
    });

  for (const candidate of eligible) {
    if (needed <= 0) break;
    shifts.push({
      employeeId: candidate.emp.id,
      stationId: req.stationId,
      day: req.day,
      timeWindow: candidate.window!,
      shiftCost: candidate.cost,
      score: candidate.score,
    });
    needed--;
  }
}

function adjustRequirementsForDemand(
  requirements: CoverageRequirement[],
  forecast: DemandForecastEntry[],
): CoverageRequirement[] {
  return requirements.map(req => {
    const entry = forecast.find(f =>
      f.day === req.day && f.shift === `${req.timeWindow.start}-${req.timeWindow.end}`
    );
    if (!entry || entry.staffingMultiplier <= 1) return req;
    return {
      ...req,
      requiredCount: Math.ceil(req.requiredCount * entry.staffingMultiplier),
    };
  });
}

function buildValidationSummary(
  shifts: ScheduleShift[],
  employees: Employee[],
  stations: Station[],
  requirements: CoverageRequirement[],
  hoursPerEmployee: Record<string, number>,
  budget: BudgetSettings,
): ValidationSummary {
  const hardConstraintViolations: string[] = [];
  const fairnessIssues: string[] = [];
  const schedulingConflicts: string[] = [];

  // Check coverage
  let coverageComplete = true;
  for (const req of requirements) {
    const station = stations.find(s => s.id === req.stationId);
    if (!station) continue;
    const assigned = shifts.filter(s =>
      s.stationId === req.stationId && s.day === req.day &&
      timeToMinutes(s.timeWindow.start) < timeToMinutes(req.timeWindow.end) &&
      timeToMinutes(req.timeWindow.start) < timeToMinutes(s.timeWindow.end)
    ).length;
    if (assigned < req.requiredCount) {
      coverageComplete = false;
    }
  }

  // Check max hours violations
  for (const emp of employees) {
    const hours = hoursPerEmployee[emp.id] || 0;
    if (hours > emp.maxWeeklyHours) {
      hardConstraintViolations.push(`${emp.name} exceeds max weekly hours (${hours.toFixed(1)}h / ${emp.maxWeeklyHours}h)`);
    }
  }

  // Check fairness - hours distribution
  const allHours = employees.map(e => hoursPerEmployee[e.id] || 0).filter(h => h > 0);
  if (allHours.length >= 2) {
    const avg = allHours.reduce((a, b) => a + b, 0) / allHours.length;
    const maxDeviation = Math.max(...allHours.map(h => Math.abs(h - avg)));
    if (maxDeviation > avg * 0.5 && avg > 0) {
      fairnessIssues.push(`Hours distribution uneven: deviation of ${maxDeviation.toFixed(1)}h from average ${avg.toFixed(1)}h`);
    }
  }

  // Check for overlapping shifts per employee
  for (const emp of employees) {
    const empShifts = shifts.filter(s => s.employeeId === emp.id);
    for (let i = 0; i < empShifts.length; i++) {
      for (let j = i + 1; j < empShifts.length; j++) {
        if (empShifts[i].day === empShifts[j].day) {
          const aStart = timeToMinutes(empShifts[i].timeWindow.start);
          const aEnd = timeToMinutes(empShifts[i].timeWindow.end);
          const bStart = timeToMinutes(empShifts[j].timeWindow.start);
          const bEnd = timeToMinutes(empShifts[j].timeWindow.end);
          if (aStart < bEnd && bStart < aEnd) {
            schedulingConflicts.push(`${emp.name} has overlapping shifts on ${empShifts[i].day}`);
          }
        }
      }
    }
  }

  return { coverageComplete, hardConstraintViolations, fairnessIssues, schedulingConflicts };
}
