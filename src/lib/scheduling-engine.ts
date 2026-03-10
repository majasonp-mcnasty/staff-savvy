import {
  Employee, Station, CoverageRequirement, ScheduleResult, ScheduleShift,
  BudgetSettings, DayOfWeek, DAYS_OF_WEEK, timeToMinutes, shiftDurationHours,
  TimeWindow
} from './types';

const SENIORITY_RANK: Record<string, number> = { junior: 1, mid: 2, senior: 3 };

const DAY_INDEX: Record<DayOfWeek, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
};

const SENIORITY_RANK: Record<string, number> = { junior: 1, mid: 2, senior: 3 };

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
    // Previous day: check gap between end of prev shift and start of this shift
    if (sDayIdx === dayIdx - 1 || (dayIdx === 0 && sDayIdx === 6)) {
      const prevEnd = timeToMinutes(s.timeWindow.end);
      const gap = (24 * 60 - prevEnd) + shiftStart;
      if (gap < minRestMinutes) return true;
    }
    // Next day: check gap between end of this shift and start of next shift
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

export function generateSchedule(
  employees: Employee[],
  stations: Station[],
  requirements: CoverageRequirement[],
  budget: BudgetSettings
): ScheduleResult {
  const shifts: ScheduleShift[] = [];
  const overtimeWarnings: string[] = [];
  const understaffedAlerts: string[] = [];

  // Sort requirements: critical stations first, then by required count desc
  const sortedReqs = [...requirements].sort((a, b) => {
    const stA = stations.find(s => s.id === a.stationId);
    const stB = stations.find(s => s.id === b.stationId);
    if (stA?.isCritical && !stB?.isCritical) return -1;
    if (!stA?.isCritical && stB?.isCritical) return 1;
    return b.requiredCount - a.requiredCount;
  });

  for (const req of sortedReqs) {
    const station = stations.find(s => s.id === req.stationId);
    if (!station) continue;

    let assigned = 0;

    // Find eligible employees sorted by cost-effectiveness
    const eligible = employees
      .filter(emp => {
        if (!emp.qualifiedStations.includes(req.stationId)) return false;
        if (req.minSeniorityLevel && SENIORITY_RANK[emp.seniorityLevel] < SENIORITY_RANK[req.minSeniorityLevel]) return false;
        // Check availability
        const dayAvail = emp.availability[req.day] || [];
        return dayAvail.some(tw => overlaps(tw, req.timeWindow));
      })
      .map(emp => {
        const currentHours = totalEmployeeHours(shifts, emp.id);
        const dayAvail = emp.availability[req.day] || [];
        const bestWindow = dayAvail
          .map(tw => intersection(tw, req.timeWindow))
          .filter(Boolean)
          .sort((a, b) => shiftDurationHours(b!) - shiftDurationHours(a!))[0];
        const shiftHours = bestWindow ? shiftDurationHours(bestWindow) : 0;
        const cost = calculateShiftCost(shiftHours, emp.hourlyWage, currentHours, budget);

        return { emp, shiftHours, cost, currentHours, window: bestWindow };
      })
      .filter(x => {
        if (!x.window) return false;
        if (x.shiftHours < 1) return false; // avoid fragmented shifts < 1hr
        if (x.currentHours + x.shiftHours > x.emp.maxWeeklyHours) return false;
        if (employeeHasConflict(shifts, x.emp.id, req.day, x.window)) return false;
        return true;
      })
      .sort((a, b) => {
        // For critical stations, prefer higher-rated employees
        if (station.isCritical) {
          const ratingDiff = b.emp.performanceRating - a.emp.performanceRating;
          if (ratingDiff !== 0) return ratingDiff;
        }
        // Then sort by cost (ascending)
        return a.cost - b.cost;
      });

    for (const candidate of eligible) {
      if (assigned >= req.requiredCount) break;

      shifts.push({
        employeeId: candidate.emp.id,
        stationId: req.stationId,
        day: req.day,
        timeWindow: candidate.window!,
      });
      assigned++;
    }

    if (assigned < req.requiredCount) {
      understaffedAlerts.push(
        `${station.name} on ${req.day} (${req.timeWindow.start}-${req.timeWindow.end}): need ${req.requiredCount}, assigned ${assigned}`
      );
    }
  }

  // Calculate costs and check overtime
  const hoursPerEmployee: Record<string, number> = {};
  const costPerDay: Record<DayOfWeek, number> = {} as any;
  let totalCost = 0;

  for (const day of DAYS_OF_WEEK) {
    costPerDay[day] = 0;
  }

  for (const emp of employees) {
    hoursPerEmployee[emp.id] = totalEmployeeHours(shifts, emp.id);
    if (hoursPerEmployee[emp.id] > budget.overtimeThreshold) {
      overtimeWarnings.push(
        `${emp.name}: ${hoursPerEmployee[emp.id].toFixed(1)}h (overtime threshold: ${budget.overtimeThreshold}h)`
      );
    }
  }

  for (const shift of shifts) {
    const emp = employees.find(e => e.id === shift.employeeId);
    if (!emp) continue;
    const hours = shiftDurationHours(shift.timeWindow);
    const cost = hours * emp.hourlyWage; // simplified for display
    costPerDay[shift.day] += cost;
    totalCost += cost;
  }

  // Budget warnings
  if (budget.weeklyBudgetCap && totalCost > budget.weeklyBudgetCap) {
    overtimeWarnings.unshift(
      `⚠️ Total cost $${totalCost.toFixed(2)} exceeds budget cap $${budget.weeklyBudgetCap.toFixed(2)}`
    );
  }

  return {
    shifts,
    totalCost,
    costPerDay,
    hoursPerEmployee,
    overtimeWarnings,
    understaffedAlerts,
    generatedAt: new Date().toISOString(),
  };
}
