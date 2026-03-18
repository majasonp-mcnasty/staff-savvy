import React, { useState, useCallback } from 'react';
import { useAppState } from '@/context/AppContext';
import {
  DAYS_OF_WEEK, DAY_FULL_LABELS, DAY_LABELS, DayOfWeek,
  shiftDurationHours, ScheduleShift,
} from '@/lib/types';
import { Zap, Download, RefreshCw, Calendar, FileJson, GripVertical, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile } from '@/lib/export-helpers';
import { recalculateScheduleTotals } from '@/lib/schedule-helpers';

interface DragData {
  shiftIndex: number;
  employeeId: string;
  day: DayOfWeek;
}

export default function SchedulePage() {
  const { schedule, setSchedule, employees, stations, generateNewSchedule } = useAppState();
  const [dragData, setDragData] = useState<DragData | null>(null);
  const [dropTarget, setDropTarget] = useState<{ employeeId: string; day: DayOfWeek } | null>(null);
  const [overrideCount, setOverrideCount] = useState(0);
  const [history, setHistory] = useState<ScheduleShift[][]>([]);

  const handleDragStart = useCallback((e: React.DragEvent, shift: ScheduleShift, shiftIndex: number) => {
    const data: DragData = { shiftIndex, employeeId: shift.employeeId, day: shift.day };
    setDragData(data);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, employeeId: string, day: DayOfWeek) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ employeeId, day });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetEmployeeId: string, targetDay: DayOfWeek) => {
    e.preventDefault();
    setDropTarget(null);
    if (!schedule || !dragData) return;

    const shiftIdx = dragData.shiftIndex;
    const shift = schedule.shifts[shiftIdx];
    if (!shift) return;

    // Don't drop on same cell
    if (shift.employeeId === targetEmployeeId && shift.day === targetDay) {
      setDragData(null);
      return;
    }

    const targetEmp = employees.find(emp => emp.id === targetEmployeeId);
    if (!targetEmp) return;

    // Validate: check if target employee is qualified for the station
    const station = stations.find(s => s.id === shift.stationId);
    if (station && !targetEmp.qualifiedStations.includes(station.id)) {
      toast.error(`${targetEmp.name} is not qualified for ${station.name}`);
      setDragData(null);
      return;
    }

    // Validate: check availability on target day
    const dayAvail = targetEmp.availability[targetDay];
    if (!dayAvail || dayAvail.length === 0) {
      toast.error(`${targetEmp.name} is not available on ${DAY_FULL_LABELS[targetDay]}`);
      setDragData(null);
      return;
    }

    // Validate: check time-off
    if ((targetEmp.timeOff || []).some(t => t.day === targetDay)) {
      toast.error(`${targetEmp.name} has time off on ${DAY_FULL_LABELS[targetDay]}`);
      setDragData(null);
      return;
    }

    // Save history for undo
    setHistory(prev => [...prev, schedule.shifts.map(s => ({ ...s }))]);

    // Calculate new cost
    const hours = shiftDurationHours(shift.timeWindow);
    const newCost = hours * targetEmp.hourlyWage;

    const newShifts = schedule.shifts.map((s, i) => {
      if (i !== shiftIdx) return s;
      return { ...s, employeeId: targetEmployeeId, day: targetDay, shiftCost: newCost, score: undefined };
    });

    const totals = recalculateScheduleTotals(newShifts);
    setSchedule(prev => prev ? {
      ...prev, shifts: newShifts, ...totals,
      laborSummary: { ...prev.laborSummary, totalLaborCost: totals.totalCost },
    } : prev);

    setOverrideCount(c => c + 1);
    const empName = targetEmp.name;
    toast.success(`Shift moved to ${empName} on ${DAY_FULL_LABELS[targetDay]}`);
    setDragData(null);
  }, [schedule, dragData, employees, stations, setSchedule]);

  const handleUndo = useCallback(() => {
    if (history.length === 0 || !schedule) return;
    const prevShifts = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    const totals = recalculateScheduleTotals(prevShifts);
    setSchedule(prev => prev ? {
      ...prev, shifts: prevShifts, ...totals,
      laborSummary: { ...prev.laborSummary, totalLaborCost: totals.totalCost },
    } : prev);
    setOverrideCount(c => Math.max(0, c - 1));
    toast.info('Undo successful');
  }, [history, schedule, setSchedule]);

  function exportCSV() {
    if (!schedule) return;
    const rows = [['Employee', 'Station', 'Day', 'Start', 'End', 'Hours', 'Cost', 'Score']];
    for (const shift of schedule.shifts) {
      const emp = employees.find(e => e.id === shift.employeeId);
      const st = stations.find(s => s.id === shift.stationId);
      rows.push([
        emp?.name || '', st?.name || '', shift.day,
        shift.timeWindow.start, shift.timeWindow.end,
        shiftDurationHours(shift.timeWindow).toFixed(1),
        shift.shiftCost.toFixed(2),
        shift.score?.total?.toString() || 'manual',
      ]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    downloadFile(csv, 'text/csv', `schedule-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportJSON() {
    if (!schedule) return;
    const output = {
      week_start: new Date().toISOString().slice(0, 10),
      schedule: Object.fromEntries(DAYS_OF_WEEK.map(day => [
        day,
        schedule.shifts.filter(s => s.day === day).map(s => {
          const emp = employees.find(e => e.id === s.employeeId);
          const st = stations.find(x => x.id === s.stationId);
          return {
            shift_start: s.timeWindow.start,
            shift_end: s.timeWindow.end,
            role: st?.name || '',
            employee: emp?.name || '',
            hourly_wage: emp?.hourlyWage || 0,
            shift_cost: s.shiftCost,
            score: s.score?.total ?? 'manual_override',
          };
        }),
      ])),
      labor_summary: schedule.laborSummary,
      demand_forecast: schedule.demandForecast,
      manual_overrides: overrideCount,
    };
    downloadFile(JSON.stringify(output, null, 2), 'application/json', `schedule-${new Date().toISOString().slice(0, 10)}.json`);
  }

  function downloadFile(content: string, type: string, filename: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const handleRegenerate = () => {
    generateNewSchedule();
    setOverrideCount(0);
    setHistory([]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Weekly Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {schedule
              ? `${schedule.shifts.length} shifts · $${schedule.totalCost.toFixed(0)} total cost${overrideCount > 0 ? ` · ${overrideCount} manual override${overrideCount > 1 ? 's' : ''}` : ''}`
              : 'No schedule generated yet'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {history.length > 0 && (
            <button onClick={handleUndo} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
              <Undo2 className="w-4 h-4" /> Undo
            </button>
          )}
          <button onClick={handleRegenerate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
            {schedule ? <RefreshCw className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {schedule ? 'Regenerate' : 'Generate'}
          </button>
          {schedule && (
            <>
              <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                <Download className="w-4 h-4" /> CSV
              </button>
              <button onClick={exportJSON} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                <FileJson className="w-4 h-4" /> JSON
              </button>
            </>
          )}
        </div>
      </div>

      {!schedule ? (
        <div className="stat-card flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No Schedule Yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Click "Generate" to create an optimized weekly schedule using employee scoring, demand forecasting, and labor cost optimization.
          </p>
          <button onClick={handleRegenerate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
            <Zap className="w-4 h-4" /> Generate Schedule
          </button>
        </div>
      ) : (
        <>
          {/* Drag & Drop hint */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 text-accent text-xs font-medium">
            <GripVertical className="w-3.5 h-3.5" />
            Drag shifts between cells to reassign employees or change days. Validations are enforced automatically.
          </div>

          {/* Calendar Grid */}
          <div className="stat-card overflow-x-auto">
            <h2 className="text-sm font-semibold text-foreground mb-4">Weekly Calendar</h2>
            <div className="min-w-[700px]">
              <div className="grid grid-cols-8 gap-px bg-border rounded-lg overflow-hidden">
                <div className="bg-muted p-2 text-xs font-medium text-muted-foreground">Employee</div>
                {DAYS_OF_WEEK.map(d => (
                  <div key={d} className="bg-muted p-2 text-xs font-medium text-muted-foreground text-center">{DAY_LABELS[d]}</div>
                ))}
                {employees.map(emp => {
                  const empShifts = schedule.shifts
                    .map((s, idx) => ({ ...s, _idx: idx }))
                    .filter(s => s.employeeId === emp.id);
                  return (
                    <React.Fragment key={emp.id}>
                      <div className="bg-card p-2 text-xs font-medium text-foreground flex items-center">{emp.name}</div>
                      {DAYS_OF_WEEK.map(day => {
                        const dayShifts = empShifts.filter(s => s.day === day);
                        const isDropZone = dropTarget?.employeeId === emp.id && dropTarget?.day === day;
                        const isDragSource = dragData?.employeeId === emp.id && dragData?.day === day;
                        return (
                          <div
                            key={`${emp.id}-${day}`}
                            className={`bg-card p-1.5 min-h-[56px] transition-colors ${
                              isDropZone ? 'ring-2 ring-accent ring-inset bg-accent/5' : ''
                            } ${isDragSource ? 'opacity-50' : ''}`}
                            onDragOver={e => handleDragOver(e, emp.id, day)}
                            onDragLeave={handleDragLeave}
                            onDrop={e => handleDrop(e, emp.id, day)}
                          >
                            {dayShifts.map((shift) => {
                              const st = stations.find(s => s.id === shift.stationId);
                              const isManual = !shift.score;
                              return (
                                <div
                                  key={shift._idx}
                                  draggable
                                  onDragStart={e => handleDragStart(e, shift, shift._idx)}
                                  onDragEnd={() => { setDragData(null); setDropTarget(null); }}
                                  className={`text-[10px] font-medium px-1.5 py-1 rounded mb-0.5 cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md ${
                                    isManual ? 'ring-1 ring-warning/40' : ''
                                  }`}
                                  style={{
                                    backgroundColor: st ? `${st.color}20` : undefined,
                                    color: st?.color,
                                  }}
                                  title={`${st?.name} | ${shift.timeWindow.start}–${shift.timeWindow.end} | $${shift.shiftCost.toFixed(0)}${shift.score ? ` | Score: ${shift.score.total}` : ' | Manual override'}\nDrag to reassign`}
                                >
                                  <div className="flex items-center gap-0.5">
                                    <GripVertical className="w-2.5 h-2.5 opacity-40 flex-shrink-0" />
                                    <span>{st?.name}</span>
                                    {isManual && <span className="ml-auto text-warning opacity-70">✎</span>}
                                  </div>
                                  <span className="opacity-70">{shift.timeWindow.start}–{shift.timeWindow.end}</span>
                                </div>
                              );
                            })}
                            {dayShifts.length === 0 && isDropZone && (
                              <div className="text-[10px] text-accent/60 text-center py-2">Drop here</div>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Employee Detail */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-4">Employee Schedule Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employees.map(emp => {
                const empShifts = schedule.shifts.filter(s => s.employeeId === emp.id);
                const totalHours = schedule.hoursPerEmployee[emp.id] || 0;
                const totalCost = empShifts.reduce((sum, s) => sum + s.shiftCost, 0);
                return (
                  <div key={emp.id} className="stat-card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{emp.name}</h3>
                        <p className="text-xs text-muted-foreground">${emp.hourlyWage}/hr · {totalHours.toFixed(1)}h · <span className="mono">${totalCost.toFixed(0)}</span></p>
                      </div>
                      {totalHours > emp.maxWeeklyHours && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">OVERTIME</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {empShifts.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No shifts assigned</p>
                      ) : (
                        empShifts.map((shift, i) => {
                          const st = stations.find(s => s.id === shift.stationId);
                          const isManual = !shift.score;
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: st?.color }} />
                              <span className="text-muted-foreground w-12">{DAY_LABELS[shift.day]}</span>
                              <span className="text-foreground">{st?.name}</span>
                              {isManual && <span className="text-[9px] text-warning font-medium px-1 py-0.5 rounded bg-warning/10">MANUAL</span>}
                              <span className="text-muted-foreground mono ml-auto">{shift.timeWindow.start}–{shift.timeWindow.end}</span>
                              <span className="text-muted-foreground mono text-[10px]">${shift.shiftCost.toFixed(0)}</span>
                              {shift.score && <span className="text-[10px] text-accent font-medium">S:{shift.score.total}</span>}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
