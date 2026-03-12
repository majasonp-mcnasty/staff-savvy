import { useAppState } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, BarChart3, Target, Brain } from 'lucide-react';

export default function SettingsPage() {
  const {
    budget, setBudget,
    scoringWeights, setScoringWeights,
    forecastWeights, setForecastWeights,
    useDemandForecast, setUseDemandForecast,
  } = useAppState();

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
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
              value={budget.weeklyBudgetCap ?? ''}
              onChange={e => setBudget(prev => ({ ...prev, weeklyBudgetCap: e.target.value ? +e.target.value : null }))}
              placeholder="No cap"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave empty for no cap</p>
          </div>
          <div>
            <Label>Overtime Threshold (hrs/wk)</Label>
            <Input
              type="number" min={1}
              value={budget.overtimeThreshold}
              onChange={e => setBudget(prev => ({ ...prev, overtimeThreshold: +e.target.value }))}
            />
          </div>
          <div>
            <Label>Overtime Multiplier</Label>
            <Input
              type="number" min={1} step={0.1}
              value={budget.overtimeMultiplier}
              onChange={e => setBudget(prev => ({ ...prev, overtimeMultiplier: +e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">e.g., 1.5 = time and a half</p>
          </div>
          <div>
            <Label>Min Rest Between Shifts (hrs)</Label>
            <Input
              type="number" min={0} max={24}
              value={budget.minRestHours}
              onChange={e => setBudget(prev => ({ ...prev, minRestHours: +e.target.value }))}
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
        <div className="grid grid-cols-2 gap-4">
          <WeightInput
            label="Availability"
            value={scoringWeights.availability}
            onChange={v => setScoringWeights(prev => ({ ...prev, availability: v }))}
            description="Schedule overlap match"
          />
          <WeightInput
            label="Experience"
            value={scoringWeights.experience}
            onChange={v => setScoringWeights(prev => ({ ...prev, experience: v }))}
            description="Seniority + rating"
          />
          <WeightInput
            label="Preference"
            value={scoringWeights.preference}
            onChange={v => setScoringWeights(prev => ({ ...prev, preference: v }))}
            description="Shift time preference"
          />
          <WeightInput
            label="Fairness"
            value={scoringWeights.fairness}
            onChange={v => setScoringWeights(prev => ({ ...prev, fairness: v }))}
            description="Workload balance"
          />
        </div>
        <WeightSumIndicator
          sum={scoringWeights.availability + scoringWeights.experience + scoringWeights.preference + scoringWeights.fairness}
        />
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
            <Switch checked={useDemandForecast} onCheckedChange={setUseDemandForecast} />
          </div>
        </div>
        {useDemandForecast && (
          <>
            <p className="text-xs text-muted-foreground -mt-3">Adjust staffing levels based on predicted demand. Weights must sum to 1.0.</p>
            <div className="grid grid-cols-2 gap-4">
              <WeightInput
                label="Historical Sales"
                value={forecastWeights.historicalSales}
                onChange={v => setForecastWeights(prev => ({ ...prev, historicalSales: v }))}
                description="Past revenue patterns"
              />
              <WeightInput
                label="Events"
                value={forecastWeights.events}
                onChange={v => setForecastWeights(prev => ({ ...prev, events: v }))}
                description="Local event impact"
              />
              <WeightInput
                label="Weather"
                value={forecastWeights.weather}
                onChange={v => setForecastWeights(prev => ({ ...prev, weather: v }))}
                description="Weather conditions"
              />
              <WeightInput
                label="Seasonal"
                value={forecastWeights.seasonal}
                onChange={v => setForecastWeights(prev => ({ ...prev, seasonal: v }))}
                description="Day-of-week patterns"
              />
            </div>
            <WeightSumIndicator
              sum={forecastWeights.historicalSales + forecastWeights.events + forecastWeights.weather + forecastWeights.seasonal}
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
        </ul>
      </div>
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
