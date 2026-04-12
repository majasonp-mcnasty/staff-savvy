import { Save, Undo2, Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface UnsavedChangesBarProps {
  isDirty: boolean;
  onSave: () => boolean | void | Promise<boolean | void>;
  onDiscard: () => void;
  saveLabel?: string;
}

export default function UnsavedChangesBar({ isDirty, onSave, onDiscard, saveLabel = 'Save Changes' }: UnsavedChangesBarProps) {
  const [saving, setSaving] = useState(false);

  if (!isDirty) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await onSave();
      if (result === false) {
        toast.error('Save failed — check your inputs and try again.', {
          icon: <AlertCircle className="w-4 h-4" />,
        });
      } else {
        toast.success('Changes saved successfully.');
      }
    } catch (err) {
      toast.error(`Save failed — ${err instanceof Error ? err.message : 'unexpected error'}`, {
        icon: <AlertCircle className="w-4 h-4" />,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border shadow-lg animate-fade-in">
      <span className="text-sm text-muted-foreground font-medium">Unsaved changes</span>
      <button
        onClick={onDiscard}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
      >
        <Undo2 className="w-3.5 h-3.5" /> Discard
      </button>
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {saveLabel}
      </button>
    </div>
  );
}
