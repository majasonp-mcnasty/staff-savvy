import { useState, useCallback, useEffect, useRef } from 'react';

export function useDraftState<T>(savedState: T) {
  const [draft, setDraft] = useState<T>(savedState);
  const savedRef = useRef(savedState);

  // Sync when saved state changes externally
  useEffect(() => {
    savedRef.current = savedState;
  }, [savedState]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedState);

  const discard = useCallback(() => {
    setDraft(savedRef.current);
  }, []);

  return { draft, setDraft, isDirty, discard, savedState };
}
