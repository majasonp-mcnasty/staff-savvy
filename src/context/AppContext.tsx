import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import {
  Employee, Station, CoverageRequirement, BudgetSettings, ScheduleResult,
  ScoringWeights, ForecastWeights, ForecastInputs,
} from '@/lib/types';
import { SAMPLE_EMPLOYEES, SAMPLE_STATIONS, SAMPLE_REQUIREMENTS, DEFAULT_BUDGET } from '@/lib/sample-data';
import { generateSchedule } from '@/lib/scheduling-engine';
import { DEFAULT_SCORING_WEIGHTS } from '@/lib/scoring-engine';
import { DEFAULT_FORECAST_WEIGHTS, getDefaultForecastInputs } from '@/lib/demand-forecast';

// ── Draft module types ──
interface DraftModule<T> {
  saved: T;
  draft: T;
  isDirty: boolean;
}

interface SettingsSnapshot {
  budget: BudgetSettings;
  scoringWeights: ScoringWeights;
  forecastWeights: ForecastWeights;
  useDemandForecast: boolean;
}

interface StationsSnapshot {
  stations: Station[];
  requirements: CoverageRequirement[];
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

interface AppState {
  // Committed state
  employees: Employee[];
  stations: Station[];
  requirements: CoverageRequirement[];
  budget: BudgetSettings;
  schedule: ScheduleResult | null;
  scoringWeights: ScoringWeights;
  forecastWeights: ForecastWeights;
  forecastInputs: ForecastInputs;
  useDemandForecast: boolean;

  // Draft modules
  employeesDraft: DraftModule<Employee[]>;
  stationsDraft: DraftModule<StationsSnapshot>;
  settingsDraft: DraftModule<SettingsSnapshot>;
  forecastDraft: DraftModule<ForecastInputs>;

  // Draft setters
  setEmployeesDraft: React.Dispatch<React.SetStateAction<Employee[]>>;
  setStationsDraft: React.Dispatch<React.SetStateAction<StationsSnapshot>>;
  setSettingsDraft: React.Dispatch<React.SetStateAction<SettingsSnapshot>>;
  setForecastDraft: React.Dispatch<React.SetStateAction<ForecastInputs>>;

  // Save/discard per section
  saveEmployees: () => boolean;
  discardEmployees: () => void;
  saveStations: () => boolean;
  discardStations: () => void;
  saveSettings: () => boolean;
  discardSettings: () => void;
  saveForecast: () => boolean;
  discardForecast: () => void;

  // Global dirty
  anyDirty: boolean;
  dirtyModules: { employees: boolean; stations: boolean; settings: boolean; forecast: boolean };

  // Global save status
  saveStatus: SaveStatus;
  lastSavedAt: string | null;

