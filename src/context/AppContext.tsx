import React, { createContext, useContext, useState, useCallback } from 'react';
import { Employee, Station, CoverageRequirement, BudgetSettings, ScheduleResult } from '@/lib/types';
import { SAMPLE_EMPLOYEES, SAMPLE_STATIONS, SAMPLE_REQUIREMENTS, DEFAULT_BUDGET } from '@/lib/sample-data';
import { generateSchedule } from '@/lib/scheduling-engine';

interface AppState {
  employees: Employee[];
  stations: Station[];
  requirements: CoverageRequirement[];
  budget: BudgetSettings;
  schedule: ScheduleResult | null;
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  setStations: React.Dispatch<React.SetStateAction<Station[]>>;
  setRequirements: React.Dispatch<React.SetStateAction<CoverageRequirement[]>>;
  setBudget: React.Dispatch<React.SetStateAction<BudgetSettings>>;
  generateNewSchedule: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(SAMPLE_EMPLOYEES);
  const [stations, setStations] = useState<Station[]>(SAMPLE_STATIONS);
  const [requirements, setRequirements] = useState<CoverageRequirement[]>(SAMPLE_REQUIREMENTS);
  const [budget, setBudget] = useState<BudgetSettings>(DEFAULT_BUDGET);
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);

  const generateNewSchedule = useCallback(() => {
    const result = generateSchedule(employees, stations, requirements, budget);
    setSchedule(result);
  }, [employees, stations, requirements, budget]);

  return (
    <AppContext.Provider value={{
      employees, stations, requirements, budget, schedule,
      setEmployees, setStations, setRequirements, setBudget,
      generateNewSchedule,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
