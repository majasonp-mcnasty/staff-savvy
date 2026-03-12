import { useAppState } from '@/context/AppContext';
import { DAYS_OF_WEEK, DAY_FULL_LABELS, DAY_LABELS, shiftDurationHours } from '@/lib/types';
import { Zap, Download, RefreshCw, Calendar, FileJson } from 'lucide-react';

export default function SchedulePage() {
  const { schedule, employees, stations, generateNewSchedule } = useAppState();

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
        shift.score?.total?.toString() || '',
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
            score: s.score?.total || 0,
          };
        }),
      ])),
      labor_summary: schedule.laborSummary,
      demand_forecast: schedule.demandForecast,
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Weekly Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {schedule ? `${schedule.shifts.length} shifts · $${schedule.totalCost.toFixed(0)} total cost` : 'No schedule generated yet'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={generateNewSchedule} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
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
          <button onClick={generateNewSchedule} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
            <Zap className="w-4 h-4" /> Generate Schedule
          </button>
        </div>
      ) : (
        <>
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
                  const empShifts = schedule.shifts.filter(s => s.employeeId === emp.id);
                  return (
                    <React.Fragment key={emp.id}>
                      <div className="bg-card p-2 text-xs font-medium text-foreground flex items-center">{emp.name}</div>
                      {DAYS_OF_WEEK.map(day => {
                        const dayShifts = empShifts.filter(s => s.day === day);
                        return (
                          <div key={`${emp.id}-${day}`} className="bg-card p-1.5 min-h-[48px]">
                            {dayShifts.map((shift, i) => {
                              const st = stations.find(s => s.id === shift.stationId);
                              return (
                                <div key={i} className="text-[10px] font-medium px-1.5 py-1 rounded mb-0.5" style={{ backgroundColor: st ? `${st.color}20` : undefined, color: st?.color }} title={`Score: ${shift.score?.total || 'N/A'} | Cost: $${shift.shiftCost.toFixed(2)}`}>
                                  {st?.name}<br />
                                  <span className="opacity-70">{shift.timeWindow.start}–{shift.timeWindow.end}</span>
                                </div>
                              );
                            })}
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
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: st?.color }} />
                              <span className="text-muted-foreground w-12">{DAY_LABELS[shift.day]}</span>
                              <span className="text-foreground">{st?.name}</span>
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

// Need React import for Fragment
import React from 'react';
