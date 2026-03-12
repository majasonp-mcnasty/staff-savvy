import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Employee, Station, CoverageRequirement, BudgetSettings, ScheduleResult,
  ScoringWeights, ForecastWeights, ForecastInputs,
} from '@/lib/types';
import { SAMPLE_EMPLOYEES, SAMPLE_STATIONS, SAMPLE_REQUIREMENTS, DEFAULT_BUDGET } from '@/lib/sample-data';
import { generateSchedule } from '@/lib/scheduling-engine';
import { DEFAULT_SCORING_WEIGHTS } from '@/lib/scoring-engine';
import { DEFAULT_FORECAST_WEIGHTS, getDefaultForecastInputs } from '@/lib/demand-forecast';

interface AppState {
  employees: Employee[];
  stations: Station[];
  requirements: CoverageRequirement[];
  budget: BudgetSettings;
  schedule: ScheduleResult | null;
  scoringWeights: ScoringWeights;
  forecastWeights: ForecastWeights;
  forecastInputs: ForecastInputs;
  useDemandForecast: boolean;
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  setStations: React.Dispatch<React.SetStateAction<Station[]>>;
  setRequirements: React.Dispatch<React.SetStateAction<CoverageRequirement[]>>;
  setBudget: React.Dispatch<React.SetStateAction<BudgetSettings>>;
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleResult | null>>;
  setScoringWeights: React.Dispatch<React.SetStateAction<ScoringWeights>>;
  setForecastWeights: React.Dispatch<React.SetStateAction<ForecastWeights>>;
  setForecastInputs: React.Dispatch<React.SetStateAction<ForecastInputs>>;
  setUseDemandForecast: React.Dispatch<React.SetStateAction<boolean>>;
  generateNewSchedule: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(SAMPLE_EMPLOYEES);
  const [stations, setStations] = useState<Station[]>(SAMPLE_STATIONS);
  const [requirements, setRequirements] = useState<CoverageRequirement[]>(SAMPLE_REQUIREMENTS);
  const [budget, setBudget] = useState<BudgetSettings>(DEFAULT_BUDGET);
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [scoringWeights, setScoringWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [forecastWeights, setForecastWeights] = useState<ForecastWeights>(DEFAULT_FORECAST_WEIGHTS);
  const [forecastInputs, setForecastInputs] = useState<ForecastInputs>(getDefaultForecastInputs());
  const [useDemandForecast, setUseDemandForecast] = useState(true);

  const generateNewSchedule = useCallback(() => {
    const result = generateSchedule(employees, stations, requirements, budget, {
      scoringWeights,
      forecastWeights,
      forecastInputs,
      useDemandForecast,
    });
    setSchedule(result);
  }, [employees, stations, requirements, budget, scoringWeights, forecastWeights, forecastInputs, useDemandForecast]);

  return (
    <AppContext.Provider value={{
      employees, stations, requirements, budget, schedule,
      scoringWeights, forecastWeights, forecastInputs, useDemandForecast,
      setEmployees, setStations, setRequirements, setBudget,
      setScoringWeights, setForecastWeights, setForecastInputs, setUseDemandForecast,
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
