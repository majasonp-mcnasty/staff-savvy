import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Employee, Station, CoverageRequirement, BudgetSettings, ScheduleResult,
  ScoringWeights, ForecastWeights, ForecastInputs,
} from '@/lib/types';
import { SAMPLE_EMPLOYEES, SAMPLE_STATIONS, SAMPLE_REQUIREMENTS, DEFAULT_BUDGET } from '@/lib/sample-data';
import { generateSchedule } from '@/lib/scheduling-engine';
import { DEFAULT_SCORING_WEIGHTS } from '@/lib/scoring-engine';
import { DEFAULT_FORECAST_WEIGHTS, getDefaultForecastInputs } from '@/lib/demand-forecast';
import { weightsAreValid } from '@/lib/validation';
import {
  fetchEmployees, upsertEmployees, deleteEmployee,
  fetchStations, upsertStations, deleteStation,
  fetchRequirements, upsertRequirements, replaceAllRequirements,
  fetchSettings, upsertSettings,
  saveScheduleResult, fetchLatestSchedule,
  supabase,
} from '@/lib/supabase';

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
  employees: Employee[];
  stations: Station[];
  requirements: CoverageRequirement[];
  budget: BudgetSettings;
  schedule: ScheduleResult | null;
  scoringWeights: ScoringWeights;
  forecastWeights: ForecastWeights;
  forecastInputs: ForecastInputs;
  useDemandForecast: boolean;

  employeesDraft: DraftModule<Employee[]>;
  stationsDraft: DraftModule<StationsSnapshot>;
  settingsDraft: DraftModule<SettingsSnapshot>;
  forecastDraft: DraftModule<ForecastInputs>;

  setEmployeesDraft: React.Dispatch<React.SetStateAction<Employee[]>>;
  setStationsDraft: React.Dispatch<React.SetStateAction<StationsSnapshot>>;
  setSettingsDraft: React.Dispatch<React.SetStateAction<SettingsSnapshot>>;
  setForecastDraft: React.Dispatch<React.SetStateAction<ForecastInputs>>;

  saveEmployees: () => Promise<boolean>;
  discardEmployees: () => void;
  saveStations: () => Promise<boolean>;
  discardStations: () => void;
  saveSettings: () => Promise<boolean>;
  discardSettings: () => void;
  saveForecast: () => Promise<boolean>;
  discardForecast: () => void;

  anyDirty: boolean;
  dirtyModules: { employees: boolean; stations: boolean; settings: boolean; forecast: boolean };

  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  dbLoading: boolean;

  setSchedule: React.Dispatch<React.SetStateAction<ScheduleResult | null>>;
  generateNewSchedule: () => void;
}

