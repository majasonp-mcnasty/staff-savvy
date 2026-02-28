import { useAppState } from '@/context/AppContext';
import { DAYS_OF_WEEK, DAY_LABELS, shiftDurationHours } from '@/lib/types';
import { DollarSign, Clock, AlertTriangle, Users, TrendingDown, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const { employees, schedule, generateNewSchedule, stations, budget } = useAppState();

  const costData = schedule
    ? DAYS_OF_WEEK.map(d => ({ day: DAY_LABELS[d], cost: schedule.costPerDay[d] }))
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {schedule ? `Schedule generated ${new Date(schedule.generatedAt).toLocaleString()}` : 'Generate a schedule to see insights'}
          </p>
        </div>
        <button
          onClick={generateNewSchedule}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-card"
        >
          <Zap className="w-4 h-4" />
          Generate Schedule
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Weekly Labor Cost"
          value={schedule ? `$${schedule.totalCost.toFixed(0)}` : '—'}
          sublabel={budget.weeklyBudgetCap ? `Budget: $${budget.weeklyBudgetCap}` : undefined}
          accent="primary"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Active Employees"
          value={String(employees.length)}
          sublabel={`${stations.length} stations`}
          accent="accent"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Warnings"
          value={schedule ? String(schedule.overtimeWarnings.length) : '—'}
          sublabel="Overtime alerts"
          accent={schedule && schedule.overtimeWarnings.length > 0 ? 'warning' : 'success'}
        />
        <StatCard
          icon={<TrendingDown className="w-5 h-5" />}
          label="Understaffed"
          value={schedule ? String(schedule.understaffedAlerts.length) : '—'}
          sublabel="Coverage gaps"
          accent={schedule && schedule.understaffedAlerts.length > 0 ? 'destructive' : 'success'}
        />
      </div>

      {schedule && (
        <>
          {/* Cost Chart */}
          <div className="stat-card">
            <h2 className="text-sm font-semibold text-foreground mb-4">Daily Labor Cost Breakdown</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {schedule.overtimeWarnings.length > 0 && (
              <div className="stat-card border-warning/30">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Overtime Warnings
                </h3>
                <ul className="space-y-2">
                  {schedule.overtimeWarnings.map((w, i) => (
                    <li key={i} className="text-xs text-muted-foreground bg-warning/5 px-3 py-2 rounded-md">{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {schedule.understaffedAlerts.length > 0 && (
              <div className="stat-card border-destructive/30">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Understaffed Alerts
                </h3>
                <ul className="space-y-2">
                  {schedule.understaffedAlerts.map((a, i) => (
                    <li key={i} className="text-xs text-muted-foreground bg-destructive/5 px-3 py-2 rounded-md">{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Employee Hours */}
          <div className="stat-card">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Hours Per Employee
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {employees.map(emp => {
                const hours = schedule.hoursPerEmployee[emp.id] || 0;
                const pct = (hours / emp.maxWeeklyHours) * 100;
                const isOver = hours > emp.maxWeeklyHours;
                return (
                  <div key={emp.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{hours.toFixed(1)}h / {emp.maxWeeklyHours}h</p>
                    </div>
                    <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isOver ? 'bg-destructive' : pct > 80 ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
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

function StatCard({ icon, label, value, sublabel, accent }: {
  icon: React.ReactNode; label: string; value: string; sublabel?: string;
  accent: 'primary' | 'accent' | 'warning' | 'destructive' | 'success';
}) {
  const accentColors = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    success: 'bg-success/10 text-success',
  };

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1 mono">{value}</p>
          {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
        </div>
        <div className={`p-2 rounded-lg ${accentColors[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
