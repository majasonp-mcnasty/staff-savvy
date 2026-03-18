import { useAppState } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, BarChart3, Target, Brain } from 'lucide-react';
import UnsavedChangesBar from '@/components/UnsavedChangesBar';
import { weightSum } from '@/lib/validation';

export default function SettingsPage() {
  const { settingsDraft, setSettingsDraft, saveSettings, discardSettings } = useAppState();
  const draft = settingsDraft.draft;
  const isDirty = settingsDraft.isDirty;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl pb-20">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Budget, scoring, and forecast configuration</p>
      </div>

      {/* Budget & Overtime */}
      <div className="stat-card space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Budget & Overtime</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Weekly Budget Cap ($)</Label>
            <Input
              type="number" min={0}
              value={draft.budget.weeklyBudgetCap ?? ''}
              onChange={e => setSettingsDraft(prev => ({ ...prev, budget: { ...prev.budget, weeklyBudgetCap: e.target.value ? +e.target.value : null } }))}
              placeholder="No cap"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave empty for no cap</p>
          </div>
          <div>
            <Label>Overtime Threshold (hrs/wk)</Label>
            <Input
              type="number" min={1}
              value={draft.budget.overtimeThreshold}
              onChange={e => setSettingsDraft(prev => ({ ...prev, budget: { ...prev.budget, overtimeThreshold: +e.target.value } }))}
            />
          </div>
          <div>
            <Label>Overtime Multiplier</Label>
            <Input
              type="number" min={1} step={0.1}
              value={draft.budget.overtimeMultiplier}
              onChange={e => setSettingsDraft(prev => ({ ...prev, budget: { ...prev.budget, overtimeMultiplier: +e.target.value } }))}
            />
            <p className="text-xs text-muted-foreground mt-1">e.g., 1.5 = time and a half</p>
          </div>
          <div>
            <Label>Min Rest Between Shifts (hrs)</Label>
            <Input
              type="number" min={0} max={24}
              value={draft.budget.minRestHours}
              onChange={e => setSettingsDraft(prev => ({ ...prev, budget: { ...prev.budget, minRestHours: +e.target.value } }))}
            />
          </div>
        </div>
      </div>

      {/* Employee Scoring Weights */}
      <div className="stat-card space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Employee Scoring Weights</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">Weights must sum to 1.0. Controls how employees are ranked for shift assignment.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <WeightInput label="Availability" value={draft.scoringWeights.availability}
            onChange={v => setSettingsDraft(prev => ({ ...prev, scoringWeights: { ...prev.scoringWeights, availability: v } }))} description="Schedule overlap (35%)" />
          <WeightInput label="Experience" value={draft.scoringWeights.experience}
            onChange={v => setSettingsDraft(prev => ({ ...prev, scoringWeights: { ...prev.scoringWeights, experience: v } }))} description="Seniority + rating (20%)" />
          <WeightInput label="Preference" value={draft.scoringWeights.preference}
            onChange={v => setSettingsDraft(prev => ({ ...prev, scoringWeights: { ...prev.scoringWeights, preference: v } }))} description="Shift time pref (10%)" />
          <WeightInput label="Fairness" value={draft.scoringWeights.fairness}
            onChange={v => setSettingsDraft(prev => ({ ...prev, scoringWeights: { ...prev.scoringWeights, fairness: v } }))} description="Workload balance (15%)" />
          <WeightInput label="Labor Efficiency" value={draft.scoringWeights.laborEfficiency}
            onChange={v => setSettingsDraft(prev => ({ ...prev, scoringWeights: { ...prev.scoringWeights, laborEfficiency: v } }))} description="Cost optimization (10%)" />
          <WeightInput label="Fatigue" value={draft.scoringWeights.fatigue}
            onChange={v => setSettingsDraft(prev => ({ ...prev, scoringWeights: { ...prev.scoringWeights, fatigue: v } }))} description="Rest & recovery (10%)" />
        </div>
        <WeightSumIndicator sum={weightSum(draft.scoringWeights)} />
      </div>

      {/* Demand Forecast */}
      <div className="stat-card space-y-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Demand Forecasting</h2>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Enabled</Label>
            <Switch checked={draft.useDemandForecast} onCheckedChange={v => setSettingsDraft(prev => ({ ...prev, useDemandForecast: v }))} />
          </div>
        </div>
        {draft.useDemandForecast && (
          <>
            <p className="text-xs text-muted-foreground -mt-3">Adjust staffing levels based on predicted demand. Weights must sum to 1.0.</p>
            <div className="grid grid-cols-2 gap-4">
              <WeightInput label="Historical Sales" value={draft.forecastWeights.historicalSales}
                onChange={v => setSettingsDraft(prev => ({ ...prev, forecastWeights: { ...prev.forecastWeights, historicalSales: v } }))} description="Past revenue patterns" />
              <WeightInput label="Events" value={draft.forecastWeights.events}
                onChange={v => setSettingsDraft(prev => ({ ...prev, forecastWeights: { ...prev.forecastWeights, events: v } }))} description="Local event impact" />
              <WeightInput label="Weather" value={draft.forecastWeights.weather}
                onChange={v => setSettingsDraft(prev => ({ ...prev, forecastWeights: { ...prev.forecastWeights, weather: v } }))} description="Weather conditions" />
              <WeightInput label="Seasonal" value={draft.forecastWeights.seasonal}
                onChange={v => setSettingsDraft(prev => ({ ...prev, forecastWeights: { ...prev.forecastWeights, seasonal: v } }))} description="Day-of-week patterns" />
            </div>
            <WeightSumIndicator
              sum={draft.forecastWeights.historicalSales + draft.forecastWeights.events + draft.forecastWeights.weather + draft.forecastWeights.seasonal}
            />
          </>
        )}
      </div>

      {/* Optimization Goals */}
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Optimization Goals</h2>
        </div>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Assign best-scoring employees to shifts</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> Maintain skill and performance balance</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-warning" /> Prevent unnecessary overtime</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-success" /> Evenly distribute shifts (fairness)</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Stay within labor budget</li>
          <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Minimize fatigue and close-open patterns</li>
        </ul>
      </div>

      <UnsavedChangesBar isDirty={isDirty} onSave={saveSettings} onDiscard={discardSettings} />
    </div>
  );
}

function WeightInput({ label, value, onChange, description }: {
  label: string; value: number; onChange: (v: number) => void; description: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number" min={0} max={1} step={0.05}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1"
      />
      <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function WeightSumIndicator({ sum }: { sum: number }) {
  const isValid = Math.abs(sum - 1) < 0.01;
  return (
    <div className={`text-xs font-medium px-3 py-1.5 rounded-md ${
      isValid ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
    }`}>
      Sum: {sum.toFixed(2)} {isValid ? '✓' : '(should be 1.00)'}
    </div>
  );
}
