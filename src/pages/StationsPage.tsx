import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppState } from '@/context/AppContext';
import { useDateContext, formatTimeWindow } from '@/context/DateContext';
import {
  Station, CoverageRequirement, generateId, DAYS_OF_WEEK, DAY_LABELS, DayOfWeek,
} from '@/lib/types';
import { Plus, Pencil, Trash2, Shield, Check, X, Minus, LayoutGrid } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import UnsavedChangesBar from '@/components/UnsavedChangesBar';
import { upsertRequirements, deleteRequirement } from '@/lib/supabase';

const COLORS = [
  'hsl(215, 90%, 42%)', 'hsl(172, 66%, 40%)', 'hsl(38, 92%, 50%)',
  'hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)',
];

const TIME_PRESETS: { label: string; start: string; end: string }[] = [
  { label: 'Morning', start: '06:00', end: '12:00' },
  { label: 'Lunch', start: '11:00', end: '15:00' },
  { label: 'Afternoon', start: '12:00', end: '17:00' },
  { label: 'Dinner', start: '16:00', end: '23:00' },
  { label: 'Full Day', start: '08:00', end: '20:00' },
  { label: 'Custom', start: '', end: '' },
];

function reqKey(r: CoverageRequirement) {
  return r.id ?? `${r.stationId}-${r.day}-${r.timeWindow.start}`;
}

// ── Row save indicator ─────────────────────────────────────────────────────────
type RowSaveState = 'idle' | 'saving' | 'saved' | 'error';

// ── Inline Requirement Row ──────────────────────────────────────────────────
interface ReqRowProps {
  req: CoverageRequirement & { id: string };
  stationColor: string;
  currentWeek: Date[];
  onUpdate: (updated: CoverageRequirement & { id: string }) => void;
  onDelete: (req: CoverageRequirement & { id: string }) => void;
}

