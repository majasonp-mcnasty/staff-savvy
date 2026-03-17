import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { Employee, DayOfWeek, DAYS_OF_WEEK, DAY_LABELS, generateId, TimeWindow, ShiftPreference } from '@/lib/types';
import { Plus, Pencil, Trash2, X, Check, Star, CalendarOff, Award, AlertCircle } from 'lucide-react';
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
    shiftPreference: 'any',
    certifications: [],
  };
}

export default function EmployeesPage() {
  const { employees, setEmployees, stations } = useAppState();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [certInput, setCertInput] = useState('');
  const [ratingError, setRatingError] = useState<string | null>(null);

  function validateRating(value: number): string | null {
    if (isNaN(value)) return 'Enter a value between 1.0 and 5.0 (max 1 decimal place)';
    if (value < 1 || value > 5) return 'Enter a value between 1.0 and 5.0 (max 1 decimal place)';
    const decimalPart = value.toString().split('.')[1];
    if (decimalPart && decimalPart.length > 1) return 'Enter a value between 1.0 and 5.0 (max 1 decimal place)';
    return null;
  }

  function handleRatingChange(rawValue: string) {
    if (!editing) return;
    if (rawValue === '') { setEditing({ ...editing, performanceRating: 1 }); setRatingError(null); return; }
    const num = parseFloat(rawValue);
    const error = validateRating(num);
    setRatingError(error);
    if (!error) {
      setEditing({ ...editing, performanceRating: Math.round(num * 10) / 10 });
    } else {
      setEditing({ ...editing, performanceRating: num });
    }
  }

  function openNew() { setEditing(newEmployee()); setIsNew(true); setRatingError(null); }
  // openEdit moved below
  function openEdit(emp: Employee) {
    setEditing({ ...emp, availability: { ...emp.availability }, certifications: [...(emp.certifications || [])], timeOff: [...(emp.timeOff || [])] });
    setIsNew(false);
    setRatingError(null);
  }
  function save() {
    if (!editing || !editing.name.trim()) return;
    const error = validateRating(editing.performanceRating);
    if (error) { setRatingError(error); return; }
    const normalized = { ...editing, performanceRating: Math.round(editing.performanceRating * 10) / 10 };
    setEmployees(prev => isNew ? [...prev, normalized] : prev.map(e => e.id === normalized.id ? normalized : e));
    setEditing(null);
    setRatingError(null);
  }
  function remove(id: string) { setEmployees(prev => prev.filter(e => e.id !== id)); }

  function toggleStation(stationId: string) {
    if (!editing) return;
    setEditing(prev => {
      if (!prev) return prev;
      const has = prev.qualifiedStations.includes(stationId);
      return { ...prev, qualifiedStations: has ? prev.qualifiedStations.filter(s => s !== stationId) : [...prev.qualifiedStations, stationId] };
    });
  }

  function setDayAvailability(day: DayOfWeek, start: string, end: string) {
    if (!editing) return;
    setEditing(prev => prev ? { ...prev, availability: { ...prev.availability, [day]: start && end ? [{ start, end }] : [] } } : prev);
  }

  function toggleTimeOff(day: DayOfWeek) {
    if (!editing) return;
    setEditing(prev => {
      if (!prev) return prev;
      const has = (prev.timeOff || []).some(to => to.day === day);
      return { ...prev, timeOff: has ? prev.timeOff.filter(to => to.day !== day) : [...prev.timeOff, { day }] };
    });
  }

  function addCert() {
    if (!editing || !certInput.trim()) return;
    if (!(editing.certifications || []).includes(certInput.trim())) {
      setEditing({ ...editing, certifications: [...(editing.certifications || []), certInput.trim()] });
    }
    setCertInput('');
  }

  function removeCert(cert: string) {
    if (!editing) return;
    setEditing({ ...editing, certifications: (editing.certifications || []).filter(c => c !== cert) });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{employees.length} team members</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {employees.map(emp => (
          <div key={emp.id} className="stat-card group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">{emp.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{emp.seniorityLevel} · ${emp.hourlyWage}/hr · {emp.shiftPreference || 'any'}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(emp)} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                <button onClick={() => remove(emp.id)} className="p-1.5 rounded-md hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
              </div>
            </div>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`w-3 h-3 ${s <= emp.performanceRating ? 'fill-warning text-warning' : 'text-muted'}`} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">Max {emp.maxWeeklyHours}h/wk</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {emp.qualifiedStations.map(sid => {
                const st = stations.find(s => s.id === sid);
                return st ? <span key={sid} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{st.name}</span> : null;
              })}
            </div>
            {(emp.certifications || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {(emp.certifications || []).map(c => (
                  <span key={c} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent flex items-center gap-0.5">
                    <Award className="w-2.5 h-2.5" />{c}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1 mb-2">
              {DAYS_OF_WEEK.map(d => {
                const avail = emp.availability[d]?.length > 0;
                const off = (emp.timeOff || []).some(to => to.day === d);
                return (
                  <div key={d} className={`flex-1 text-center text-[10px] font-medium py-1 rounded ${off ? 'bg-destructive/10 text-destructive' : avail ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`} title={off ? 'Time off' : avail ? 'Available' : 'Unavailable'}>
                    {DAY_LABELS[d][0]}
                  </div>
                );
              })}
            </div>
            {(emp.timeOff || []).length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-destructive">
                <CalendarOff className="w-3 h-3" /> {(emp.timeOff || []).length} day(s) off
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isNew ? 'Add Employee' : 'Edit Employee'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Hourly Wage ($)</Label><Input type="number" min={0} value={editing.hourlyWage} onChange={e => setEditing({ ...editing, hourlyWage: +e.target.value })} /></div>
                <div><Label>Max Hours/Week</Label><Input type="number" min={0} value={editing.maxWeeklyHours} onChange={e => setEditing({ ...editing, maxWeeklyHours: +e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
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
                  <Label>Rating (1.0-5.0)</Label>
                  <Input
                    type="number"
                    min={1} max={5} step={0.1}
                    value={editing.performanceRating}
                    onChange={e => handleRatingChange(e.target.value)}
                    className={ratingError ? 'border-destructive' : ''}
                  />
                  {ratingError && (
                    <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{ratingError}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Shift Pref</Label>
                  <Select value={editing.shiftPreference || 'any'} onValueChange={v => setEditing({ ...editing, shiftPreference: v as ShiftPreference })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Certifications</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={certInput} onChange={e => setCertInput(e.target.value)} placeholder="e.g., food-safety" className="flex-1" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCert())} />
                  <button onClick={addCert} className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(editing.certifications || []).map(c => (
                    <span key={c} className="text-xs font-medium px-2 py-1 rounded-full bg-accent/10 text-accent flex items-center gap-1">
                      {c}<button onClick={() => removeCert(c)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <Label>Qualified Stations</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {stations.map(st => {
                    const selected = editing.qualifiedStations.includes(st.id);
                    return (
                      <button key={st.id} onClick={() => toggleStation(st.id)} className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:border-primary/50'}`}>
                        {selected && <Check className="w-3 h-3 inline mr-1" />}{st.name}
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
                        <Input type="time" className="flex-1 text-xs" value={tw?.start || ''} onChange={e => setDayAvailability(day, e.target.value, tw?.end || '17:00')} />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input type="time" className="flex-1 text-xs" value={tw?.end || ''} onChange={e => setDayAvailability(day, tw?.start || '09:00', e.target.value)} />
                        {tw && <button onClick={() => setDayAvailability(day, '', '')} className="p-1 rounded hover:bg-destructive/10"><X className="w-3 h-3 text-destructive" /></button>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Time Off Requests</Label>
                <p className="text-xs text-muted-foreground mb-1.5">Select days this employee has requested off</p>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map(day => {
                    const isOff = (editing.timeOff || []).some(to => to.day === day);
                    return (
                      <button key={day} onClick={() => toggleTimeOff(day)} className={`flex-1 text-center text-[11px] font-medium py-2 rounded-md border transition-all ${isOff ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-muted text-muted-foreground border-border hover:border-primary/50'}`}>
                        {DAY_LABELS[day]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={save} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">{isNew ? 'Add Employee' : 'Save Changes'}</button>
                <button onClick={() => setEditing(null)} className="px-4 py-2.5 rounded-lg bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
