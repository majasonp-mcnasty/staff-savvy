import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
  DragOverEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAppState } from '@/context/AppContext';
import { useDateContext, formatTimeWindow, formatTime } from '@/context/DateContext';
import {
  DAYS_OF_WEEK, DAY_LABELS, DayOfWeek,
  shiftDurationHours, ScheduleShift, Employee, Station,
} from '@/lib/types';
import {
  Zap, Download, RefreshCw, Calendar, FileJson, GripVertical,
  Undo2, ChevronLeft, ChevronRight, Plus, X, Check, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { downloadFile } from '@/lib/export-helpers';
import { recalculateScheduleTotals } from '@/lib/schedule-helpers';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ── Drag ID helpers ──────────────────────────────────────────────────────────
function makeShiftId(shiftIndex: number) { return `shift-${shiftIndex}`; }
function makeCellId(employeeId: string, day: DayOfWeek) { return `cell-${employeeId}-${day}`; }

// ── Shift cell (draggable) ───────────────────────────────────────────────────
interface ShiftCellProps {
  shift: ScheduleShift & { _idx: number };
  station: Station | undefined;
  isManual: boolean;
  onEdit: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  onDelete: (idx: number) => void;
}

function DraggableShift({ shift, station, isManual, onEdit, onDuplicate, onDelete }: ShiftCellProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: makeShiftId(shift._idx),
    data: { shiftIndex: shift._idx },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
    backgroundColor: station ? `${station.color}22` : undefined,
    color: station?.color,
    borderLeft: station ? `3px solid ${station.color}` : undefined,
  };

  const hours = shiftDurationHours(shift.timeWindow);
  const cost = shift.shiftCost;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          className={`text-[11px] font-medium px-1.5 py-1.5 rounded mb-0.5 select-none cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${isManual ? 'ring-1 ring-warning/40' : ''}`}
        >
          <div className="flex items-center gap-0.5 mb-0.5" {...listeners}>
            <GripVertical className="w-2.5 h-2.5 opacity-30 flex-shrink-0" />
            <span className="font-semibold truncate">{station?.name ?? '—'}</span>
            {isManual && <span className="ml-auto text-warning opacity-70 text-[9px]">✎</span>}
          </div>
          <div className="opacity-70 text-[10px]">{formatTimeWindow(shift.timeWindow.start, shift.timeWindow.end)}</div>
          <div className="flex justify-between text-[10px] opacity-60 mt-0.5">
            <span>{hours.toFixed(1)}h</span>
            <span>${cost.toFixed(0)}</span>
          </div>
          {shift.notes && <div className="text-[10px] opacity-50 truncate mt-0.5 italic">{shift.notes}</div>}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="text-sm">
        <ContextMenuItem onClick={() => onEdit(shift._idx)}>
          <span className="mr-2">✏️</span> Edit Shift
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicate(shift._idx)}>
          <span className="mr-2">📋</span> Duplicate Shift
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(shift._idx)}>
          <span className="mr-2">🗑️</span> Delete Shift
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── Drop cell ────────────────────────────────────────────────────────────────
interface DropCellProps {
  employeeId: string;
  day: DayOfWeek;
  isOver: boolean;
  isValid: boolean | null;
  children: React.ReactNode;
  onAddShift: (employeeId: string, day: DayOfWeek) => void;
  isUnavailable: boolean;
}

