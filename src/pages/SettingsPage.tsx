import { useAppState } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  const { budget, setBudget } = useAppState();

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Budget and optimization configuration</p>
      </div>

      <div className="stat-card space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Budget & Overtime</h2>
        </div>

        <div>
          <Label>Weekly Budget Cap ($)</Label>
          <Input
            type="number"
            min={0}
            value={budget.weeklyBudgetCap ?? ''}
            onChange={e => setBudget(prev => ({ ...prev, weeklyBudgetCap: e.target.value ? +e.target.value : null }))}
            placeholder="No cap"
          />
          <p className="text-xs text-muted-foreground mt-1">Leave empty for no budget cap</p>
        </div>

        <div>
          <Label>Overtime Threshold (hours/week)</Label>
          <Input
            type="number"
            min={1}
            value={budget.overtimeThreshold}
            onChange={e => setBudget(prev => ({ ...prev, overtimeThreshold: +e.target.value }))}
          />
        </div>

        <div>
          <Label>Overtime Multiplier</Label>
          <Input
            type="number"
            min={1}
            step={0.1}
            value={budget.overtimeMultiplier}
            onChange={e => setBudget(prev => ({ ...prev, overtimeMultiplier: +e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">e.g., 1.5 = time and a half</p>
        </div>

        <div>
          <Label>Minimum Rest Between Shifts (hours)</Label>
          <Input
            type="number"
            min={0}
            max={24}
            value={budget.minRestHours}
            onChange={e => setBudget(prev => ({ ...prev, minRestHours: +e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">Minimum gap between shifts on consecutive days (e.g., 8h)</p>
        </div>
      </div>

      <div className="stat-card">
        <h2 className="text-sm font-semibold text-foreground mb-2">Optimization Goals</h2>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Minimize total weekly wage cost</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> Maintain performance and skill balance</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-warning" /> Prevent unnecessary overtime</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-success" /> Evenly distribute shifts</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Avoid short fragmented shifts</li>
        </ul>
      </div>
    </div>
  );
}
