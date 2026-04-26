import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppState } from '@/context/AppContext';
import { NAV_ITEMS } from '@/lib/nav-items';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function AppSidebar() {
  const location = useLocation();
  const { dirtyModules, saveStatus, lastSavedAt } = useAppState();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`hidden md:flex flex-col min-h-screen sidebar-gradient border-r border-sidebar-border transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className={`border-b border-sidebar-border flex items-center ${collapsed ? 'p-3 justify-center' : 'p-6'}`}>
        {collapsed ? (
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-sidebar-primary-foreground">ShiftOptima</h1>
              <p className="text-xs text-sidebar-foreground/60">AI Scheduling</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className={`flex-1 space-y-1 ${collapsed ? 'p-2' : 'p-4'}`}>
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.to;
          const isDirty = item.dirtyKey ? dirtyModules[item.dirtyKey] : false;

          if (collapsed) {
            return (
              <Tooltip key={item.to} delayDuration={100}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    className={`flex items-center justify-center w-full p-2.5 rounded-lg transition-all relative ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {isDirty && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-warning" />}
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">{item.label}{isDirty ? ' · Unsaved' : ''}</TooltipContent>
              </Tooltip>
            );
          }

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
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isDirty && <span className="w-2 h-2 rounded-full bg-warning shrink-0" title="Unsaved changes" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Status + collapse toggle */}
      <div className={`border-t border-sidebar-border space-y-2 ${collapsed ? 'p-2' : 'p-4'}`}>
        {!collapsed && (
          <div className="px-3 py-2 rounded-lg bg-sidebar-accent/50">
            <p className="text-xs text-sidebar-foreground/60">Status</p>
            <p className="text-xs font-medium text-sidebar-accent-foreground">
              {saveStatus === 'saved' && (lastSavedAt ? `Saved at ${lastSavedAt}` : 'All saved')}
              {saveStatus === 'unsaved' && '● Unsaved changes'}
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'error' && '⚠ Save failed'}
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
