import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { Employee, DayOfWeek, DAYS_OF_WEEK, DAY_LABELS, generateId, TimeWindow, TimeOffRequest } from '@/lib/types';
import { Plus, Pencil, Trash2, X, Check, Star, CalendarOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY_AVAILABILITY: Record<DayOfWeek, TimeWindow[]> = {
  monday: [], tuesday: [], wednesday: [], thursday: [],
  friday: [], saturday: [], sunday: [],
};

function newEmployee(): Employee {
  return {
    id: generateId(),
    name: '', hourlyWage: 15, maxWeeklyHours: 40,
    performanceRating: 3, seniorityLevel: 'junior',
    qualifiedStations: [],
    availability: { ...EMPTY_AVAILABILITY },
    timeOff: [],
  };
}

export default function EmployeesPage() {
  const { employees, setEmployees, stations } = useAppState();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [isNew, setIsNew] = useState(false);

  function openNew() {
    setEditing(newEmployee());
    setIsNew(true);
  }
  function openEdit(emp: Employee) {
    setEditing({ ...emp, availability: { ...emp.availability } });
    setIsNew(false);
  }
  function save() {
    if (!editing || !editing.name.trim()) return;
    setEmployees(prev =>
      isNew ? [...prev, editing] : prev.map(e => e.id === editing.id ? editing : e)
    );
    setEditing(null);
  }
  function remove(id: string) {
    setEmployees(prev => prev.filter(e => e.id !== id));
  }

  function toggleStation(stationId: string) {
    if (!editing) return;
    setEditing(prev => {
      if (!prev) return prev;
      const has = prev.qualifiedStations.includes(stationId);
      return {
        ...prev,
        qualifiedStations: has
          ? prev.qualifiedStations.filter(s => s !== stationId)
          : [...prev.qualifiedStations, stationId],
      };
    });
  }

  function setDayAvailability(day: DayOfWeek, start: string, end: string) {
    if (!editing) return;
    setEditing(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: start && end ? [{ start, end }] : [],
        },
      };
    });
  }

  function toggleTimeOff(day: DayOfWeek) {
    if (!editing) return;
    setEditing(prev => {
      if (!prev) return prev;
      const has = prev.timeOff.some(to => to.day === day);
      return {
        ...prev,
        timeOff: has
          ? prev.timeOff.filter(to => to.day !== day)
          : [...prev.timeOff, { day }],
      };
    });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{employees.length} team members</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {employees.map(emp => (
          <div key={emp.id} className="stat-card group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">{emp.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{emp.seniorityLevel} · ${emp.hourlyWage}/hr</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(emp)} className="p-1.5 rounded-md hover:bg-muted">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => remove(emp.id)} className="p-1.5 rounded-md hover:bg-destructive/10">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`w-3 h-3 ${s <= emp.performanceRating ? 'fill-warning text-warning' : 'text-muted'}`} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">Max {emp.maxWeeklyHours}h/wk</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {emp.qualifiedStations.map(sid => {
                const st = stations.find(s => s.id === sid);
                return st ? (
                  <span key={sid} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {st.name}
                  </span>
                ) : null;
              })}
            </div>
            <div className="flex gap-1 mb-2">
              {DAYS_OF_WEEK.map(d => {
                const avail = emp.availability[d]?.length > 0;
                const off = emp.timeOff.some(to => to.day === d);
                return (
                  <div
                    key={d}
                    className={`flex-1 text-center text-[10px] font-medium py-1 rounded ${
                      off ? 'bg-destructive/10 text-destructive' : avail ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                    }`}
                    title={off ? 'Time off' : avail ? 'Available' : 'Unavailable'}
                  >
                    {DAY_LABELS[d][0]}
                  </div>
                );
              })}
            </div>
            {emp.timeOff.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-destructive">
                <CalendarOff className="w-3 h-3" />
                {emp.timeOff.length} day(s) off
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add Employee' : 'Edit Employee'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hourly Wage ($)</Label>
                  <Input type="number" min={0} value={editing.hourlyWage} onChange={e => setEditing({ ...editing, hourlyWage: +e.target.value })} />
                </div>
                <div>
                  <Label>Max Hours/Week</Label>
                  <Input type="number" min={0} value={editing.maxWeeklyHours} onChange={e => setEditing({ ...editing, maxWeeklyHours: +e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Seniority</Label>
                  <Select value={editing.seniorityLevel} onValueChange={v => setEditing({ ...editing, seniorityLevel: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">Junior</SelectItem>
                      <SelectItem value="mid">Mid</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rating (1-5)</Label>
                  <Input type="number" min={1} max={5} value={editing.performanceRating} onChange={e => setEditing({ ...editing, performanceRating: Math.min(5, Math.max(1, +e.target.value)) })} />
                </div>
              </div>

              <div>
                <Label>Qualified Stations</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {stations.map(st => {
                    const selected = editing.qualifiedStations.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        onClick={() => toggleStation(st.id)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                          selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 inline mr-1" />}
                        {st.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Weekly Availability</Label>
                <div className="space-y-2 mt-1.5">
                  {DAYS_OF_WEEK.map(day => {
                    const tw = editing.availability[day]?.[0];
                    return (
                      <div key={day} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-10">{DAY_LABELS[day]}</span>
                        <Input
                          type="time"
                          className="flex-1 text-xs"
                          value={tw?.start || ''}
                          onChange={e => setDayAvailability(day, e.target.value, tw?.end || '17:00')}
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="time"
                          className="flex-1 text-xs"
                          value={tw?.end || ''}
                          onChange={e => setDayAvailability(day, tw?.start || '09:00', e.target.value)}
                        />
                        {tw && (
                          <button onClick={() => setDayAvailability(day, '', '')} className="p-1 rounded hover:bg-destructive/10">
                            <X className="w-3 h-3 text-destructive" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={save}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  {isNew ? 'Add Employee' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-2.5 rounded-lg bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
