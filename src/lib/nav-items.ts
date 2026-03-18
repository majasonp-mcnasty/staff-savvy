import { Users, LayoutGrid, Calendar, BarChart3, Settings, TrendingUp, FileBarChart } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', icon: BarChart3, label: 'Dashboard', dirtyKey: null },
  { to: '/employees', icon: Users, label: 'Employees', dirtyKey: 'employees' as const },
  { to: '/stations', icon: LayoutGrid, label: 'Stations', dirtyKey: 'stations' as const },
  { to: '/schedule', icon: Calendar, label: 'Schedule', dirtyKey: null },
  { to: '/forecast-data', icon: TrendingUp, label: 'Forecast Data', dirtyKey: 'forecast' as const },
  { to: '/reports', icon: FileBarChart, label: 'Reports', dirtyKey: null },
  { to: '/settings', icon: Settings, label: 'Settings', dirtyKey: 'settings' as const },
] as const;
