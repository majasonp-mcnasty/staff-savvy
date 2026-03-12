import { useState } from 'react';
import { useAppState } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DayOfWeek, DAYS_OF_WEEK, DAY_FULL_LABELS, HistoricalSalesData, EventData, WeatherData } from '@/lib/types';
import { TrendingUp, Cloud, CalendarHeart, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ForecastDataPage() {
  const { forecastInputs, setForecastInputs } = useAppState();

  // --- Historical Sales ---
  const [salesDay, setSalesDay] = useState<DayOfWeek>('monday');
  const [salesHour, setSalesHour] = useState(12);
  const [salesRevenue, setSalesRevenue] = useState(300);

  const addSalesEntry = () => {
    const entry: HistoricalSalesData = { day: salesDay, hour: salesHour, revenue: salesRevenue };
    setForecastInputs(prev => ({ ...prev, historicalSales: [...prev.historicalSales, entry] }));
    toast.success('Sales entry added');
  };

  const removeSalesEntry = (idx: number) => {
    setForecastInputs(prev => ({
      ...prev,
      historicalSales: prev.historicalSales.filter((_, i) => i !== idx),
    }));
  };

  // --- Events ---
  const [eventDay, setEventDay] = useState<DayOfWeek>('saturday');
  const [eventType, setEventType] = useState('concert');
  const [eventAttendance, setEventAttendance] = useState(5000);

  const addEventEntry = () => {
    const entry: EventData = { day: eventDay, eventType, expectedAttendance: eventAttendance };
    setForecastInputs(prev => ({ ...prev, events: [...prev.events, entry] }));
    toast.success('Event added');
  };

  const removeEventEntry = (idx: number) => {
    setForecastInputs(prev => ({
      ...prev,
      events: prev.events.filter((_, i) => i !== idx),
    }));
  };

  // --- Weather ---
  const updateWeather = (day: DayOfWeek, field: 'temperature' | 'rainProbability', value: number) => {
    setForecastInputs(prev => ({
      ...prev,
      weather: prev.weather.map(w => w.day === day ? { ...w, [field]: value } : w),
    }));
  };

  const resetToDefaults = () => {
    const { getDefaultForecastInputs } = require('@/lib/demand-forecast');
    setForecastInputs(getDefaultForecastInputs());
    toast.success('Forecast data reset to defaults');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Forecast Data</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Input historical sales, events, and weather to drive demand predictions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetToDefaults}>
          Reset Defaults
        </Button>
      </div>

      {/* Historical Sales */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Historical Sales</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {forecastInputs.historicalSales.length} entries
          </span>
        </div>

        {/* Add form */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs">Day</Label>
            <Select value={salesDay} onValueChange={v => setSalesDay(v as DayOfWeek)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map(d => (
                  <SelectItem key={d} value={d}>{DAY_FULL_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Hour (0-23)</Label>
            <Input type="number" min={0} max={23} value={salesHour}
              onChange={e => setSalesHour(+e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Revenue ($)</Label>
            <Input type="number" min={0} value={salesRevenue}
              onChange={e => setSalesRevenue(+e.target.value)} className="mt-1" />
          </div>
          <Button size="sm" onClick={addSalesEntry} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>

        {/* Table */}
        {forecastInputs.historicalSales.length > 0 && (
          <div className="max-h-48 overflow-y-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Day</th>
                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Hour</th>
                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Revenue</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {forecastInputs.historicalSales.map((s, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5 text-foreground">{DAY_FULL_LABELS[s.day]}</td>
                    <td className="px-3 py-1.5 text-foreground">{s.hour}:00</td>
                    <td className="px-3 py-1.5 text-foreground">${s.revenue}</td>
                    <td className="px-1">
                      <button onClick={() => removeSalesEntry(i)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Events */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2">
          <CalendarHeart className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Local Events</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {forecastInputs.events.length} events
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs">Day</Label>
            <Select value={eventDay} onValueChange={v => setEventDay(v as DayOfWeek)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map(d => (
                  <SelectItem key={d} value={d}>{DAY_FULL_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['concert', 'sports', 'festival', 'holiday', 'conference', 'other'].map(t => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Expected Attendance</Label>
            <Input type="number" min={0} value={eventAttendance}
              onChange={e => setEventAttendance(+e.target.value)} className="mt-1" />
          </div>
          <Button size="sm" onClick={addEventEntry} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>

        {forecastInputs.events.length > 0 && (
          <div className="max-h-48 overflow-y-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Day</th>
                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Type</th>
                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Attendance</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {forecastInputs.events.map((e, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5 text-foreground">{DAY_FULL_LABELS[e.day]}</td>
                    <td className="px-3 py-1.5 text-foreground capitalize">{e.eventType}</td>
                    <td className="px-3 py-1.5 text-foreground">{e.expectedAttendance.toLocaleString()}</td>
                    <td className="px-1">
                      <button onClick={() => removeEventEntry(i)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Weather */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Weather Forecast</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Set expected temperature and rain probability per day.</p>

        <div className="grid grid-cols-1 gap-2">
          {DAYS_OF_WEEK.map(day => {
            const w = forecastInputs.weather.find(x => x.day === day) || { temperature: 22, rainProbability: 20 };
            return (
              <div key={day} className="grid grid-cols-3 gap-3 items-center py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                <span className="text-xs font-medium text-foreground">{DAY_FULL_LABELS[day]}</span>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-12 shrink-0">Temp °C</Label>
                  <Input type="number" min={-20} max={50} value={w.temperature}
                    onChange={e => updateWeather(day, 'temperature', +e.target.value)}
                    className="h-8 text-xs" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-12 shrink-0">Rain %</Label>
                  <Input type="number" min={0} max={100} value={w.rainProbability}
                    onChange={e => updateWeather(day, 'rainProbability', +e.target.value)}
                    className="h-8 text-xs" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
