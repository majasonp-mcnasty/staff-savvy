import { NavLink, useLocation } from 'react-router-dom';
import { Users, LayoutGrid, Calendar, BarChart3, Settings, Zap } from 'lucide-react';

const navItems = [
  { to: '/', icon: BarChart3, label: 'Dashboard' },
  { to: '/employees', icon: Users, label: 'Employees' },
  { to: '/stations', icon: LayoutGrid, label: 'Stations' },
  { to: '/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen sidebar-gradient border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-primary-foreground">ShiftOptima</h1>
            <p className="text-xs text-sidebar-foreground/60">AI Scheduling</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="px-3 py-2 rounded-lg bg-sidebar-accent/50">
          <p className="text-xs text-sidebar-foreground/60">Powered by</p>
          <p className="text-xs font-medium text-sidebar-accent-foreground">Rule-Based AI Engine</p>
        </div>
      </div>
    </aside>
  );
}
