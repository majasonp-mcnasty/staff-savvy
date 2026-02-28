import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { Station, CoverageRequirement, generateId, DAYS_OF_WEEK, DAY_LABELS, DayOfWeek } from '@/lib/types';
import { Plus, Pencil, Trash2, Shield, LayoutGrid } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const COLORS = [
  'hsl(215, 90%, 42%)', 'hsl(172, 66%, 40%)', 'hsl(38, 92%, 50%)',
  'hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)',
];

export default function StationsPage() {
  const { stations, setStations, requirements, setRequirements, employees } = useAppState();
  const [editStation, setEditStation] = useState<Station | null>(null);
  const [isNewStation, setIsNewStation] = useState(false);
  const [editReq, setEditReq] = useState<CoverageRequirement | null>(null);
  const [isNewReq, setIsNewReq] = useState(false);

  function saveStation() {
    if (!editStation || !editStation.name.trim()) return;
    setStations(prev =>
      isNewStation ? [...prev, editStation] : prev.map(s => s.id === editStation.id ? editStation : s)
    );
    setEditStation(null);
  }

  function removeStation(id: string) {
    setStations(prev => prev.filter(s => s.id !== id));
    setRequirements(prev => prev.filter(r => r.stationId !== id));
  }

  function saveReq() {
    if (!editReq) return;
    setRequirements(prev => {
      if (isNewReq) return [...prev, editReq];
      return prev.map(r =>
        r.stationId === editReq.stationId && r.day === editReq.day &&
        r.timeWindow.start === editReq.timeWindow.start ? editReq : r
      );
    });
    setEditReq(null);
  }

  function removeReq(req: CoverageRequirement) {
    setRequirements(prev => prev.filter(r =>
      !(r.stationId === req.stationId && r.day === req.day && r.timeWindow.start === req.timeWindow.start)
    ));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stations & Coverage</h1>
          <p className="text-sm text-muted-foreground mt-1">{stations.length} stations · {requirements.length} coverage rules</p>
        </div>
        <button
          onClick={() => { setEditStation({ id: generateId(), name: '', color: COLORS[stations.length % COLORS.length], isCritical: false }); setIsNewStation(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Station
        </button>
      </div>

      {/* Stations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stations.map(st => {
          const qualifiedCount = employees.filter(e => e.qualifiedStations.includes(st.id)).length;
          return (
            <div key={st.id} className="stat-card group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: st.color }} />
                  <h3 className="font-semibold text-foreground text-sm">{st.name}</h3>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditStation({ ...st }); setIsNewStation(false); }} className="p-1 rounded hover:bg-muted">
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </button>
                  <button onClick={() => removeStation(st.id)} className="p-1 rounded hover:bg-destructive/10">
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {st.isCritical && (
                  <span className="inline-flex items-center gap-1 text-warning font-medium">
                    <Shield className="w-3 h-3" />Critical
                  </span>
                )}
                <span>{qualifiedCount} qualified</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coverage Requirements */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Coverage Requirements</h2>
          <button
            onClick={() => {
              setEditReq({
                stationId: stations[0]?.id || '',
                day: 'monday',
                timeWindow: { start: '08:00', end: '16:00' },
                requiredCount: 1,
              });
              setIsNewReq(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-foreground font-medium text-xs hover:bg-muted/80 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Requirement
          </button>
        </div>

        <div className="stat-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Station</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Day</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Time</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Required</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Min Level</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req, i) => {
                const st = stations.find(s => s.id === req.stationId);
                return (
                  <tr key={i} className="border-b border-border/50 last:border-0 group">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: st?.color }} />
                        <span className="text-foreground text-xs">{st?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-foreground capitalize">{req.day}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground mono">{req.timeWindow.start}–{req.timeWindow.end}</td>
                    <td className="py-2.5 px-3 text-xs text-foreground font-medium">{req.requiredCount}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground capitalize">{req.minSeniorityLevel || 'Any'}</td>
                    <td className="py-2.5 px-3">
                      <button onClick={() => removeReq(req)} className="p-1 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Station Dialog */}
      <Dialog open={!!editStation} onOpenChange={() => setEditStation(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isNewStation ? 'Add Station' : 'Edit Station'}</DialogTitle>
          </DialogHeader>
          {editStation && (
            <div className="space-y-4">
              <div>
                <Label>Station Name</Label>
                <Input value={editStation.name} onChange={e => setEditStation({ ...editStation, name: e.target.value })} placeholder="e.g., Cashier" />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-1.5">
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
                <Switch checked={editStation.isCritical} onCheckedChange={v => setEditStation({ ...editStation, isCritical: v })} />
              </div>
              <button onClick={saveStation} className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
                {isNewStation ? 'Add Station' : 'Save'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Requirement Dialog */}
      <Dialog open={!!editReq} onOpenChange={() => setEditReq(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Coverage Requirement</DialogTitle>
          </DialogHeader>
          {editReq && (
            <div className="space-y-4">
              <div>
                <Label>Station</Label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                  value={editReq.stationId}
                  onChange={e => setEditReq({ ...editReq, stationId: e.target.value })}
                >
                  {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Day</Label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                  value={editReq.day}
                  onChange={e => setEditReq({ ...editReq, day: e.target.value as DayOfWeek })}
                >
                  {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start</Label>
                  <Input type="time" value={editReq.timeWindow.start} onChange={e => setEditReq({ ...editReq, timeWindow: { ...editReq.timeWindow, start: e.target.value } })} />
                </div>
                <div>
                  <Label>End</Label>
                  <Input type="time" value={editReq.timeWindow.end} onChange={e => setEditReq({ ...editReq, timeWindow: { ...editReq.timeWindow, end: e.target.value } })} />
                </div>
              </div>
              <div>
                <Label>Required Employees</Label>
                <Input type="number" min={1} value={editReq.requiredCount} onChange={e => setEditReq({ ...editReq, requiredCount: +e.target.value })} />
              </div>
              <button onClick={saveReq} className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
                Save Requirement
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