function RequirementRow({ req, stationColor, currentWeek, onUpdate, onDelete }: ReqRowProps) {
  const [saveState, setSaveState] = useState<RowSaveState>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preset, setPreset] = useState<string>(() => {
    const match = TIME_PRESETS.find(p => p.start === req.timeWindow.start && p.end === req.timeWindow.end);
    return match?.label ?? 'Custom';
  });
  const [customStart, setCustomStart] = useState(req.timeWindow.start);
  const [customEnd, setCustomEnd] = useState(req.timeWindow.end);

  const dayIdx: Record<DayOfWeek, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
  const date = currentWeek[dayIdx[req.day]];

  const autoSave = useCallback((updated: CoverageRequirement & { id: string }) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    debounceRef.current = setTimeout(async () => {
      try {
        await upsertRequirements([updated]);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch (err) {
        setSaveState('error');
        toast.error(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 800);
  }, []);

  function changeDay(day: DayOfWeek) {
    const updated = { ...req, day };
    onUpdate(updated);
    autoSave(updated);
  }

  function changePreset(label: string) {
    setPreset(label);
    if (label !== 'Custom') {
      const p = TIME_PRESETS.find(x => x.label === label)!;
      const updated = { ...req, timeWindow: { start: p.start, end: p.end } };
      setCustomStart(p.start);
      setCustomEnd(p.end);
      onUpdate(updated);
      autoSave(updated);
    }
  }

  function changeCustomTime(start: string, end: string) {
    setCustomStart(start);
    setCustomEnd(end);
    if (start && end) {
      const updated = { ...req, timeWindow: { start, end } };
      onUpdate(updated);
      autoSave(updated);
    }
  }

  function changeCount(delta: number) {
    const newCount = Math.max(1, req.requiredCount + delta);
    const updated = { ...req, requiredCount: newCount };
    onUpdate(updated);
    autoSave(updated);
  }

  function changeSeniority(val: string) {
    const updated = { ...req, minSeniorityLevel: val === 'any' ? undefined : val as CoverageRequirement['minSeniorityLevel'] };
    onUpdate(updated);
    autoSave(updated);
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0 flex-wrap">
      {/* Day + date */}
      <Select value={req.day} onValueChange={v => changeDay(v as DayOfWeek)}>
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DAYS_OF_WEEK.map((d, i) => (
            <SelectItem key={d} value={d} className="text-xs">
              {DAY_LABELS[d]} {currentWeek[i] ? format(currentWeek[i], 'MMM d') : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Time preset */}
      <Select value={preset} onValueChange={changePreset}>
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIME_PRESETS.map(p => (
            <SelectItem key={p.label} value={p.label} className="text-xs">{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom time inputs */}
      {preset === 'Custom' ? (
        <div className="flex items-center gap-1">
          <Input type="time" value={customStart} onChange={e => changeCustomTime(e.target.value, customEnd)} className="h-7 w-24 text-xs" />
          <span className="text-[10px] text-muted-foreground">–</span>
          <Input type="time" value={customEnd} onChange={e => changeCustomTime(customStart, e.target.value)} className="h-7 w-24 text-xs" />
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground mono">{formatTimeWindow(req.timeWindow.start, req.timeWindow.end)}</span>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-1 bg-muted rounded-lg overflow-hidden">
        <button onClick={() => changeCount(-1)} className="p-1 hover:bg-muted/80 transition-colors"><Minus className="w-3 h-3" /></button>
        <span className="text-xs font-semibold px-2 min-w-[24px] text-center">{req.requiredCount}</span>
        <button onClick={() => changeCount(1)} className="p-1 hover:bg-muted/80 transition-colors"><Plus className="w-3 h-3" /></button>
      </div>

      {/* Min seniority */}
      <Select value={req.minSeniorityLevel ?? 'any'} onValueChange={changeSeniority}>
        <SelectTrigger className="h-7 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any" className="text-xs">Any</SelectItem>
          <SelectItem value="junior" className="text-xs">Junior+</SelectItem>
          <SelectItem value="mid" className="text-xs">Mid+</SelectItem>
          <SelectItem value="senior" className="text-xs">Senior</SelectItem>
        </SelectContent>
      </Select>

      {/* Save indicator */}
      <div className="ml-auto flex items-center gap-1.5">
        {saveState === 'saving' && <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>}
        {saveState === 'saved' && <span className="text-[10px] text-success flex items-center gap-0.5"><Check className="w-3 h-3" />Saved</span>}
        {saveState === 'error' && <span className="text-[10px] text-destructive">Error</span>}
        <button onClick={() => onDelete(req)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Station Card ──────────────────────────────────────────────────────────────
interface StationCardProps {
  station: Station;
  requirements: (CoverageRequirement & { id: string })[];
  employees: ReturnType<typeof useAppState>['employees'];
  currentWeek: Date[];
  onEditStation: (s: Station) => void;
  onDeleteStation: (id: string) => void;
  onUpdateReq: (updated: CoverageRequirement & { id: string }) => void;
  onDeleteReq: (req: CoverageRequirement & { id: string }) => void;
  onAddReq: (stationId: string) => void;
}

function StationCard({ station, requirements, employees, currentWeek, onEditStation, onDeleteStation, onUpdateReq, onDeleteReq, onAddReq }: StationCardProps) {
  const qualifiedCount = employees.filter(e => e.qualifiedStations.includes(station.id)).length;
  const lastActive = station.lastActiveAt
    ? (() => { try { return format(parseISO(station.lastActiveAt!), 'MMM d, yyyy'); } catch { return null; } })()
    : null;

  return (
    <div className="stat-card group">
      {/* Station header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: station.color }} />
          <div>
            <h3 className="font-semibold text-foreground text-sm">{station.name}</h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              {station.isCritical && <span className="flex items-center gap-0.5 text-warning"><Shield className="w-3 h-3" />Critical</span>}
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

      {/* Coverage requirements */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Coverage Requirements</p>
          <button
            onClick={() => onAddReq(station.id)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {requirements.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No coverage requirements — click Add to set one.</p>
        ) : (
          requirements.map(req => (
            <RequirementRow
              key={reqKey(req)}
              req={req}
              stationColor={station.color}
              currentWeek={currentWeek}
              onUpdate={onUpdateReq}
              onDelete={onDeleteReq}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StationsPage() {
  const { stationsDraft, setStationsDraft, saveStations, discardStations, employees, dbLoading } = useAppState();
  const { currentWeek } = useDateContext();
  const draft = stationsDraft.draft;
  const isDirty = stationsDraft.isDirty;

  const [editStation, setEditStation] = useState<Station | null>(null);
  const [isNewStation, setIsNewStation] = useState(false);

  function saveStation() {
    if (!editStation || !editStation.name.trim()) return;
    setStationsDraft(prev => ({
      ...prev,
      stations: isNewStation
        ? [...prev.stations, editStation]
        : prev.stations.map(s => s.id === editStation.id ? editStation : s),
    }));
    setEditStation(null);
  }

  function removeStation(id: string) {
    const st = draft.stations.find(s => s.id === id);
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
          requirements: [...prev.requirements, ...draft.requirements.filter(r => r.stationId === id)],
        })),
      },
      duration: 5000,
    });
  }

  function addReq(stationId: string) {
    const newReq: CoverageRequirement & { id: string } = {
      id: generateId(),
      stationId,
      day: 'monday',
      timeWindow: { start: '09:00', end: '17:00' },
      requiredCount: 1,
    };
    setStationsDraft(prev => ({ ...prev, requirements: [...prev.requirements, newReq] }));
    // Auto-save immediately
    upsertRequirements([newReq]).catch(err => {
      toast.error(`Failed to create requirement: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  function updateReq(updated: CoverageRequirement & { id: string }) {
    setStationsDraft(prev => ({
      ...prev,
      requirements: prev.requirements.map(r => reqKey(r) === reqKey(updated) ? updated : r),
    }));
  }

  function deleteReq(req: CoverageRequirement & { id: string }) {
    setStationsDraft(prev => ({
      ...prev,
      requirements: prev.requirements.filter(r => reqKey(r) !== reqKey(req)),
    }));
    // Show 5s undo toast before actually deleting
    let undone = false;
    toast(`Coverage requirement deleted`, {
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          setStationsDraft(prev => ({ ...prev, requirements: [...prev.requirements, req] }));
        },
      },
      duration: 5000,
      onDismiss: () => {
        if (!undone && req.id) {
          deleteRequirement(req.id).catch(err => {
            toast.error(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
            setStationsDraft(prev => ({ ...prev, requirements: [...prev.requirements, req] }));
          });
        }
      },
      onAutoClose: () => {
        if (!undone && req.id) {
          deleteRequirement(req.id).catch(err => {
            toast.error(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
            setStationsDraft(prev => ({ ...prev, requirements: [...prev.requirements, req] }));
          });
        }
      },
    });
  }

  if (dbLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-32" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
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
          <p className="text-sm text-muted-foreground mt-1">{draft.stations.length} stations · {draft.requirements.length} coverage rules</p>
        </div>
        <button
          onClick={() => { setEditStation({ id: generateId(), name: '', color: COLORS[draft.stations.length % COLORS.length], isCritical: false }); setIsNewStation(true); }}
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
          <p className="text-sm text-muted-foreground mb-4">Add your first station to define coverage requirements.</p>
          <button
            onClick={() => { setEditStation({ id: generateId(), name: '', color: COLORS[0], isCritical: false }); setIsNewStation(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Add Station
          </button>
        </div>
      )}

      {/* Station cards with inline requirements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {draft.stations.map(station => {
          const reqs = draft.requirements
            .filter(r => r.stationId === station.id)
            .map(r => ({ ...r, id: r.id ?? reqKey(r) })) as (CoverageRequirement & { id: string })[];
          return (
            <StationCard
              key={station.id}
              station={station}
              requirements={reqs}
              employees={employees}
              currentWeek={currentWeek}
              onEditStation={s => { setEditStation({ ...s }); setIsNewStation(false); }}
              onDeleteStation={removeStation}
              onUpdateReq={updateReq}
              onDeleteReq={deleteReq}
              onAddReq={addReq}
            />
          );
        })}
      </div>

      {/* Station edit dialog */}
      <Dialog open={!!editStation} onOpenChange={() => setEditStation(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{isNewStation ? 'Add Station' : 'Edit Station'}</DialogTitle></DialogHeader>
          {editStation && (
            <div className="space-y-4">
              <div>
                <Label>Station Name</Label>
                <Input value={editStation.name} onChange={e => setEditStation({ ...editStation, name: e.target.value })} placeholder="e.g., Host Stand" className="mt-1" />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setEditStation({ ...editStation, color: c })} className={`w-7 h-7 rounded-full border-2 transition-all ${editStation.color === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Critical Station</Label>
                <Switch checked={editStation.isCritical} onCheckedChange={v => setEditStation({ ...editStation, isCritical: v })} />
              </div>
              <button onClick={saveStation} className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
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