  // Schedule
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleResult | null>>;
  generateNewSchedule: () => void;
}

const AppContext = createContext<AppState | null>(null);

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // ── Committed (saved) state ──
  const [employees, setEmployees] = useState<Employee[]>(SAMPLE_EMPLOYEES);
  const [stations, setStations] = useState<Station[]>(SAMPLE_STATIONS);
  const [requirements, setRequirements] = useState<CoverageRequirement[]>(SAMPLE_REQUIREMENTS);
  const [budget, setBudget] = useState<BudgetSettings>(DEFAULT_BUDGET);
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [scoringWeights, setScoringWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [forecastWeights, setForecastWeights] = useState<ForecastWeights>(DEFAULT_FORECAST_WEIGHTS);
  const [forecastInputs, setForecastInputs] = useState<ForecastInputs>(getDefaultForecastInputs());
  const [useDemandForecast, setUseDemandForecast] = useState(true);

  // ── Draft state (persists across navigation) ──
  const [empDraft, setEmpDraft] = useState<Employee[]>(SAMPLE_EMPLOYEES);
  const [staDraft, setStaDraft] = useState<StationsSnapshot>({ stations: SAMPLE_STATIONS, requirements: SAMPLE_REQUIREMENTS });
  const [setDraft, setSetDraft] = useState<SettingsSnapshot>({
    budget: DEFAULT_BUDGET,
    scoringWeights: DEFAULT_SCORING_WEIGHTS,
    forecastWeights: DEFAULT_FORECAST_WEIGHTS,
    useDemandForecast: true,
  });
  const [fcDraft, setFcDraft] = useState<ForecastInputs>(getDefaultForecastInputs());

  // ── Save status ──
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // ── Dirty detection ──
  const empDirty = !isEqual(empDraft, employees);
  const staDirty = !isEqual(staDraft, { stations, requirements });
  const setDirty = !isEqual(setDraft, { budget, scoringWeights, forecastWeights, useDemandForecast });
  const fcDirty = !isEqual(fcDraft, forecastInputs);
  const anyDirty = empDirty || staDirty || setDirty || fcDirty;

  // Update global save status
  useEffect(() => {
    setSaveStatus(anyDirty ? 'unsaved' : 'saved');
  }, [anyDirty]);

  // ── Browser close warning ──
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  // ── Save functions ──
  const markSaved = () => {
    setLastSavedAt(new Date().toLocaleTimeString());
    setSaveStatus('saved');
  };

  const saveEmployees = useCallback(() => {
    for (const emp of empDraft) {
      if (!emp.name.trim()) return false;
      if (emp.performanceRating < 1 || emp.performanceRating > 5) return false;
    }
    setEmployees([...empDraft]);
    markSaved();
    return true;
  }, [empDraft]);

  const discardEmployees = useCallback(() => {
    setEmpDraft([...employees]);
  }, [employees]);

  const saveStations = useCallback(() => {
    setStations([...staDraft.stations]);
    setRequirements([...staDraft.requirements]);
    markSaved();
    return true;
  }, [staDraft]);

  const discardStations = useCallback(() => {
    setStaDraft({ stations: [...stations], requirements: [...requirements] });
  }, [stations, requirements]);

  const saveSettings = useCallback(() => {
    const sSum = setDraft.scoringWeights.availability + setDraft.scoringWeights.experience +
      setDraft.scoringWeights.preference + setDraft.scoringWeights.fairness;
    if (Math.abs(sSum - 1) >= 0.01) return false;
    if (setDraft.useDemandForecast) {
      const fSum = setDraft.forecastWeights.historicalSales + setDraft.forecastWeights.events +
        setDraft.forecastWeights.weather + setDraft.forecastWeights.seasonal;
      if (Math.abs(fSum - 1) >= 0.01) return false;
    }
    setBudget({ ...setDraft.budget });
    setScoringWeights({ ...setDraft.scoringWeights });
    setForecastWeights({ ...setDraft.forecastWeights });
    setUseDemandForecast(setDraft.useDemandForecast);
    markSaved();
    return true;
  }, [setDraft]);

  const discardSettings = useCallback(() => {
    setSetDraft({ budget, scoringWeights, forecastWeights, useDemandForecast });
  }, [budget, scoringWeights, forecastWeights, useDemandForecast]);

  const saveForecast = useCallback(() => {
    setForecastInputs({ ...fcDraft });
    markSaved();
    return true;
  }, [fcDraft]);

  const discardForecast = useCallback(() => {
    setFcDraft({ ...forecastInputs });
  }, [forecastInputs]);

  // ── Schedule generation ──
  const generateNewSchedule = useCallback(() => {
    const result = generateSchedule(employees, stations, requirements, budget, {
      scoringWeights, forecastWeights, forecastInputs, useDemandForecast,
    });
    setSchedule(result);
  }, [employees, stations, requirements, budget, scoringWeights, forecastWeights, forecastInputs, useDemandForecast]);

  // ── Draft modules ──
  const employeesDraft: DraftModule<Employee[]> = { saved: employees, draft: empDraft, isDirty: empDirty };
  const stationsDraft: DraftModule<StationsSnapshot> = { saved: { stations, requirements }, draft: staDraft, isDirty: staDirty };
  const settingsDraft: DraftModule<SettingsSnapshot> = {
    saved: { budget, scoringWeights, forecastWeights, useDemandForecast },
    draft: setDraft, isDirty: setDirty,
  };
  const forecastDraftMod: DraftModule<ForecastInputs> = { saved: forecastInputs, draft: fcDraft, isDirty: fcDirty };

  const dirtyModules = useMemo(() => ({
    employees: empDirty,
    stations: staDirty,
    settings: setDirty,
    forecast: fcDirty,
  }), [empDirty, staDirty, setDirty, fcDirty]);

  return (
    <AppContext.Provider value={{
      employees, stations, requirements, budget, schedule,
      scoringWeights, forecastWeights, forecastInputs, useDemandForecast,
      employeesDraft, stationsDraft, settingsDraft, forecastDraft: forecastDraftMod,
      setEmployeesDraft: setEmpDraft, setStationsDraft: setStaDraft,
      setSettingsDraft: setSetDraft, setForecastDraft: setFcDraft,
      saveEmployees, discardEmployees,
      saveStations, discardStations,
      saveSettings, discardSettings,
      saveForecast, discardForecast,
      anyDirty, dirtyModules, saveStatus, lastSavedAt,
      setSchedule, generateNewSchedule,
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
