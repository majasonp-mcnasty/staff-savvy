import { Employee, Station, CoverageRequirement, BudgetSettings, generateId } from './types';

export const SAMPLE_STATIONS: Station[] = [
  { id: 'st-1', name: 'Cashier', color: 'hsl(215, 90%, 42%)', isCritical: false },
  { id: 'st-2', name: 'Kitchen', color: 'hsl(172, 66%, 40%)', isCritical: false },
  { id: 'st-3', name: 'Supervisor', color: 'hsl(38, 92%, 50%)', isCritical: true },
  { id: 'st-4', name: 'Drive-Thru', color: 'hsl(152, 60%, 40%)', isCritical: false },
];

export const SAMPLE_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1', name: 'Sarah Chen', hourlyWage: 18, maxWeeklyHours: 40,
    performanceRating: 5, seniorityLevel: 'senior',
    qualifiedStations: ['st-1', 'st-2', 'st-3'],
    availability: {
      monday: [{ start: '06:00', end: '16:00' }],
      tuesday: [{ start: '06:00', end: '16:00' }],
      wednesday: [{ start: '06:00', end: '16:00' }],
      thursday: [{ start: '06:00', end: '16:00' }],
      friday: [{ start: '06:00', end: '16:00' }],
      saturday: [], sunday: [],
    },
    timeOff: [],
  },
  {
    id: 'emp-2', name: 'Marcus Johnson', hourlyWage: 15, maxWeeklyHours: 35,
    performanceRating: 4, seniorityLevel: 'mid',
    qualifiedStations: ['st-1', 'st-4'],
    availability: {
      monday: [{ start: '08:00', end: '18:00' }],
      tuesday: [{ start: '08:00', end: '18:00' }],
      wednesday: [],
      thursday: [{ start: '08:00', end: '18:00' }],
      friday: [{ start: '08:00', end: '18:00' }],
      saturday: [{ start: '09:00', end: '17:00' }],
      sunday: [],
    },
    timeOff: [],
  },
  {
    id: 'emp-3', name: 'Emily Rodriguez', hourlyWage: 14, maxWeeklyHours: 30,
    performanceRating: 3, seniorityLevel: 'junior',
    qualifiedStations: ['st-1', 'st-2'],
    availability: {
      monday: [], tuesday: [],
      wednesday: [{ start: '10:00', end: '20:00' }],
      thursday: [{ start: '10:00', end: '20:00' }],
      friday: [{ start: '10:00', end: '20:00' }],
      saturday: [{ start: '09:00', end: '17:00' }],
      sunday: [{ start: '09:00', end: '17:00' }],
    },
  },
  {
    id: 'emp-4', name: 'James Wilson', hourlyWage: 16, maxWeeklyHours: 40,
    performanceRating: 4, seniorityLevel: 'mid',
    qualifiedStations: ['st-2', 'st-3', 'st-4'],
    availability: {
      monday: [{ start: '07:00', end: '15:00' }],
      tuesday: [{ start: '07:00', end: '15:00' }],
      wednesday: [{ start: '07:00', end: '15:00' }],
      thursday: [{ start: '07:00', end: '15:00' }],
      friday: [{ start: '07:00', end: '15:00' }],
      saturday: [{ start: '08:00', end: '14:00' }],
      sunday: [],
    },
  },
  {
    id: 'emp-5', name: 'Aisha Patel', hourlyWage: 13, maxWeeklyHours: 25,
    performanceRating: 3, seniorityLevel: 'junior',
    qualifiedStations: ['st-1', 'st-4'],
    availability: {
      monday: [{ start: '12:00', end: '20:00' }],
      tuesday: [],
      wednesday: [{ start: '12:00', end: '20:00' }],
      thursday: [],
      friday: [{ start: '12:00', end: '20:00' }],
      saturday: [{ start: '10:00', end: '18:00' }],
      sunday: [{ start: '10:00', end: '18:00' }],
    },
  },
];

export const SAMPLE_REQUIREMENTS: CoverageRequirement[] = [
  // Cashier needs 2 people weekdays 8-16
  ...['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => ({
    stationId: 'st-1', day: day as any,
    timeWindow: { start: '08:00', end: '16:00' }, requiredCount: 2,
  })),
  // Kitchen needs 1 person weekdays 8-16
  ...['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => ({
    stationId: 'st-2', day: day as any,
    timeWindow: { start: '08:00', end: '16:00' }, requiredCount: 1,
  })),
  // Supervisor needs 1 senior weekdays 8-16
  ...['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => ({
    stationId: 'st-3', day: day as any,
    timeWindow: { start: '08:00', end: '16:00' }, requiredCount: 1,
    minSeniorityLevel: 'mid' as const,
  })),
  // Weekend cashier
  ...['saturday', 'sunday'].map(day => ({
    stationId: 'st-1', day: day as any,
    timeWindow: { start: '09:00', end: '17:00' }, requiredCount: 1,
  })),
];

export const DEFAULT_BUDGET: BudgetSettings = {
  weeklyBudgetCap: 5000,
  overtimeThreshold: 40,
  overtimeMultiplier: 1.5,
};
