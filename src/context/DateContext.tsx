import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks, format,
  eachDayOfInterval, isToday, parseISO,
} from 'date-fns';
import { DayOfWeek } from '@/lib/types';

export interface DateContextValue {
  today: Date;
  weekStart: Date;
  currentWeek: Date[];
  currentWeekLabel: string;
  navigateWeek: (direction: 'prev' | 'next') => void;
  navigateToToday: () => void;
  formatDate: (date: Date, fmt: string) => string;
  dayOfWeekToDate: (day: DayOfWeek) => Date;
  dateToDayOfWeek: (date: Date) => DayOfWeek;
  isCurrentWeek: boolean;
}

const DAY_NAME_TO_DOW: Record<string, DayOfWeek> = {
  Monday: 'monday', Tuesday: 'tuesday', Wednesday: 'wednesday',
  Thursday: 'thursday', Friday: 'friday', Saturday: 'saturday', Sunday: 'sunday',
};

const DateContext = createContext<DateContextValue | null>(null);

export function DateProvider({ children }: { children: React.ReactNode }) {
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const currentWeek = useMemo(() =>
    eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) }),
    [weekStart]
  );

  const currentWeekLabel = useMemo(() => {
    const s = currentWeek[0];
    const e = currentWeek[6];
    if (format(s, 'MMM yyyy') === format(e, 'MMM yyyy')) {
      return `${format(s, 'MMMM d')} – ${format(e, 'd, yyyy')}`;
    }
    if (format(s, 'yyyy') === format(e, 'yyyy')) {
      return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
    }
    return `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`;
  }, [currentWeek]);

  const isCurrentWeek = useMemo(() =>
    format(weekStart, 'yyyy-MM-dd') === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    [weekStart]
  );

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    setWeekStart(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
  }, []);

  const navigateToToday = useCallback(() => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }, []);

  const formatDate = useCallback((date: Date, fmt: string) => format(date, fmt), []);

  // Map a DayOfWeek string to the actual Date in the current week
  const dayOfWeekToDate = useCallback((day: DayOfWeek): Date => {
    const idx: Record<DayOfWeek, number> = {
      monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
      friday: 4, saturday: 5, sunday: 6,
    };
    return currentWeek[idx[day]];
  }, [currentWeek]);

  const dateToDayOfWeek = useCallback((date: Date): DayOfWeek => {
    const name = format(date, 'EEEE');
    return DAY_NAME_TO_DOW[name] ?? 'monday';
  }, []);

  return (
    <DateContext.Provider value={{
      today, weekStart, currentWeek, currentWeekLabel,
      navigateWeek, navigateToToday, formatDate,
      dayOfWeekToDate, dateToDayOfWeek, isCurrentWeek,
    }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDateContext(): DateContextValue {
  const ctx = useContext(DateContext);
  if (!ctx) throw new Error('useDateContext must be used within DateProvider');
  return ctx;
}

/** Format a TimeWindow string "HH:MM" to "9:00 AM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/** Format "HH:MM" – "HH:MM" as "9 AM – 5 PM" */
export function formatTimeWindow(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Parse an ISO date string safely, returning null on failure */
export function safeParse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try { return parseISO(iso); } catch { return null; }
}
