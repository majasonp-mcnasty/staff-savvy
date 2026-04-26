import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '@/context/AppContext';
import { useDateContext, formatTimeWindow } from '@/context/DateContext';
import {
  Employee, DayOfWeek, DAYS_OF_WEEK, DAY_LABELS, DAY_FULL_LABELS,
  generateId, TimeWindow, ShiftPreference,
} from '@/lib/types';
import {
  Plus, Pencil, Trash2, X, Check, Star, CalendarOff, Award,
  AlertCircle, Calendar, Clock, ChevronDown, ChevronRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import UnsavedChangesBar from '@/components/UnsavedChangesBar';
import { validateRating, normalizeRating } from '@/lib/validation';

const EMPTY_AVAILABILITY: Record<DayOfWeek, TimeWindow[]> = {
  monday: [], tuesday: [], wednesday: [], thursday: [],
  friday: [], saturday: [], sunday: [],
};

function newEmployee(): Employee {
  return {
    id: generateId(), name: '', hourlyWage: 15, maxWeeklyHours: 40,
    performanceRating: 3, seniorityLevel: 'junior',
    qualifiedStations: [], availability: { ...EMPTY_AVAILABILITY },
    timeOff: [], shiftPreference: 'any', certifications: [],
    memberSince: format(new Date(), 'yyyy-MM-dd'),
  };
}

function formatMemberSince(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'MMM d, yyyy'); } catch { return '—'; }
}

// ── Availability Grid ─────────────────────────────────────────────────────────
interface AvailGridProps {
  availability: Record<DayOfWeek, TimeWindow[]>;
  timeOff: Employee['timeOff'];
  onChangeAvail: (day: DayOfWeek, start: string, end: string) => void;
  onToggleTimeOff: (day: DayOfWeek) => void;
  currentWeek: Date[];
}