function DroppableCell({ employeeId, day, isOver, isValid, children, onAddShift, isUnavailable }: DropCellProps) {
  const { setNodeRef } = useDroppable({ id: makeCellId(employeeId, day) });

  let bg = '';
  if (isOver) {
    bg = isValid === false ? 'bg-destructive/15 ring-2 ring-destructive/50 ring-inset' : 'bg-success/15 ring-2 ring-success/50 ring-inset';
  } else if (isUnavailable) {
    bg = 'bg-muted/40';
  }

  return (
    <div
      ref={setNodeRef}
      className={`bg-card p-1.5 min-h-[72px] transition-colors relative group/cell ${bg}`}
    >
      {isUnavailable && !React.Children.count(children) ? (
        <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground/50 select-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(0,0,0,.04) 4px,rgba(0,0,0,.04) 8px)' }}>
          Unavailable
        </div>
      ) : (
        <>
          {children}
          {!isUnavailable && (
            <button
              onClick={() => onAddShift(employeeId, day)}
              className="absolute bottom-1 right-1 opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
            >
              <Plus className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Shift Edit Popover ────────────────────────────────────────────────────────
interface ShiftEditPopoverProps {
  open: boolean;
  onClose: () => void;
  shift: ScheduleShift | null;
  stations: Station[];
  employees: Employee[];
  onSave: (updated: Partial<ScheduleShift>) => void;
}

function ShiftEditPopover({ open, onClose, shift, stations, employees, onSave }: ShiftEditPopoverProps) {
  const [stationId, setStationId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (shift) {
      setStationId(shift.stationId);
      setStart(shift.timeWindow.start);
      setEnd(shift.timeWindow.end);
      setNotes(shift.notes ?? '');
    }
  }, [shift]);

  if (!open || !shift) return null;

  const emp = employees.find(e => e.id === shift.employeeId);
  const hours = start && end ? (parseInt(end) - parseInt(start)) : shiftDurationHours(shift.timeWindow);
  const station = stations.find(s => s.id === stationId);
  const wage = emp?.hourlyWage ?? 0;

  // Simple constraint check
  const isAvailDay = emp ? (emp.availability[shift.day]?.length ?? 0) > 0 : true;
  const isQualified = emp ? emp.qualifiedStations.includes(stationId) : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl p-5 w-80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground text-sm">Edit Shift — {emp?.name}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        {!isAvailDay && (
          <div className="flex items-center gap-1.5 text-[11px] text-warning mb-3 bg-warning/10 px-2.5 py-1.5 rounded-md">
            <AlertCircle className="w-3 h-3" /> Employee unavailable on this day
          </div>
        )}
        {!isQualified && (
          <div className="flex items-center gap-1.5 text-[11px] text-destructive mb-3 bg-destructive/10 px-2.5 py-1.5 rounded-md">
            <AlertCircle className="w-3 h-3" /> Not qualified for this station
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Station</label>
            <Select value={stationId} onValueChange={setStationId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stations.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Start</label>
              <Input type="time" value={start} onChange={e => setStart(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">End</label>
              <Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note…" className="h-8 text-xs" />
          </div>
          {start && end && (
            <p className="text-[11px] text-muted-foreground">
              {shiftDurationHours({ start, end }).toFixed(1)}h · ${(shiftDurationHours({ start, end }) * wage).toFixed(0)} cost
              {station && <span style={{ color: station.color }}> · {station.name}</span>}
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { onSave({ stationId, timeWindow: { start, end }, notes }); onClose(); }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
          >
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={onClose} className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main SchedulePage ────────────────────────────────────────────────────────
export default function SchedulePage() {
  const { schedule, setSchedule, employees, stations, generateNewSchedule, budget, dbLoading } = useAppState();
  const { currentWeek, currentWeekLabel, navigateWeek, navigateToToday, isCurrentWeek } = useDateContext();

  const [history, setHistory] = useState<ScheduleShift[][]>([]);
  const [overrideCount, setOverrideCount] = useState(0);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [overCellId, setOverCellId] = useState<string | null>(null);
  const [dropValid, setDropValid] = useState<boolean | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [dayView, setDayView] = useState<DayOfWeek>('monday');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Current drag shift (for overlay)
  const activeShift = activeShiftId && schedule
    ? (() => {
        const idx = parseInt(activeShiftId.replace('shift-', ''));
        return schedule.shifts[idx] ? { ...schedule.shifts[idx], _idx: idx } : null;
      })()
    : null;

  function validateDrop(targetEmpId: string, targetDay: DayOfWeek, srcShiftIdx: number): { valid: boolean; reason?: string } {
    if (!schedule) return { valid: false };
    const shift = schedule.shifts[srcShiftIdx];
    if (!shift) return { valid: false };
    if (shift.employeeId === targetEmpId && shift.day === targetDay) return { valid: false, reason: 'Same cell' };
    const targetEmp = employees.find(e => e.id === targetEmpId);
    if (!targetEmp) return { valid: false };
    const station = stations.find(s => s.id === shift.stationId);
    if (station && !targetEmp.qualifiedStations.includes(station.id)) {
      return { valid: false, reason: `${targetEmp.name} is not qualified for ${station.name}` };
    }
    const dayAvail = targetEmp.availability[targetDay];
    if (!dayAvail || dayAvail.length === 0) {
      return { valid: false, reason: `${targetEmp.name} is unavailable on ${targetDay}` };
    }
    if ((targetEmp.timeOff ?? []).some(t => t.day === targetDay)) {
      return { valid: false, reason: `${targetEmp.name} has time off on ${targetDay}` };
    }
    return { valid: true };
  }

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveShiftId(event.active.id as string);
  }, []);

  const onDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined;
    if (!overId || !overId.startsWith('cell-')) { setOverCellId(null); setDropValid(null); return; }
    setOverCellId(overId);
    const parts = overId.replace('cell-', '').split('-');
    const day = parts[parts.length - 1] as DayOfWeek;
    const empId = parts.slice(0, parts.length - 1).join('-');
    const srcIdx = parseInt((event.active.id as string).replace('shift-', ''));
    const { valid } = validateDrop(empId, day, srcIdx);
    setDropValid(valid);
  }, [schedule, employees, stations]);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    setActiveShiftId(null);
    setOverCellId(null);
    setDropValid(null);

    const { active, over } = event;
    if (!over || !schedule) return;

    const overId = over.id as string;
    if (!overId.startsWith('cell-')) return;
    const parts = overId.replace('cell-', '').split('-');
    const targetDay = parts[parts.length - 1] as DayOfWeek;
    const targetEmpId = parts.slice(0, parts.length - 1).join('-');
    const srcIdx = parseInt((active.id as string).replace('shift-', ''));
    const shift = schedule.shifts[srcIdx];
    if (!shift) return;

    const { valid, reason } = validateDrop(targetEmpId, targetDay, srcIdx);
    if (!valid) {
      if (reason && reason !== 'Same cell') toast.error(reason);
      return;
    }

    const targetEmp = employees.find(e => e.id === targetEmpId)!;
    const hours = shiftDurationHours(shift.timeWindow);
    const newCost = hours * targetEmp.hourlyWage;

    setHistory(prev => [...prev, schedule.shifts.map(s => ({ ...s }))]);
    const newShifts = schedule.shifts.map((s, i) =>
      i === srcIdx ? { ...s, employeeId: targetEmpId, day: targetDay, shiftCost: newCost, score: undefined } : s
    );
    const totals = recalculateScheduleTotals(newShifts);
    setSchedule(prev => prev ? { ...prev, shifts: newShifts, ...totals, laborSummary: { ...prev.laborSummary, totalLaborCost: totals.totalCost } } : prev);
    setOverrideCount(c => c + 1);
    toast.success(`Moved to ${targetEmp.name} · ${targetDay}`);
  }, [schedule, employees, stations, setSchedule]);

  const handleUndo = useCallback(() => {
    if (!history.length || !schedule) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const totals = recalculateScheduleTotals(prev);
    setSchedule(s => s ? { ...s, shifts: prev, ...totals, laborSummary: { ...s.laborSummary, totalLaborCost: totals.totalCost } } : s);
    setOverrideCount(c => Math.max(0, c - 1));
    toast.info('Undo successful');
  }, [history, schedule, setSchedule]);

  function handleAddShift(employeeId: string, day: DayOfWeek) {
    if (!schedule) return;
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;
    const stationId = stations.find(s => emp.qualifiedStations.includes(s.id))?.id ?? stations[0]?.id ?? '';
    const hours = 8;
    const newShift: ScheduleShift = {
      employeeId, stationId, day,
      timeWindow: { start: '09:00', end: '17:00' },
      shiftCost: hours * emp.hourlyWage,
      notes: '',
    };
    setHistory(prev => [...prev, schedule.shifts.map(s => ({ ...s }))]);
    const newShifts = [...schedule.shifts, newShift];
    const totals = recalculateScheduleTotals(newShifts);
    setSchedule(prev => prev ? { ...prev, shifts: newShifts, ...totals, laborSummary: { ...prev.laborSummary, totalLaborCost: totals.totalCost } } : prev);
    setOverrideCount(c => c + 1);
    setEditingIdx(newShifts.length - 1);
  }

  function handleDeleteShift(idx: number) {
    if (!schedule) return;
    const shift = schedule.shifts[idx];
    const emp = employees.find(e => e.id === shift.employeeId);
    setHistory(prev => [...prev, schedule.shifts.map(s => ({ ...s }))]);
    const newShifts = schedule.shifts.filter((_, i) => i !== idx);
    const totals = recalculateScheduleTotals(newShifts);
    setSchedule(prev => prev ? { ...prev, shifts: newShifts, ...totals, laborSummary: { ...prev.laborSummary, totalLaborCost: totals.totalCost } } : prev);
    setOverrideCount(c => c + 1);
    toast(`Shift deleted`, {
      action: {
        label: 'Undo',
        onClick: () => {
          setHistory(h => h.slice(0, -1));
          setSchedule(s => s ? { ...s, shifts: schedule.shifts, ...recalculateScheduleTotals(schedule.shifts), laborSummary: { ...s.laborSummary, totalLaborCost: recalculateScheduleTotals(schedule.shifts).totalCost } } : s);
          setOverrideCount(c => Math.max(0, c - 1));
        },
      },
      duration: 5000,
    });
  }

  function handleDuplicateShift(idx: number) {
    if (!schedule) return;
    const shift = { ...schedule.shifts[idx] };
    setHistory(prev => [...prev, schedule.shifts.map(s => ({ ...s }))]);
    const newShifts = [...schedule.shifts, { ...shift, score: undefined }];
    const totals = recalculateScheduleTotals(newShifts);
    setSchedule(prev => prev ? { ...prev, shifts: newShifts, ...totals, laborSummary: { ...prev.laborSummary, totalLaborCost: totals.totalCost } } : prev);
    setOverrideCount(c => c + 1);
    toast.success('Shift duplicated');
  }

  function handleEditSave(idx: number, updates: Partial<ScheduleShift>) {
    if (!schedule) return;
    const shift = schedule.shifts[idx];
    const emp = employees.find(e => e.id === shift.employeeId);
    const newTimeWindow = updates.timeWindow ?? shift.timeWindow;
    const hours = shiftDurationHours(newTimeWindow);
    const newCost = (emp?.hourlyWage ?? 0) * hours;
    setHistory(prev => [...prev, schedule.shifts.map(s => ({ ...s }))]);
    const newShifts = schedule.shifts.map((s, i) =>
      i === idx ? { ...s, ...updates, shiftCost: newCost } : s
    );
    const totals = recalculateScheduleTotals(newShifts);
    setSchedule(prev => prev ? { ...prev, shifts: newShifts, ...totals, laborSummary: { ...prev.laborSummary, totalLaborCost: totals.totalCost } } : prev);
    setOverrideCount(c => c + 1);
    toast.success('Shift updated');
  }

  function exportCSV() {
    if (!schedule) return;
    const rows = [['Employee', 'Station', 'Day', 'Date', 'Start', 'End', 'Hours', 'Cost']];
    for (const shift of schedule.shifts) {
      const emp = employees.find(e => e.id === shift.employeeId);
      const st = stations.find(s => s.id === shift.stationId);
      const dayIdx: Record<DayOfWeek, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
      const date = currentWeek[dayIdx[shift.day]];
      rows.push([
        emp?.name ?? '', st?.name ?? '', shift.day, format(date, 'yyyy-MM-dd'),
        shift.timeWindow.start, shift.timeWindow.end,
        shiftDurationHours(shift.timeWindow).toFixed(1), shift.shiftCost.toFixed(2),
      ]);
    }
    downloadFile(rows.map(r => r.join(',')).join('\n'), 'text/csv', `schedule-${format(currentWeek[0], 'yyyy-MM-dd')}.csv`);
  }

  function exportJSON() {
    if (!schedule) return;
    const output = {
      week_start: format(currentWeek[0], 'yyyy-MM-dd'),
      week_end: format(currentWeek[6], 'yyyy-MM-dd'),
      schedule: Object.fromEntries(DAYS_OF_WEEK.map(day => [
        day,
        schedule.shifts.filter(s => s.day === day).map(s => {
          const emp = employees.find(e => e.id === s.employeeId);
          const st = stations.find(x => x.id === s.stationId);
          return { employee: emp?.name ?? '', role: st?.name ?? '', start: s.timeWindow.start, end: s.timeWindow.end, cost: s.shiftCost };
        }),
      ])),
      labor_summary: schedule.laborSummary,
      manual_overrides: overrideCount,
    };
    downloadFile(JSON.stringify(output, null, 2), 'application/json', `schedule-${format(currentWeek[0], 'yyyy-MM-dd')}.json`);
  }

  const handleRegenerate = () => { generateNewSchedule(); setOverrideCount(0); setHistory([]); };

  const daysToShow = view === 'day' ? [dayView] : DAYS_OF_WEEK;

  const totalHours = schedule
    ? Object.values(schedule.hoursPerEmployee).reduce((a, b) => a + b, 0)
    : 0;

  const budgetCap = budget.weeklyBudgetCap;
  const budgetUsed = schedule?.totalCost ?? 0;
  const budgetRemaining = budgetCap ? budgetCap - budgetUsed : null;
  const overBudget = budgetRemaining !== null && budgetRemaining < 0;

  if (dbLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {schedule
              ? `${schedule.shifts.length} shifts · $${schedule.totalCost.toFixed(0)} labor${overrideCount > 0 ? ` · ${overrideCount} manual` : ''}`
              : 'No schedule generated yet'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {history.length > 0 && (
            <button onClick={handleUndo} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80">
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
          )}
          <button onClick={handleRegenerate} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            {schedule ? <RefreshCw className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            {schedule ? 'Regenerate' : 'Generate'}
          </button>
          {schedule && (
            <>
              <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={exportJSON} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80">
                <FileJson className="w-3.5 h-3.5" /> JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Week nav + view toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateWeek('prev')} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-foreground min-w-48 text-center">{currentWeekLabel}</span>
          <button onClick={() => navigateWeek('next')} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isCurrentWeek && (
            <button onClick={navigateToToday} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'week' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >Week</button>
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'day' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >Day</button>
        </div>
      </div>

      {/* Day selector for day view */}
      {view === 'day' && (
        <div className="flex gap-1.5 flex-wrap">
          {DAYS_OF_WEEK.map((d, i) => {
            const date = currentWeek[i];
            return (
              <button
                key={d}
                onClick={() => setDayView(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${dayView === d ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
              >
                {DAY_LABELS[d]} {format(date, 'd')}
              </button>
            );
          })}
        </div>
      )}

      {!schedule ? (
        <div className="stat-card flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No Schedule Yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Generate an optimized weekly schedule using your employees, stations, and coverage requirements.
          </p>
          <button onClick={handleRegenerate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90">
            <Zap className="w-4 h-4" /> Generate Schedule
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          {/* Calendar grid */}
          <div className="stat-card overflow-x-auto p-0">
            <div className={`min-w-[600px] grid gap-px bg-border`} style={{ gridTemplateColumns: `180px repeat(${daysToShow.length}, 1fr)` }}>
              {/* Header row */}
              <div className="bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">Employee</div>
              {daysToShow.map(d => {
                const idx = DAYS_OF_WEEK.indexOf(d);
                const date = currentWeek[idx];
                const isToday_ = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div key={d} className={`bg-muted px-2 py-2 text-center ${isToday_ ? 'bg-primary/10' : ''}`}>
                    <p className={`text-xs font-semibold ${isToday_ ? 'text-primary' : 'text-muted-foreground'}`}>{DAY_LABELS[d]}</p>
                    <p className={`text-[11px] ${isToday_ ? 'text-primary font-bold' : 'text-muted-foreground/60'}`}>{format(date, 'MMM d')}</p>
                  </div>
                );
              })}

              {/* Employee rows */}
              {employees.map(emp => {
                const empShifts = schedule.shifts.map((s, idx) => ({ ...s, _idx: idx })).filter(s => s.employeeId === emp.id);
                const totalEmpHours = schedule.hoursPerEmployee[emp.id] ?? 0;
                const isOver = totalEmpHours > emp.maxWeeklyHours;
                return (
                  <React.Fragment key={emp.id}>
                    <div className="bg-card px-3 py-2 flex flex-col justify-center border-r border-border">
                      <p className="text-xs font-semibold text-foreground truncate">{emp.name}</p>
                      <p className={`text-[10px] ${isOver ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {totalEmpHours.toFixed(1)}h{isOver ? ' OVERTIME' : ''}
                      </p>
                    </div>
                    {daysToShow.map(day => {
                      const dayShifts = empShifts.filter(s => s.day === day);
                      const cellId = makeCellId(emp.id, day);
                      const isOver_ = overCellId === cellId;
                      const isUnavailable = (emp.availability[day]?.length ?? 0) === 0 || (emp.timeOff ?? []).some(t => t.day === day);
                      return (
                        <DroppableCell
                          key={`${emp.id}-${day}`}
                          employeeId={emp.id}
                          day={day}
                          isOver={isOver_}
                          isValid={isOver_ ? dropValid : null}
                          onAddShift={handleAddShift}
                          isUnavailable={isUnavailable && dayShifts.length === 0}
                        >
                          {dayShifts.map(shift => {
                            const st = stations.find(s => s.id === shift.stationId);
                            return (
                              <DraggableShift
                                key={shift._idx}
                                shift={shift}
                                station={st}
                                isManual={!shift.score}
                                onEdit={setEditingIdx}
                                onDuplicate={handleDuplicateShift}
                                onDelete={handleDeleteShift}
                              />
                            );
                          })}
                        </DroppableCell>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeShift && (() => {
              const st = stations.find(s => s.id === activeShift.stationId);
              return (
                <div
                  className="text-[11px] font-medium px-2 py-1.5 rounded shadow-xl rotate-2 cursor-grabbing"
                  style={{ backgroundColor: st ? `${st.color}33` : 'hsl(var(--card))', color: st?.color, borderLeft: st ? `3px solid ${st.color}` : undefined, minWidth: 100 }}
                >
                  <div className="font-semibold">{st?.name ?? '—'}</div>
                  <div className="opacity-70">{formatTimeWindow(activeShift.timeWindow.start, activeShift.timeWindow.end)}</div>
                </div>
              );
            })()}
          </DragOverlay>
        </DndContext>
      )}

      {/* Shift edit popover */}
      <ShiftEditPopover
        open={editingIdx !== null}
        onClose={() => setEditingIdx(null)}
        shift={editingIdx !== null && schedule ? schedule.shifts[editingIdx] : null}
        stations={stations}
        employees={employees}
        onSave={updates => { if (editingIdx !== null) handleEditSave(editingIdx, updates); }}
      />

      {/* Sticky bottom summary bar */}
      {schedule && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-card/95 backdrop-blur border-t border-border px-6 py-3 flex items-center gap-6 flex-wrap">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{schedule.shifts.length}</span> shifts this week
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{totalHours.toFixed(0)}h</span> total hours
          </div>
          <div className="text-xs">
            <span className="font-semibold text-foreground">${budgetUsed.toFixed(0)}</span>
            <span className="text-muted-foreground"> labor cost</span>
            {budgetCap && (
              <span className={` ml-1 font-medium ${overBudget ? 'text-destructive' : 'text-success'}`}>
                {overBudget ? `▲ $${Math.abs(budgetRemaining!).toFixed(0)} over` : `✓ $${budgetRemaining!.toFixed(0)} remaining`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto flex-1 min-w-0 max-w-xs">
            {employees.slice(0, 6).map(emp => {
              const h = schedule.hoursPerEmployee[emp.id] ?? 0;
              const pct = Math.min((h / emp.maxWeeklyHours) * 100, 100);
              return (
                <Tooltip key={emp.id}>
                  <TooltipTrigger asChild>
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${h > emp.maxWeeklyHours ? 'bg-destructive' : pct > 80 ? 'bg-warning' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{emp.name}: {h.toFixed(1)}h / {emp.maxWeeklyHours}h</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
