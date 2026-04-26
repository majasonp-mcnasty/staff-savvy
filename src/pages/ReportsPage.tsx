import { useAppState } from '@/context/AppContext';
import { useDateContext } from '@/context/DateContext';
import { DAYS_OF_WEEK, DAY_LABELS, shiftDurationHours } from '@/lib/types';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileBarChart, Users, DollarSign, Clock, Shield, AlertTriangle } from 'lucide-react';

const CHART_COLORS = [
  'hsl(215, 90%, 42%)', 'hsl(172, 66%, 40%)', 'hsl(38, 92%, 50%)',
  'hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)',
];

export default function ReportsPage() {
  const { schedule, employees, stations, budget } = useAppState();
  const { currentWeekLabel } = useDateContext();

  if (!schedule) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate a schedule first to view reports</p>
        </div>
        <div className="stat-card flex flex-col items-center justify-center py-16 text-center">
          <FileBarChart className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No Data Yet</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Go to the Schedule page and generate a schedule to see labor analytics, utilization reports, and coverage insights.
          </p>
        </div>
      </div>
    );
  }

  // Employee utilization data
  const utilizationData = employees.map(emp => {
    const hours = schedule.hoursPerEmployee[emp.id] || 0;
    const utilization = emp.maxWeeklyHours > 0 ? (hours / emp.maxWeeklyHours) * 100 : 0;
    return { name: emp.name, hours, max: emp.maxWeeklyHours, utilization: Math.round(utilization) };
  }).sort((a, b) => b.utilization - a.utilization);

  // Cost by day
  const costByDay = DAYS_OF_WEEK.map(d => ({
    day: DAY_LABELS[d],
    cost: schedule.costPerDay[d],
    shifts: schedule.shifts.filter(s => s.day === d).length,
  }));

  // Shifts by station
  const stationShifts = stations.map(st => ({
    name: st.name,
    count: schedule.shifts.filter(s => s.stationId === st.id).length,
    hours: schedule.shifts.filter(s => s.stationId === st.id).reduce((sum, s) => sum + shiftDurationHours(s.timeWindow), 0),
    color: st.color,
  }));

  // Score distribution
  const scores = schedule.shifts.filter(s => s.score).map(s => s.score!.total);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  const { validationSummary } = schedule;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {currentWeekLabel} · {schedule.shifts.length} shifts · Generated {format(new Date(schedule.generatedAt), 'MMM d, h:mm a')}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniCard icon={<DollarSign className="w-4 h-4" />} label="Total Cost" value={`$${schedule.totalCost.toFixed(0)}`} sublabel={schedule.laborSummary.budgetStatus === 'over_budget' ? '⚠ Over budget' : schedule.laborSummary.budgetStatus === 'within_budget' ? '✓ Within budget' : 'No cap set'} />
        <MiniCard icon={<Users className="w-4 h-4" />} label="Employees Scheduled" value={String(utilizationData.filter(u => u.hours > 0).length)} sublabel={`of ${employees.length} total`} />
        <MiniCard icon={<Clock className="w-4 h-4" />} label="Avg Score" value={avgScore.toFixed(0)} sublabel={`Range: ${minScore}–${maxScore}`} />
        <MiniCard icon={<Shield className="w-4 h-4" />} label="Coverage" value={validationSummary.coverageComplete ? 'Complete' : 'Gaps'} sublabel={`${schedule.understaffedAlerts.length} understaffed`} />
      </div>

      {/* Validation Summary */}
      {(validationSummary.hardConstraintViolations.length > 0 || validationSummary.fairnessIssues.length > 0 || validationSummary.schedulingConflicts.length > 0) && (
        <div className="stat-card border-warning/30">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" /> Validation Summary
          </h3>
          <div className="space-y-2">
            {validationSummary.hardConstraintViolations.map((v, i) => (
              <p key={i} className="text-xs text-destructive bg-destructive/5 px-3 py-2 rounded-md">{v}</p>
            ))}
            {validationSummary.fairnessIssues.map((v, i) => (
              <p key={i} className="text-xs text-warning bg-warning/5 px-3 py-2 rounded-md">{v}</p>
            ))}
            {validationSummary.schedulingConflicts.map((v, i) => (
              <p key={i} className="text-xs text-destructive bg-destructive/5 px-3 py-2 rounded-md">{v}</p>
            ))}
          </div>
        </div>
      )}

      {/* Cost by Day Chart */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Labor Cost by Day</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={costByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }}
                formatter={(value: number, name: string) => [name === 'cost' ? `$${value.toFixed(2)}` : value, name === 'cost' ? 'Cost' : 'Shifts']}
              />
              <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Employee Utilization */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Employee Utilization</h3>
          <div className="space-y-3">
            {utilizationData.map(emp => (
              <div key={emp.name} className="flex items-center gap-3">
                <span className="text-xs font-medium text-foreground w-28 truncate">{emp.name}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      emp.utilization > 100 ? 'bg-destructive' : emp.utilization > 80 ? 'bg-warning' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(emp.utilization, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground mono w-16 text-right">{emp.hours.toFixed(1)}h/{emp.max}h</span>
                <span className={`text-[10px] font-semibold w-10 text-right ${
                  emp.utilization > 100 ? 'text-destructive' : emp.utilization > 80 ? 'text-warning' : 'text-success'
                }`}>{emp.utilization}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Station Distribution */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Shifts by Station</h3>
          <div className="flex items-center gap-6">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stationShifts} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                    {stationShifts.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`${value} shifts`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {stationShifts.map(st => (
                <div key={st.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.color }} />
                  <span className="text-xs font-medium text-foreground flex-1">{st.name}</span>
                  <span className="text-xs text-muted-foreground mono">{st.count} shifts · {st.hours.toFixed(0)}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Labor Cost Breakdown */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Labor Cost Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Regular Cost</p>
            <p className="text-lg font-bold text-foreground mono">${schedule.laborSummary.regularCost.toFixed(0)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overtime Cost</p>
            <p className="text-lg font-bold text-warning mono">${schedule.laborSummary.overtimeCost.toFixed(0)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget Cap</p>
            <p className="text-lg font-bold text-foreground mono">{budget.weeklyBudgetCap ? `$${budget.weeklyBudgetCap}` : '—'}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">OT Threshold</p>
            <p className="text-lg font-bold text-foreground mono">{budget.overtimeThreshold}h</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ icon, label, value, sublabel }: { icon: React.ReactNode; label: string; value: string; sublabel: string }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary">{icon}</div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold text-foreground mono">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
    </div>
  );
}