const AppContext = createContext<AppState | null>(null);

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [dbLoading, setDbLoading] = useState(true);

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

  // ── Draft state ──
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

  // ── Load from Supabase on mount ──
  useEffect(() => {
    async function loadFromDB() {
      try {
        const [dbEmployees, dbStations, dbRequirements, dbSettings, dbSchedule] = await Promise.all([
          fetchEmployees(),
          fetchStations(),
          fetchRequirements(),
          fetchSettings(),
          fetchLatestSchedule(),
        ]);

        // If DB has data, use it; otherwise seed with sample data
        if (dbEmployees.length > 0) {
          setEmployees(dbEmployees);
          setEmpDraft(dbEmployees);
        } else {
          await upsertEmployees(SAMPLE_EMPLOYEES);
        }

        if (dbStations.length > 0) {
          setStations(dbStations);
          setRequirements(dbRequirements);
          setStaDraft({ stations: dbStations, requirements: dbRequirements });
        } else {
          await upsertStations(SAMPLE_STATIONS);
          await replaceAllRequirements(SAMPLE_REQUIREMENTS);
        }

        if (dbSettings) {
          setBudget(dbSettings.budget);
          setScoringWeights(dbSettings.scoringWeights);
          setForecastWeights(dbSettings.forecastWeights);
          setForecastInputs(dbSettings.forecastInputs);
          setUseDemandForecast(dbSettings.useDemandForecast);
          setSetDraft({
            budget: dbSettings.budget,
            scoringWeights: dbSettings.scoringWeights,
            forecastWeights: dbSettings.forecastWeights,
            useDemandForecast: dbSettings.useDemandForecast,
          });
          setFcDraft(dbSettings.forecastInputs);
        } else {
          await upsertSettings({
            budget: DEFAULT_BUDGET,
            scoringWeights: DEFAULT_SCORING_WEIGHTS,
            forecastWeights: DEFAULT_FORECAST_WEIGHTS,
            forecastInputs: getDefaultForecastInputs(),
            useDemandForecast: true,
          });
        }

        if (dbSchedule) setSchedule(dbSchedule);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Failed to load from Supabase, using defaults:', err);
        toast.error(`Failed to load data from database: ${msg}. Using defaults.`);
      } finally {
        setDbLoading(false);
      }
    }
    loadFromDB();
  }, []);

  // ── Realtime subscriptions ──
  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, async () => {
        const data = await fetchEmployees();
        setEmployees(data);
        setEmpDraft(data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, async () => {
        const data = await fetchStations();
        setStations(data);
        setStaDraft(prev => ({ ...prev, stations: data }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coverage_requirements' }, async () => {
        const data = await fetchRequirements();
        setRequirements(data);
        setStaDraft(prev => ({ ...prev, requirements: data }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, async () => {
        const data = await fetchSettings();
        if (!data) return;
        setBudget(data.budget);
        setScoringWeights(data.scoringWeights);
        setForecastWeights(data.forecastWeights);
        setForecastInputs(data.forecastInputs);
        setUseDemandForecast(data.useDemandForecast);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_results' }, async () => {
        const data = await fetchLatestSchedule();
        if (data) setSchedule(data);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Dirty detection ──
  const empDirty = !isEqual(empDraft, employees);
  const staDirty = !isEqual(staDraft, { stations, requirements });
  const setDirty = !isEqual(setDraft, { budget, scoringWeights, forecastWeights, useDemandForecast });
  const fcDirty = !isEqual(fcDraft, forecastInputs);
  const anyDirty = empDirty || staDirty || setDirty || fcDirty;

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

  const markSaved = () => {
    setLastSavedAt(new Date().toLocaleTimeString());
    setSaveStatus('saved');
  };

  // ── Save functions (now persist to Supabase) ──
  const saveEmployees = useCallback(async (): Promise<boolean> => {
    for (const emp of empDraft) {
      if (!emp.name.trim()) return false;
      if (emp.performanceRating < 1 || emp.performanceRating > 5) return false;
    }
    setSaveStatus('saving');
    try {
      const removedIds = employees.filter(e => !empDraft.find(d => d.id === e.id)).map(e => e.id);
      await Promise.all(removedIds.map(deleteEmployee));
      await upsertEmployees(empDraft);
      setEmployees([...empDraft]);
      markSaved();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[saveEmployees]', err);
      setSaveStatus('error');
      toast.error(`Failed to save employees: ${msg}`);
      return false;
    }
  }, [empDraft, employees]);

  const discardEmployees = useCallback(() => {
    setEmpDraft([...employees]);
  }, [employees]);

  const saveStations = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');
    try {
      const removedStationIds = stations.filter(s => !staDraft.stations.find(d => d.id === s.id)).map(s => s.id);
      await Promise.all(removedStationIds.map(deleteStation));
      await upsertStations(staDraft.stations);
      await replaceAllRequirements(staDraft.requirements);
      setStations([...staDraft.stations]);
      setRequirements([...staDraft.requirements]);
      markSaved();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[saveStations]', err);
      setSaveStatus('error');
      toast.error(`Failed to save stations: ${msg}`);
      return false;
    }
  }, [staDraft, stations]);

  const discardStations = useCallback(() => {
    setStaDraft({ stations: [...stations], requirements: [...requirements] });
  }, [stations, requirements]);

  const saveSettings = useCallback(async (): Promise<boolean> => {
    if (!weightsAreValid(setDraft.scoringWeights)) return false;
    if (setDraft.useDemandForecast && !weightsAreValid(setDraft.forecastWeights)) return false;
    setSaveStatus('saving');
    try {
      await upsertSettings({
        budget: setDraft.budget,
        scoringWeights: setDraft.scoringWeights,
        forecastWeights: setDraft.forecastWeights,
        forecastInputs: fcDraft,
        useDemandForecast: setDraft.useDemandForecast,
      });
      setBudget({ ...setDraft.budget });
      setScoringWeights({ ...setDraft.scoringWeights });
      setForecastWeights({ ...setDraft.forecastWeights });
      setUseDemandForecast(setDraft.useDemandForecast);
      markSaved();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[saveSettings]', err);
      setSaveStatus('error');
      toast.error(`Failed to save settings: ${msg}`);
      return false;
    }
  }, [setDraft, fcDraft]);

  const discardSettings = useCallback(() => {
    setSetDraft({ budget, scoringWeights, forecastWeights, useDemandForecast });
  }, [budget, scoringWeights, forecastWeights, useDemandForecast]);

  const saveForecast = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');
    try {
      await upsertSettings({
        budget,
        scoringWeights,
        forecastWeights,
        forecastInputs: fcDraft,
        useDemandForecast,
      });
      setForecastInputs({ ...fcDraft });
      markSaved();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[saveForecast]', err);
      setSaveStatus('error');
      toast.error(`Failed to save forecast data: ${msg}`);
      return false;
    }
  }, [fcDraft, budget, scoringWeights, forecastWeights, useDemandForecast]);

  const discardForecast = useCallback(() => {
    setFcDraft({ ...forecastInputs });
  }, [forecastInputs]);

  // ── Schedule generation ──
  const generateNewSchedule = useCallback(() => {
    const result = generateSchedule(employees, stations, requirements, budget, {
      scoringWeights, forecastWeights, forecastInputs, useDemandForecast,
    });
    setSchedule(result);
    saveScheduleResult(result).catch(console.error);
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
      dbLoading,
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
