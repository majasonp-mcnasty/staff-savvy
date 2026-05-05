import { useState, useRef, useCallback } from 'react';
import { useAppState } from '@/context/AppContext';
import { useDateContext } from '@/context/DateContext';
import {
  Station, CoverageRequirement, generateId,
  DAYS_OF_WEEK, DAY_LABELS, DayOfWeek,
} from '@/lib/types';
import {
  Plus, Pencil, Trash2, Shield, Check, ChevronDown, ChevronUp,
  LayoutGrid, Star, Copy,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import UnsavedChangesBar from '@/components/UnsavedChangesBar';
import { upsertRequirements, deleteRequirement, upsertStations } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  'hsl(215, 90%, 42%)', 'hsl(172, 66%, 40%)', 'hsl(38, 92%, 50%)',
  'hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)',
];

// 30-minute time slots 00:00–23:30
const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

function formatTimeOpt(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return m === 0 ? `${hr} ${ampm}` : `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const SENIORITY_OPTIONS = [
  { value: 'junior' as const, label: 'Junior' },
  { value: 'mid' as const, label: 'Mid' },
  { value: 'senior' as const, label: 'Senior' },
];

const SENIORITY_TOOLTIP: Record<string, string> = {
  junior: 'Any qualified employee can man this station.',
  mid: 'Requires a mid-level or senior employee.',
  senior: 'Must be manned by the highest-ranked senior employee whose qualifiedStations includes this station.',
};

const SENIORITY_BADGE: Record<string, string> = {
  junior: 'bg-muted text-muted-foreground',
  mid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  senior: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ─── Seniority Segmented Toggle ───────────────────────────────────────────────

interface SeniorityToggleProps {
  value: 'junior' | 'mid' | 'senior';
  onChange: (v: 'junior' | 'mid' | 'senior') => void;
  size?: 'sm' | 'xs';
}

function SeniorityToggle({ value, onChange, size = 'sm' }: SeniorityToggleProps) {
  const px = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      {SENIORITY_OPTIONS.map(opt => (
        <Tooltip key={opt.value} delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange(opt.value)}
              className={`${px} font-medium transition-colors ${
                value === opt.value
                  ? opt.value === 'senior'
                    ? 'bg-yellow-400/80 text-yellow-900 dark:bg-yellow-500/40 dark:text-yellow-200'
                    : opt.value === 'mid'
                      ? 'bg-blue-500 text-white'
                      : 'bg-muted-foreground/20 text-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted/60'
              }`}
            >
              {opt.value === 'senior' && value === 'senior' && <Star className="w-2.5 h-2.5 inline mr-0.5 fill-yellow-600" />}
              {opt.label}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-52">{SENIORITY_TOOLTIP[opt.value]}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// ─── Time Select ──────────────────────────────────────────────────────────────

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {TIME_OPTIONS.map(t => (
        <option key={t} value={t}>{formatTimeOpt(t)}</option>
      ))}
    </select>
  );
}

// ─── Shift Row (Morning or Night) ─────────────────────────────────────────────

interface ShiftRowProps {
  label: 'Morning Shift' | 'Night Shift';
  shiftType: 'morning' | 'night';
  req: (CoverageRequirement & { id: string }) | null;
  stationId: string;
  day: DayOfWeek;
  onToggle: (on: boolean) => void;
  onChange: (updates: Partial<CoverageRequirement>) => void;
  saveState: SaveState;
}

function ShiftRow({ label, shiftType, req, stationId, day, onToggle, onChange, saveState }: ShiftRowProps) {
  const isOn = req !== null && req.isActive;
  const defaults = shiftType === 'morning'
    ? { start: '06:00', end: '12:00' }
    : { start: '16:00', end: '23:00' };

  const timeWindow = req?.timeWindow ?? defaults;
  const count = req?.requiredCount ?? 1;
  const seniority: 'junior' | 'mid' | 'senior' = req?.minSeniorityLevel ?? 'junior';

  return (
    <div className={`rounded-lg border p-3 transition-opacity ${isOn ? 'border-border' : 'border-border/40 opacity-50'}`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Switch
            checked={isOn}
            onCheckedChange={onToggle}
            className="scale-90"
          />
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {saveState === 'saving' && <span className="text-[10px] text-muted-foreground animate-pulse ml-1">Saving…</span>}
          {saveState === 'saved' && <span className="text-[10px] text-success flex items-center gap-0.5 ml-1"><Check className="w-2.5 h-2.5" />Saved</span>}
          {saveState === 'error' && <span className="text-[10px] text-destructive ml-1">Save failed</span>}
        </div>
      </div>

      {isOn && (
        <div className="space-y-2">
          {/* Time row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground w-10">Start</span>
            <TimeSelect value={timeWindow.start} onChange={v => onChange({ timeWindow: { ...timeWindow, start: v } })} />
            <span className="text-[10px] text-muted-foreground">to</span>
            <TimeSelect value={timeWindow.end} onChange={v => onChange({ timeWindow: { ...timeWindow, end: v } })} />
          </div>

          {/* Count + seniority row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Staff</span>
              <div className="flex items-center bg-muted rounded-md overflow-hidden">
                <button
                  onClick={() => onChange({ requiredCount: Math.max(0, count - 1) })}
                  className="px-1.5 py-1 hover:bg-muted/60 text-xs"
                  disabled={count <= 0}
                >−</button>
                <span className="px-2 text-xs font-semibold min-w-[20px] text-center">{count}</span>
                <button
                  onClick={() => onChange({ requiredCount: Math.min(10, count + 1) })}
                  className="px-1.5 py-1 hover:bg-muted/60 text-xs"
                  disabled={count >= 10}
                >+</button>
              </div>
            </div>
            <SeniorityToggle
              value={seniority}
              onChange={v => onChange({ minSeniorityLevel: v })}
              size="xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Day Coverage Panel ───────────────────────────────────────────────────────

interface DayCoveragePanelProps {
  day: DayOfWeek;
  dayDate: Date | undefined;
  stationId: string;
  morningReq: (CoverageRequirement & { id: string }) | null;
  nightReq: (CoverageRequirement & { id: string }) | null;
  onToggleShift: (type: 'morning' | 'night', on: boolean) => void;
  onChangeShift: (type: 'morning' | 'night', updates: Partial<CoverageRequirement>) => void;
  morningState: SaveState;
  nightState: SaveState;
  onCopyDay: (target: 'tomorrow' | 'weekdays' | 'weekend' | 'all') => void;
}

function DayCoveragePanel({
  day, dayDate, stationId, morningReq, nightReq,
  onToggleShift, onChangeShift, morningState, nightState, onCopyDay,
}: DayCoveragePanelProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {dayDate ? format(dayDate, 'EEEE, MMM d') : DAY_LABELS[day]}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors">
              <Copy className="w-3 h-3" /> Copy to…
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onSelect={() => onCopyDay('tomorrow')}>Copy to Tomorrow</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCopyDay('weekdays')}>Copy to Weekdays (Mon–Fri)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCopyDay('weekend')}>Copy to Weekend (Sat–Sun)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCopyDay('all')}>Copy to All Week</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ShiftRow
        label="Morning Shift"
        shiftType="morning"
        req={morningReq}
        stationId={stationId}
        day={day}
        onToggle={on => onToggleShift('morning', on)}
        onChange={updates => onChangeShift('morning', updates)}
        saveState={morningState}
      />
      <ShiftRow
        label="Night Shift"
        shiftType="night"
        req={nightReq}
        stationId={stationId}
        day={day}
        onToggle={on => onToggleShift('night', on)}
        onChange={updates => onChangeShift('night', updates)}
        saveState={nightState}
      />
    </div>
  );
}

// ─── Coverage summary line ────────────────────────────────────────────────────

function buildCoverageSummary(reqs: (CoverageRequirement & { id: string })[]): string {
  const activeByDay: Partial<Record<DayOfWeek, string[]>> = {};
  for (const req of reqs) {
    if (!req.isActive) continue;
    if (!activeByDay[req.day]) activeByDay[req.day] = [];
    activeByDay[req.day]!.push(req.shiftType);
  }

  const weekdayDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const weekendDays: DayOfWeek[] = ['saturday', 'sunday'];

  const describeDay = (day: DayOfWeek) => {
    const shifts = activeByDay[day] ?? [];
    if (shifts.length === 0) return 'Off';
    if (shifts.includes('morning') && shifts.includes('night')) return 'Morning + Night';
    if (shifts.includes('morning')) return 'Morning only';
    return 'Night only';
  };

  const weekdayDesc = describeDay('monday');
  const allSameWeekday = weekdayDays.every(d => describeDay(d) === weekdayDesc);
  const satDesc = describeDay('saturday');
  const sunDesc = describeDay('sunday');
  const weekendSame = satDesc === sunDesc;

  const parts: string[] = [];
  if (allSameWeekday && weekdayDesc !== 'Off') parts.push(`Mon–Fri: ${weekdayDesc}`);
  else weekdayDays.forEach(d => { const s = describeDay(d); if (s !== 'Off') parts.push(`${DAY_LABELS[d]}: ${s}`); });
  if (weekendSame && satDesc !== 'Off') parts.push(`Sat–Sun: ${satDesc}`);
  else { if (satDesc !== 'Off') parts.push(`Sat: ${satDesc}`); if (sunDesc !== 'Off') parts.push(`Sun: ${sunDesc}`); }

  return parts.length ? parts.join(' · ') : 'No coverage configured';
}

// ─── Dot indicator ────────────────────────────────────────────────────────────

function DayDot({ morning, night }: { morning: boolean; night: boolean }) {
  if (morning && night) return <span className="w-1.5 h-1.5 rounded-full bg-success inline-block ml-0.5" />;
  if (morning || night) return <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block ml-0.5" />;
  return null;
}

// ─── Station Card ─────────────────────────────────────────────────────────────

interface StationCardProps {
  station: Station;
  requirements: (CoverageRequirement & { id: string })[];
  employees: ReturnType<typeof useAppState>['employees'];
  currentWeek: Date[];
  onEditStation: (s: Station) => void;
  onDeleteStation: (id: string) => void;
  onUpsertReq: (req: CoverageRequirement & { id: string }) => void;
  onRemoveReq: (id: string) => void;
}

function StationCard({
  station, requirements, employees, currentWeek,
  onEditStation, onDeleteStation, onUpsertReq, onRemoveReq,
}: StationCardProps) {
  const qualifiedCount = employees.filter(e => e.qualifiedStations.includes(station.id)).length;
  const lastActive = station.lastActiveAt
    ? (() => { try { return format(parseISO(station.lastActiveAt!), 'MMM d, yyyy'); } catch { return null; } })()
    : null;

  const [activeDay, setActiveDay] = useState<DayOfWeek>('monday');
  const [expanded, setExpanded] = useState(false);

  // Per-shift save states keyed by `day-type`
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Station-level seniority save state
  const [seniorySaveState, setSenioritySaveState] = useState<SaveState>('idle');
  const seniorityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getReq(day: DayOfWeek, type: 'morning' | 'night') {
    return requirements.find(r => r.day === day && r.shiftType === type) ?? null;
  }

  function setSaveState(day: DayOfWeek, type: 'morning' | 'night', state: SaveState) {
    setSaveStates(prev => ({ ...prev, [`${day}-${type}`]: state }));
  }

  function scheduleAutoSave(req: CoverageRequirement & { id: string }) {
    const key = `${req.day}-${req.shiftType}`;
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
    setSaveState(req.day, req.shiftType, 'saving');
    debounceRefs.current[key] = setTimeout(async () => {
      try {
        await upsertRequirements([req]);
        setSaveState(req.day, req.shiftType, 'saved');
        setTimeout(() => setSaveState(req.day, req.shiftType, 'idle'), 2000);
      } catch (err) {
        setSaveState(req.day, req.shiftType, 'error');
        toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 500);
  }

  function handleToggle(day: DayOfWeek, type: 'morning' | 'night', on: boolean) {
    const existing = getReq(day, type);
    const defaults = type === 'morning'
      ? { start: '06:00', end: '12:00' }
      : { start: '16:00', end: '23:00' };

    if (on) {
      const newReq: CoverageRequirement & { id: string } = existing
        ? { ...existing, isActive: true }
        : {
            id: generateId(),
            stationId: station.id,
            day,
            timeWindow: defaults,
            requiredCount: 1,
            minSeniorityLevel: 'junior',
            shiftType: type,
            isActive: true,
          };
      onUpsertReq(newReq);
      scheduleAutoSave(newReq);
    } else {
      if (!existing) return;
      const updated = { ...existing, isActive: false };
      onUpsertReq(updated);
      scheduleAutoSave(updated);
    }
  }

  function handleChange(day: DayOfWeek, type: 'morning' | 'night', updates: Partial<CoverageRequirement>) {
    const existing = getReq(day, type);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    onUpsertReq(updated);
    scheduleAutoSave(updated);
  }

  function handleCopyDay(fromDay: DayOfWeek, target: 'tomorrow' | 'weekdays' | 'weekend' | 'all') {
    const dayOrder: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const fromIdx = dayOrder.indexOf(fromDay);

    let targetDays: DayOfWeek[];
    if (target === 'tomorrow') {
      targetDays = [dayOrder[(fromIdx + 1) % 7]];
    } else if (target === 'weekdays') {
      targetDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    } else if (target === 'weekend') {
      targetDays = ['saturday', 'sunday'];
    } else {
      targetDays = dayOrder;
    }

    const morningFrom = getReq(fromDay, 'morning');
    const nightFrom = getReq(fromDay, 'night');

    for (const toDay of targetDays) {
      if (toDay === fromDay) continue;
      for (const type of ['morning', 'night'] as const) {
        const src = type === 'morning' ? morningFrom : nightFrom;
        const existing = getReq(toDay, type);
        const newReq: CoverageRequirement & { id: string } = {
          id: existing?.id ?? generateId(),
          stationId: station.id,
          day: toDay,
          timeWindow: src?.timeWindow ?? (type === 'morning' ? { start: '06:00', end: '12:00' } : { start: '16:00', end: '23:00' }),
          requiredCount: src?.requiredCount ?? 1,
          minSeniorityLevel: src?.minSeniorityLevel ?? 'junior',
          shiftType: type,
          isActive: src?.isActive ?? false,
        };
        onUpsertReq(newReq);
        scheduleAutoSave(newReq);
      }
    }
    toast.success(`Copied ${DAY_LABELS[fromDay]} coverage to ${target === 'all' ? 'all days' : target}`);
  }

  function handleStationSeniorityChange(val: 'junior' | 'mid' | 'senior') {
    const updated = { ...station, minSeniorityLevel: val };
    onEditStation(updated);
    if (seniorityDebounceRef.current) clearTimeout(seniorityDebounceRef.current);
    setSenioritySaveState('saving');
    seniorityDebounceRef.current = setTimeout(async () => {
      try {
        await upsertStations([updated]);
        setSenioritySaveState('saved');
        setTimeout(() => setSenioritySaveState('idle'), 2000);
      } catch (err) {
        setSenioritySaveState('error');
        toast.error(`Failed to save station seniority: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 500);
  }

  const seniorityLevel = station.minSeniorityLevel ?? 'junior';
  const coverageSummary = buildCoverageSummary(requirements);

  const dayIdx: Record<DayOfWeek, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };

  return (
    <div className="stat-card">
      {/* ── Station header ── */}
      <div className="flex items-start justify-between mb-3 group">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: station.color }} />
          <div>
            <h3 className="font-semibold text-foreground text-sm">{station.name}</h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
              {station.isCritical && (
                <span className="flex items-center gap-0.5 text-warning"><Shield className="w-3 h-3" />Critical</span>
              )}
              <span>{qualifiedCount} qualified</span>
              {lastActive && <span>· Active {lastActive}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEditStation(station)} className="p-1.5 rounded hover:bg-muted">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => onDeleteStation(station.id)} className="p-1.5 rounded hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        </div>
      </div>

      {/* ── Station-level seniority ── */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[11px] font-medium text-muted-foreground">Min Seniority:</span>
          <SeniorityToggle value={seniorityLevel} onChange={handleStationSeniorityChange} size="xs" />
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${SENIORITY_BADGE[seniorityLevel]}`}>
            {seniorityLevel === 'senior' && <Star className="w-2.5 h-2.5 inline mr-0.5 fill-yellow-600" />}
            {seniorityLevel.charAt(0).toUpperCase() + seniorityLevel.slice(1)}
          </span>
          {seniorySaveState === 'saving' && <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>}
          {seniorySaveState === 'saved' && <span className="text-[10px] text-success flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />Saved</span>}
        </div>
      </div>

      {/* ── Senior info banner ── */}
      {seniorityLevel === 'senior' && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 text-[11px] text-yellow-800 dark:text-yellow-300">
          ⭐ This station will be assigned to the most qualified senior employee whose certifications match.
        </div>
      )}

      {/* ── Coverage collapse toggle ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between py-2 border-t border-border hover:bg-muted/30 transition-colors rounded-b-none px-1 -mx-1"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Coverage</span>
          {!expanded && (
            <span className="text-[10px] text-muted-foreground truncate max-w-64">{coverageSummary}</span>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        }
      </button>

      {/* ── Coverage panel (expanded) ── */}
      <div
        className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-[800px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}
      >
        {/* Day tab strip */}
        <div className="flex gap-0.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
          {DAYS_OF_WEEK.map(day => {
            const m = getReq(day, 'morning');
            const n = getReq(day, 'night');
            const hasMorning = !!(m?.isActive);
            const hasNight = !!(n?.isActive);
            return (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`flex-shrink-0 flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeDay === day
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {DAY_LABELS[day]}
                <DayDot morning={hasMorning} night={hasNight} />
              </button>
            );
          })}
        </div>

        {/* Active day panel */}
        <DayCoveragePanel
          day={activeDay}
          dayDate={currentWeek[dayIdx[activeDay]]}
          stationId={station.id}
          morningReq={getReq(activeDay, 'morning')}
          nightReq={getReq(activeDay, 'night')}
          onToggleShift={(type, on) => handleToggle(activeDay, type, on)}
          onChangeShift={(type, updates) => handleChange(activeDay, type, updates)}
          morningState={saveStates[`${activeDay}-morning`] ?? 'idle'}
          nightState={saveStates[`${activeDay}-night`] ?? 'idle'}
          onCopyDay={target => handleCopyDay(activeDay, target)}
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StationsPage() {
  const { stationsDraft, setStationsDraft, saveStations, discardStations, employees, dbLoading } = useAppState();
  const { currentWeek } = useDateContext();
  const draft = stationsDraft.draft;
  const isDirty = stationsDraft.isDirty;

  const [editStation, setEditStation] = useState<Station | null>(null);
  const [isNewStation, setIsNewStation] = useState(false);

  function saveStationDialog() {
    if (!editStation || !editStation.name.trim()) return;
    setStationsDraft(prev => ({
      ...prev,
      stations: isNewStation
        ? [...prev.stations, editStation]
        : prev.stations.map(s => s.id === editStation.id ? editStation : s),
    }));
    setEditStation(null);
  }

  // Called by StationCard when it does an immediate seniority save —
  // we still mirror the change into the draft so UI stays consistent
  function handleInlineEditStation(updated: Station) {
    setStationsDraft(prev => ({
      ...prev,
      stations: prev.stations.map(s => s.id === updated.id ? updated : s),
    }));
  }

  function removeStation(id: string) {
    const st = draft.stations.find(s => s.id === id);
    const stReqs = draft.requirements.filter(r => r.stationId === id);
    setStationsDraft(prev => ({
      ...prev,
      stations: prev.stations.filter(s => s.id !== id),
      requirements: prev.requirements.filter(r => r.stationId !== id),
    }));
    toast(`Removed station "${st?.name ?? ''}"`, {
      action: {
        label: 'Undo',
        onClick: () => setStationsDraft(prev => ({
          stations: [...prev.stations, st!],
          requirements: [...prev.requirements, ...stReqs],
        })),
      },
      duration: 5000,
    });
  }

  function upsertReq(req: CoverageRequirement & { id: string }) {
    setStationsDraft(prev => {
      const exists = prev.requirements.some(r => r.id === req.id);
      return {
        ...prev,
        requirements: exists
          ? prev.requirements.map(r => r.id === req.id ? req : r)
          : [...prev.requirements, req],
      };
    });
  }

  function removeReq(id: string) {
    setStationsDraft(prev => ({
      ...prev,
      requirements: prev.requirements.filter(r => r.id !== id),
    }));
  }

  if (dbLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stations & Coverage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {draft.stations.length} stations · {draft.requirements.filter(r => r.isActive).length} active coverage rules
          </p>
        </div>
        <button
          onClick={() => {
            setEditStation({ id: generateId(), name: '', color: COLORS[draft.stations.length % COLORS.length], isCritical: false });
            setIsNewStation(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Add Station
        </button>
      </div>

      {/* Empty state */}
      {draft.stations.length === 0 && (
        <div className="stat-card flex flex-col items-center justify-center py-16 text-center">
          <LayoutGrid className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No stations yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first station to define coverage requirements.
          </p>
          <button
            onClick={() => {
              setEditStation({ id: generateId(), name: '', color: COLORS[0], isCritical: false });
              setIsNewStation(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Add Station
          </button>
        </div>
      )}

      {/* Station cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {draft.stations.map(station => {
          const reqs = draft.requirements
            .filter(r => r.stationId === station.id)
            .map(r => ({ ...r, id: r.id ?? `${r.stationId}-${r.day}-${r.shiftType}` })) as (CoverageRequirement & { id: string })[];

          return (
            <StationCard
              key={station.id}
              station={station}
              requirements={reqs}
              employees={employees}
              currentWeek={currentWeek}
              onEditStation={handleInlineEditStation}
              onDeleteStation={removeStation}
              onUpsertReq={upsertReq}
              onRemoveReq={removeReq}
            />
          );
        })}
      </div>

      {/* Station edit dialog (name/color/critical only) */}
      <Dialog open={!!editStation} onOpenChange={() => setEditStation(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isNewStation ? 'Add Station' : 'Edit Station'}</DialogTitle>
          </DialogHeader>
          {editStation && (
            <div className="space-y-4">
              <div>
                <Label>Station Name</Label>
                <Input
                  value={editStation.name}
                  onChange={e => setEditStation({ ...editStation, name: e.target.value })}
                  placeholder="e.g., Host Stand"
                  className="mt-1"
                  onKeyDown={e => e.key === 'Enter' && saveStationDialog()}
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditStation({ ...editStation, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${editStation.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Critical Station</Label>
                <Switch
                  checked={editStation.isCritical}
                  onCheckedChange={v => setEditStation({ ...editStation, isCritical: v })}
                />
              </div>
              <button
                onClick={saveStationDialog}
                className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
              >
                {isNewStation ? 'Add Station' : 'Save Changes'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UnsavedChangesBar isDirty={isDirty} onSave={saveStations} onDiscard={discardStations} />
    </div>
  );
}
