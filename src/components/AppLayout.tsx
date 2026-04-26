import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { toast } from 'sonner';
import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';
import { useAppState } from '@/context/AppContext';

export default function AppLayout() {
  const { anyDirty, saveEmployees, saveStations, saveSettings, saveForecast, dirtyModules, generateNewSchedule, discardEmployees, discardStations } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd+S — save dirty modules
      if (e.key === 's') {
        e.preventDefault();
        if (!anyDirty) { toast.info('Nothing to save'); return; }
        const saves: Promise<boolean>[] = [];
        if (dirtyModules.employees) saves.push(saveEmployees());
        if (dirtyModules.stations) saves.push(saveStations());
        if (dirtyModules.settings) saves.push(saveSettings());
        if (dirtyModules.forecast) saves.push(saveForecast());
        Promise.all(saves).then(results => {
          if (results.every(Boolean)) toast.success('All changes saved');
        });
        return;
      }

      // Cmd+Z — discard (with confirmation handled by browser unload already)
      if (e.key === 'z' && !e.shiftKey) {
        if (!anyDirty) return;
        e.preventDefault();
        if (window.confirm('Discard all unsaved changes?')) {
          if (dirtyModules.employees) discardEmployees();
          if (dirtyModules.stations) discardStations();
          toast.info('Changes discarded');
        }
        return;
      }

      // Cmd+G — generate schedule
      if (e.key === 'g') {
        e.preventDefault();
        generateNewSchedule();
        toast.success('Schedule generated');
        return;
      }
    }

    // Escape closes popovers etc. via native browser behaviour — no extra handling needed here

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anyDirty, dirtyModules, saveEmployees, saveStations, saveSettings, saveForecast, discardEmployees, discardStations, generateNewSchedule]);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <MobileNav />
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
