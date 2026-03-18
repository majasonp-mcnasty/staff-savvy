import { DAYS_OF_WEEK, DayOfWeek, ScheduleShift, shiftDurationHours } from './types';

/**
 * Recalculate schedule totals from a shifts array.
 * Used after drag-drop or undo operations.
 */
export function recalculateScheduleTotals(shifts: ScheduleShift[]) {
  const totalCost = shifts.reduce((sum, s) => sum + s.shiftCost, 0);

  const hoursPerEmployee: Record<string, number> = {};
  for (const s of shifts) {
    hoursPerEmployee[s.employeeId] = (hoursPerEmployee[s.employeeId] || 0) + shiftDurationHours(s.timeWindow);
  }

  const costPerDay = {} as Record<DayOfWeek, number>;
  for (const d of DAYS_OF_WEEK) {
    costPerDay[d] = shifts.filter(s => s.day === d).reduce((sum, s) => sum + s.shiftCost, 0);
  }

  return { totalCost, hoursPerEmployee, costPerDay };
}
