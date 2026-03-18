import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Users, LayoutGrid, Calendar, BarChart3, Settings, Zap, Menu, X, TrendingUp, FileBarChart } from 'lucide-react';
import { useAppState } from '@/context/AppContext';

const navItems = [
  { to: '/', icon: BarChart3, label: 'Dashboard', dirtyKey: null },
  { to: '/employees', icon: Users, label: 'Employees', dirtyKey: 'employees' as const },
  { to: '/stations', icon: LayoutGrid, label: 'Stations', dirtyKey: 'stations' as const },
  { to: '/schedule', icon: Calendar, label: 'Schedule', dirtyKey: null },
  { to: '/forecast-data', icon: TrendingUp, label: 'Forecast Data', dirtyKey: 'forecast' as const },
  { to: '/reports', icon: FileBarChart, label: 'Reports', dirtyKey: null },
  { to: '/settings', icon: Settings, label: 'Settings', dirtyKey: 'settings' as const },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { dirtyModules, saveStatus } = useAppState();

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">ShiftOptima</span>
          {saveStatus === 'unsaved' && (
            <span className="w-2 h-2 rounded-full bg-warning" title="Unsaved changes" />
          )}
        </div>
        <button onClick={() => setOpen(!open)} className="p-2 rounded-lg hover:bg-muted">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-b border-border bg-card p-2 animate-fade-in">
          {navItems.map(item => {
            const isActive = location.pathname === item.to;
            const isDirty = item.dirtyKey ? dirtyModules[item.dirtyKey] : false;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="flex-1">{item.label}</span>
                {isDirty && (
                  <span className="w-2 h-2 rounded-full bg-warning shrink-0" title="Unsaved changes" />
                )}
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