function AvailabilityGrid({ availability, timeOff, onChangeAvail, onToggleTimeOff, currentWeek }: AvailGridProps) {
  return (
    <div className="space-y-1.5">
      {DAYS_OF_WEEK.map((day, i) => {
        const tw = availability[day]?.[0];
        const isOff = (timeOff ?? []).some(t => t.day === day);
        const date = currentWeek[i];
        const dateLabel = date ? format(date, 'MMM d') : DAY_LABELS[day];
        return (
          <div key={day} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${isOff ? 'border-destructive/30 bg-destructive/5' : tw ? 'border-success/30 bg-success/5' : 'border-border bg-muted/30'}`}>
            <div className="w-16 flex-shrink-0">
              <p className="text-xs font-medium text-foreground">{DAY_LABELS[day]}</p>
              <p className="text-[10px] text-muted-foreground">{dateLabel}</p>
            </div>
            {isOff ? (
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-destructive font-medium">Time Off</span>
                <button onClick={() => onToggleTimeOff(day)} className="ml-auto text-[10px] text-muted-foreground hover:text-destructive transition-colors">Remove</button>
              </div>
            ) : (
              <>
                <Input type="time" className="flex-1 h-7 text-xs" value={tw?.start ?? ''} onChange={e => onChangeAvail(day, e.target.value, tw?.end ?? '17:00')} />
                <span className="text-[10px] text-muted-foreground">–</span>
                <Input type="time" className="flex-1 h-7 text-xs" value={tw?.end ?? ''} onChange={e => onChangeAvail(day, tw?.start ?? '09:00', e.target.value)} />
                {tw && <button onClick={() => onChangeAvail(day, '', '')} className="p-1 rounded hover:bg-destructive/10 flex-shrink-0"><X className="w-3 h-3 text-destructive" /></button>}
                {!tw && (
                  <button
                    onClick={() => onChangeAvail(day, '09:00', '17:00')}
                    className="text-[10px] text-primary hover:underline flex-shrink-0 ml-1"
                  >Add</button>
                )}
              </>
            )}
            {!isOff && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onToggleTimeOff(day)} className="p-1 rounded hover:bg-warning/10 flex-shrink-0">
                    <CalendarOff className="w-3 h-3 text-muted-foreground hover:text-warning" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Mark time off</TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Employee Card ─────────────────────────────────────────────────────────────
interface EmpCardProps {
  emp: Employee;
  stations: ReturnType<typeof useAppState>['stations'];
  schedule: ReturnType<typeof useAppState>['schedule'];
  currentWeek: Date[];
  onEdit: (emp: Employee) => void;
  onDelete: (id: string) => void;
  onMarkUnavailable: (id: string) => void;
  onViewSchedule: (id: string) => void;
}

function EmployeeCard({ emp, stations, schedule, currentWeek, onEdit, onDelete, onMarkUnavailable, onViewSchedule }: EmpCardProps) {
  const [showAvail, setShowAvail] = useState(false);

  const empShifts = schedule?.shifts.filter(s => s.employeeId === emp.id) ?? [];
  const nextShift = empShifts.length > 0 ? empShifts[0] : null;
  const lastShift = empShifts.length > 0 ? empShifts[empShifts.length - 1] : null;

  function getShiftDate(day: DayOfWeek): string {
    const idx: Record<DayOfWeek, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
    const date = currentWeek[idx[day]];
    return date ? format(date, 'MMM d') : day;
  }

  return (
    <div className="stat-card group space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{emp.name}</h3>
          <p className="text-xs text-muted-foreground capitalize">{emp.seniorityLevel} · ${emp.hourlyWage}/hr · {emp.shiftPreference ?? 'any'}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => onViewSchedule(emp.id)} className="p-1.5 rounded-md hover:bg-muted"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">View Schedule</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => onEdit(emp)} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Edit Employee (E)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => onDelete(emp.id)} className="p-1.5 rounded-md hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Stars + hours */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <Star key={s} className={`w-3 h-3 ${emp.performanceRating >= s ? 'fill-warning text-warning' : emp.performanceRating >= s - 0.5 ? 'fill-warning/50 text-warning' : 'text-muted'}`} />
        ))}
        <span className="text-xs text-muted-foreground ml-1">{emp.performanceRating.toFixed(1)} · Max {emp.maxWeeklyHours}h/wk</span>
      </div>

      {/* Stations */}
      {emp.qualifiedStations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {emp.qualifiedStations.map(sid => {
            const st = stations.find(s => s.id === sid);
            return st ? (
              <span key={sid} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${st.color}20`, color: st.color }}>
                {st.name}
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Certifications */}
      {(emp.certifications ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(emp.certifications ?? []).map(c => (
            <span key={c} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent flex items-center gap-0.5">
              <Award className="w-2.5 h-2.5" />{c}
            </span>
          ))}
        </div>
      )}

      {/* Week availability strip */}
      <div className="flex gap-0.5">
        {DAYS_OF_WEEK.map((d, i) => {
          const avail = (emp.availability[d]?.length ?? 0) > 0;
          const off = (emp.timeOff ?? []).some(to => to.day === d);
          const date = currentWeek[i];
          return (
            <Tooltip key={d}>
              <TooltipTrigger asChild>
                <div className={`flex-1 text-center text-[9px] font-medium py-1 rounded ${off ? 'bg-destructive/10 text-destructive' : avail ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {DAY_LABELS[d][0]}
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {off ? `Time off ${date ? format(date, 'MMM d') : ''}` : avail ? `Available ${date ? format(date, 'MMM d') : ''} · ${formatTimeWindow(emp.availability[d][0].start, emp.availability[d][0].end)}` : `Unavailable`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {emp.memberSince && (
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground/70">Member since</span><br />
            {formatMemberSince(emp.memberSince)}
          </div>
        )}
        {nextShift && (
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground/70">Next shift</span><br />
            {getShiftDate(nextShift.day)} · {formatTimeWindow(nextShift.timeWindow.start, nextShift.timeWindow.end)}
          </div>
        )}
        {lastShift && nextShift && lastShift.day !== nextShift.day && (
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground/70">Last shift</span><br />
            {getShiftDate(lastShift.day)}
          </div>
        )}
      </div>

      {/* Toggle availability detail */}
      <button
        onClick={() => setShowAvail(v => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showAvail ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {showAvail ? 'Hide' : 'Show'} weekly availability
      </button>

      {showAvail && (
        <div className="space-y-1 pt-1">
          {DAYS_OF_WEEK.map((d, i) => {
            const tw = emp.availability[d]?.[0];
            const off = (emp.timeOff ?? []).some(to => to.day === d);
            const date = currentWeek[i];
            if (!tw && !off) return null;
            return (
              <div key={d} className="text-[11px] text-muted-foreground flex items-center gap-2">
                <span className="w-24 font-medium text-foreground/70">
                  {DAY_LABELS[d]} {date ? format(date, 'MMM d') : ''}
                </span>
                {off ? (
                  <span className="text-destructive">Time off</span>
                ) : tw ? (
                  <span>{formatTimeWindow(tw.start, tw.end)}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-1.5 pt-1 border-t border-border">
        <button
          onClick={() => onMarkUnavailable(emp.id)}
          className="flex-1 text-[11px] font-medium px-2 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
        >
          ⏸ Unavailable This Week
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { employeesDraft, setEmployeesDraft, saveEmployees, discardEmployees, stations, schedule, dbLoading } = useAppState();
  const { currentWeek } = useDateContext();
  const navigate = useNavigate();
  const draft = employeesDraft.draft;
  const isDirty = employeesDraft.isDirty;

  const [editing, setEditing] = useState<Employee | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [certInput, setCertInput] = useState('');
  const [ratingError, setRatingError] = useState<string | null>(null);

  function handleRatingChange(raw: string) {
    if (!editing) return;
    if (raw === '') { setEditing({ ...editing, performanceRating: 1 }); setRatingError(null); return; }
    const num = parseFloat(raw);
    const error = validateRating(num);
    setRatingError(error);
    setEditing({ ...editing, performanceRating: error ? num : normalizeRating(num) });
  }

  function openNew() { setEditing(newEmployee()); setIsNew(true); setRatingError(null); setCertInput(''); }

  function openEdit(emp: Employee) {
    setEditing({ ...emp, availability: { ...emp.availability }, certifications: [...(emp.certifications ?? [])], timeOff: [...(emp.timeOff ?? [])] });
    setIsNew(false); setRatingError(null); setCertInput('');
  }

  function saveDialog() {
    if (!editing || !editing.name.trim()) return;
    const error = validateRating(editing.performanceRating);
    if (error) { setRatingError(error); return; }
    const normalized = { ...editing, performanceRating: normalizeRating(editing.performanceRating) };
    setEmployeesDraft(prev => isNew ? [...prev, normalized] : prev.map(e => e.id === normalized.id ? normalized : e));
    setEditing(null);
  }

  function remove(id: string) {
    const emp = draft.find(e => e.id === id);
    setEmployeesDraft(prev => prev.filter(e => e.id !== id));
    toast(`Removed ${emp?.name ?? 'employee'}`, {
      action: { label: 'Undo', onClick: () => setEmployeesDraft(prev => [...prev, emp!]) },
      duration: 5000,
    });
  }

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
      const has = (prev.timeOff ?? []).some(to => to.day === day);
      return { ...prev, timeOff: has ? prev.timeOff.filter(to => to.day !== day) : [...prev.timeOff, { day }] };
    });
  }

  function addCert() {
    if (!editing || !certInput.trim()) return;
    if (!(editing.certifications ?? []).includes(certInput.trim())) {
      setEditing({ ...editing, certifications: [...(editing.certifications ?? []), certInput.trim()] });
    }
    setCertInput('');
  }

  function removeCert(cert: string) {
    if (!editing) return;
    setEditing({ ...editing, certifications: (editing.certifications ?? []).filter(c => c !== cert) });
  }

  function handleMarkUnavailable(empId: string) {
    const emp = draft.find(e => e.id === empId);
    if (!emp) return;
    const allTimeOff = DAYS_OF_WEEK.map(day => ({ day }));
    setEmployeesDraft(prev => prev.map(e => e.id === empId ? { ...e, timeOff: allTimeOff } : e));
    toast.success(`${emp.name} marked unavailable this week`);
  }

  function handleViewSchedule(empId: string) {
    navigate('/schedule');
  }

  if (dbLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-32" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{draft.length} team members</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Empty state */}
      {draft.length === 0 && (
        <div className="stat-card flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No employees yet</h2>
          <p className="text-sm text-muted-foreground mb-4">Add your first team member to start building schedules.</p>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {draft.map(emp => (
          <EmployeeCard
            key={emp.id}
            emp={emp}
            stations={stations}
            schedule={schedule}
            currentWeek={currentWeek}
            onEdit={openEdit}
            onDelete={remove}
            onMarkUnavailable={handleMarkUnavailable}
            onViewSchedule={handleViewSchedule}
          />
        ))}
      </div>

      {/* Inline edit Sheet */}
      <Sheet open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isNew ? 'Add Employee' : 'Edit Employee'}</SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-5 mt-4">
              {/* Name */}
              <div>
                <Label>Full Name</Label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Full name" className="mt-1" />
              </div>

              {/* Wage + hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hourly Wage ($)</Label>
                  <Input type="number" min={0} value={editing.hourlyWage} onChange={e => setEditing({ ...editing, hourlyWage: +e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Max Hours/Week</Label>
                  <Input type="number" min={0} value={editing.maxWeeklyHours} onChange={e => setEditing({ ...editing, maxWeeklyHours: +e.target.value })} className="mt-1" />
                </div>
              </div>

              {/* Seniority + rating + pref */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Seniority</Label>
                  <Select value={editing.seniorityLevel} onValueChange={v => setEditing({ ...editing, seniorityLevel: v as Employee['seniorityLevel'] })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">Junior</SelectItem>
                      <SelectItem value="mid">Mid</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rating (1–5)</Label>
                  <Input type="number" min={1} max={5} step={0.1} value={editing.performanceRating} onChange={e => handleRatingChange(e.target.value)} className={`mt-1 ${ratingError ? 'border-destructive' : ''}`} />
                  {ratingError && <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{ratingError}</p>}
                </div>
                <div>
                  <Label>Shift Pref</Label>
                  <Select value={editing.shiftPreference ?? 'any'} onValueChange={v => setEditing({ ...editing, shiftPreference: v as ShiftPreference })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Member since */}
              <div>
                <Label>Member Since</Label>
                <Input type="date" value={editing.memberSince ?? ''} onChange={e => setEditing({ ...editing, memberSince: e.target.value || null })} className="mt-1" />
              </div>

              {/* Certifications */}
              <div>
                <Label>Certifications</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={certInput} onChange={e => setCertInput(e.target.value)} placeholder="e.g., food-safety" className="flex-1" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCert())} />
                  <button onClick={addCert} className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(editing.certifications ?? []).map(c => (
                    <span key={c} className="text-xs font-medium px-2 py-1 rounded-full bg-accent/10 text-accent flex items-center gap-1">
                      {c}<button onClick={() => removeCert(c)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Qualified stations */}
              <div>
                <Label>Qualified Stations</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {stations.map(st => {
                    const selected = editing.qualifiedStations.includes(st.id);
                    return (
                      <button key={st.id} onClick={() => toggleStation(st.id)} className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${selected ? 'text-white border-transparent' : 'bg-muted text-muted-foreground border-border hover:border-primary/50'}`} style={selected ? { backgroundColor: st.color, borderColor: st.color } : {}}>
                        {selected && <Check className="w-3 h-3 inline mr-1" />}{st.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Availability grid */}
              <div>
                <Label>Weekly Availability</Label>
                <p className="text-xs text-muted-foreground mb-2 mt-0.5">Set available hours. Use the calendar icon to mark time off.</p>
                <AvailabilityGrid
                  availability={editing.availability}
                  timeOff={editing.timeOff}
                  onChangeAvail={setDayAvailability}
                  onToggleTimeOff={toggleTimeOff}
                  currentWeek={currentWeek}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 pb-4">
                <button onClick={saveDialog} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
                  {isNew ? 'Add Employee' : 'Save Changes'}
                </button>
                <button onClick={() => setEditing(null)} className="px-4 py-2.5 rounded-lg bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <UnsavedChangesBar isDirty={isDirty} onSave={saveEmployees} onDiscard={discardEmployees} />
    </div>
  );
}

// Fix missing import
function Users(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
