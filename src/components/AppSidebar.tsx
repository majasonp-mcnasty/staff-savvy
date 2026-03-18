import { NavLink, useLocation } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAppState } from '@/context/AppContext';
import { NAV_ITEMS } from '@/lib/nav-items';

export default function AppSidebar() {
  const location = useLocation();
  const { dirtyModules, saveStatus, lastSavedAt } = useAppState();

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
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.to;
          const isDirty = item.dirtyKey ? dirtyModules[item.dirtyKey] : false;
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
              <span className="flex-1">{item.label}</span>
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-warning shrink-0" title="Unsaved changes" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="px-3 py-2 rounded-lg bg-sidebar-accent/50">
          <p className="text-xs text-sidebar-foreground/60">Status</p>
          <p className="text-xs font-medium text-sidebar-accent-foreground">
            {saveStatus === 'saved' && (lastSavedAt ? `Saved at ${lastSavedAt}` : 'All saved')}
            {saveStatus === 'unsaved' && '● Unsaved changes'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'error' && 'Save failed'}
          </p>
        </div>
      </div>
    </aside>
  );
}
