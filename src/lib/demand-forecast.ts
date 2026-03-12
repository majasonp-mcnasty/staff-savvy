import {
  DayOfWeek, DAYS_OF_WEEK, DemandLevel, DemandForecastEntry,
  ForecastWeights, ForecastInputs, CoverageRequirement,
} from './types';

export const DEFAULT_FORECAST_WEIGHTS: ForecastWeights = {
  historicalSales: 0.50,
  events: 0.25,
  weather: 0.15,
  seasonal: 0.10,
};

const STAFFING_MULTIPLIERS: Record<DemandLevel, number> = {
  low: 1.0,
  normal: 1.0,
  high: 1.2,
  peak: 1.4,
};

function classifyDemand(score: number): DemandLevel {
  if (score < 30) return 'low';
  if (score < 60) return 'normal';
  if (score < 80) return 'high';
  return 'peak';
}

/**
 * Calculate a historical sales score (0-100) for a given day.
 */
function historicalSalesScore(inputs: ForecastInputs, day: DayOfWeek): number {
  const daySales = inputs.historicalSales.filter(s => s.day === day);
  if (daySales.length === 0) return 50; // default to normal
  const avgRevenue = daySales.reduce((sum, s) => sum + s.revenue, 0) / daySales.length;
  const allAvg = inputs.historicalSales.length > 0
    ? inputs.historicalSales.reduce((sum, s) => sum + s.revenue, 0) / inputs.historicalSales.length
    : avgRevenue;
  if (allAvg === 0) return 50;
  return Math.min(100, (avgRevenue / allAvg) * 50);
}

/**
 * Calculate an event impact score (0-100) for a given day.
 */
function eventScore(inputs: ForecastInputs, day: DayOfWeek): number {
  const dayEvents = inputs.events.filter(e => e.day === day);
  if (dayEvents.length === 0) return 0;
  const totalAttendance = dayEvents.reduce((sum, e) => sum + e.expectedAttendance, 0);
  // Normalize: 5000+ attendance → 100
  return Math.min(100, (totalAttendance / 5000) * 100);
}

/**
 * Calculate a weather score (0-100) for a given day.
 * Good weather = higher foot traffic; rain = lower.
 */
function weatherScore(inputs: ForecastInputs, day: DayOfWeek): number {
  const dayWeather = inputs.weather.find(w => w.day === day);
  if (!dayWeather) return 50;
  // Higher temp (up to 30°C) and low rain → more traffic
  const tempFactor = Math.min(1, dayWeather.temperature / 30);
  const rainFactor = 1 - (dayWeather.rainProbability / 100);
  return Math.round((tempFactor * 0.5 + rainFactor * 0.5) * 100);
}

/**
 * Simple seasonal score based on day of week patterns.
 * Weekends typically have higher demand.
 */
function seasonalScore(day: DayOfWeek): number {
  const scores: Record<DayOfWeek, number> = {
    monday: 40, tuesday: 35, wednesday: 45, thursday: 50,
    friday: 70, saturday: 85, sunday: 65,
  };
  return scores[day];
}

/**
 * Generate demand forecast for each day, using coverage requirements as shift templates.
 */
export function generateDemandForecast(
  requirements: CoverageRequirement[],
  inputs: ForecastInputs,
  weights: ForecastWeights = DEFAULT_FORECAST_WEIGHTS,
): DemandForecastEntry[] {
  const entries: DemandForecastEntry[] = [];
  const seenKeys = new Set<string>();

  for (const req of requirements) {
    const key = `${req.day}-${req.timeWindow.start}-${req.timeWindow.end}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const histScore = historicalSalesScore(inputs, req.day);
    const evtScore = eventScore(inputs, req.day);
    const wthrScore = weatherScore(inputs, req.day);
    const seasScore = seasonalScore(req.day);

    const demandScore = Math.round(
      histScore * weights.historicalSales +
      evtScore * weights.events +
      wthrScore * weights.weather +
      seasScore * weights.seasonal
    );

    const level = classifyDemand(demandScore);
    const multiplier = STAFFING_MULTIPLIERS[level];

    // Sum required staff across all requirements for this day+time slot
    const baseStaff = requirements
      .filter(r => r.day === req.day && r.timeWindow.start === req.timeWindow.start && r.timeWindow.end === req.timeWindow.end)
      .reduce((sum, r) => sum + r.requiredCount, 0);

    entries.push({
      day: req.day,
      shift: `${req.timeWindow.start}-${req.timeWindow.end}`,
      predictedDemand: level,
      demandScore,
      recommendedStaff: Math.ceil(baseStaff * multiplier),
      staffingMultiplier: multiplier,
    });
  }

  return entries;
}

/**
 * Default empty forecast inputs (used when no external data is available).
 */
export function getDefaultForecastInputs(): ForecastInputs {
  return {
    historicalSales: DAYS_OF_WEEK.flatMap(day => [
      { day, hour: 9, revenue: day === 'saturday' || day === 'sunday' ? 450 : 320 },
      { day, hour: 12, revenue: day === 'friday' ? 520 : 380 },
      { day, hour: 17, revenue: day === 'saturday' ? 600 : 350 },
    ]),
    events: [],
    weather: DAYS_OF_WEEK.map(day => ({
      day,
      temperature: 22,
      rainProbability: 20,
    })),
  };
}
