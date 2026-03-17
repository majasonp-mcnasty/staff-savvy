import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export function useUnsavedWarning(isDirty: boolean) {
  // Browser tab close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // React Router navigation
  useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname &&
      !window.confirm('You have unsaved changes. Discard and leave?')
  );
}
