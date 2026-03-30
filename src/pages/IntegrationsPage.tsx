import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Plug, Clock } from 'lucide-react';
import {
  syncToastPlatform,
  syncSevenRoomsPlatform,
  syncTripleseatPlatform,
  syncPushPlatform,
  syncAllIntegrations,
  fetchLatestSyncLogs,
  testToastConnection,
  testSevenRoomsConnection,
  testTripleseatConnection,
  testPushConnection,
} from '@/lib/integrations';
import type { SyncResult, SyncLogRow, IntegrationPlatform } from '@/lib/integrations';
import { supabase } from '@/lib/supabase';

// ── Platform metadata ──

interface PlatformConfig {
  id: IntegrationPlatform;
  label: string;
  description: string;
  dataType: string;
  envVars: string[];
  syncFn: () => Promise<SyncResult>;
  testFn: () => Promise<{ connected: boolean; error?: string }>;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'toast',
    label: 'Toast POS',
    description: 'Pulls hourly sales and labor data to feed demand forecasting.',
    dataType: 'Historical Sales',
    envVars: ['VITE_TOAST_CLIENT_ID', 'VITE_TOAST_CLIENT_SECRET', 'VITE_TOAST_RESTAURANT_GUID'],
    syncFn: syncToastPlatform,
    testFn: testToastConnection,
  },
  {
    id: 'sevenrooms',
    label: 'SevenRooms',
    description: 'Imports reservation counts and event bookings for staffing forecasts.',
    dataType: 'Reservations & Events',
    envVars: ['VITE_SEVENROOMS_API_KEY', 'VITE_SEVENROOMS_VENUE_ID'],
    syncFn: syncSevenRoomsPlatform,
    testFn: testSevenRoomsConnection,
  },
  {
    id: 'tripleseat',
    label: 'Tripleseat',
    description: 'Syncs private event bookings and headcounts for peak staffing.',
    dataType: 'Private Events',
    envVars: ['VITE_TRIPLESEAT_API_KEY', 'VITE_TRIPLESEAT_SECRET'],
    syncFn: syncTripleseatPlatform,
    testFn: testTripleseatConnection,
  },
  {
    id: 'push',
    label: 'Push Operations',
    description: 'Imports employee records, wages, and availability from your HR platform.',
    dataType: 'Employee Data',
    envVars: ['VITE_PUSH_API_KEY'],
    syncFn: syncPushPlatform,
    testFn: testPushConnection,
  },
];

// ── Helpers ──

function isConfigured(platform: PlatformConfig): boolean {
  return platform.envVars.every(key => {
    const val = import.meta.env[key] as string | undefined;
    return val && val.length > 0 && !val.includes('YOUR_');
  });
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Status badge ──

function StatusBadge({ status }: { status: SyncLogRow['status'] | 'not_configured' | 'configured' }) {
  if (status === 'not_configured') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        Not configured
      </span>
    );
  }
  if (status === 'configured') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
        <CheckCircle className="w-3 h-3" /> Configured
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
        <CheckCircle className="w-3 h-3" /> Synced
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
        <AlertTriangle className="w-3 h-3" /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
      <XCircle className="w-3 h-3" /> Error
    </span>
  );
}

// ── Platform card ──

interface PlatformCardProps {
  platform: PlatformConfig;
  syncLog: SyncLogRow | undefined;
  isSyncing: boolean;
  onSync: (id: IntegrationPlatform) => void;
  onTest: (id: IntegrationPlatform) => void;
}

function PlatformCard({ platform, syncLog, isSyncing, onSync, onTest }: PlatformCardProps) {
  const configured = isConfigured(platform);

  const badgeStatus: SyncLogRow['status'] | 'not_configured' | 'configured' =
    !configured ? 'not_configured' : syncLog?.status ?? 'configured';

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Plug className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{platform.label}</h3>
            <p className="text-xs text-muted-foreground">{platform.dataType}</p>
          </div>
        </div>
        <StatusBadge status={badgeStatus} />
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">{platform.description}</p>

      {/* Last sync info */}
      {syncLog && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Last synced {formatRelativeTime(syncLog.synced_at)}
            <span className="text-foreground font-medium ml-1">
              ({syncLog.records_synced} records)
            </span>
          </div>
          {syncLog.error_message && (
            <p className="text-xs text-destructive break-words">{syncLog.error_message}</p>
          )}
        </div>
      )}

      {/* Required env vars */}
      {!configured && (
        <div className="rounded-lg border border-dashed border-border px-3 py-2">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Required in .env:</p>
          <ul className="space-y-0.5">
            {platform.envVars.map(v => (
              <li key={v} className="text-xs font-mono text-muted-foreground">{v}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={() => onTest(platform.id)}
          disabled={!configured || isSyncing}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Test
        </button>
        <button
          onClick={() => onSync(platform.id)}
          disabled={!configured || isSyncing}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Sync Now
        </button>
      </div>
    </div>
  );
}

// ── Page ──

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [syncingPlatforms, setSyncingPlatforms] = useState<Set<IntegrationPlatform>>(new Set());
  const [syncingAll, setSyncingAll] = useState(false);

  const { data: syncLogs = [] } = useQuery({
    queryKey: ['integration_sync_logs'],
    queryFn: fetchLatestSyncLogs,
    refetchInterval: 30_000, // poll every 30s
  });

  // Real-time subscription: refresh logs when a new sync row lands
  useEffect(() => {
    const channel = supabase
      .channel('integrations-sync-log')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'integration_sync_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['integration_sync_logs'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const getSyncLog = useCallback(
    (id: IntegrationPlatform) => syncLogs.find(l => l.platform === id),
    [syncLogs],
  );

  // ── Single platform sync ──
  const syncMutation = useMutation({
    mutationFn: async (id: IntegrationPlatform) => {
      const platform = PLATFORMS.find(p => p.id === id)!;
      return platform.syncFn();
    },
    onMutate: (id) => setSyncingPlatforms(prev => new Set(prev).add(id)),
    onSettled: (_, __, id) => {
      setSyncingPlatforms(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['integration_sync_logs'] });
    },
    onSuccess: (result) => {
      if (result.status === 'success') {
        toast.success(`${result.platform} synced — ${result.recordsSynced} records`);
      } else if (result.status === 'partial') {
        toast.warning(`${result.platform} partially synced — ${result.errors.join(', ')}`);
      } else {
        toast.error(`${result.platform} sync failed — ${result.errors.join(', ')}`);
      }
    },
    onError: (err, id) => {
      toast.error(`${id} sync failed — ${err instanceof Error ? err.message : String(err)}`);
    },
  });

  // ── Connection test ──
  const testMutation = useMutation({
    mutationFn: async (id: IntegrationPlatform) => {
      const platform = PLATFORMS.find(p => p.id === id)!;
      return { id, result: await platform.testFn() };
    },
    onSuccess: ({ id, result }) => {
      if (result.connected) {
        toast.success(`${id} connection successful${result.latencyMs ? ` (${result.latencyMs}ms)` : ''}`);
      } else {
        toast.error(`${id} connection failed — ${result.error ?? 'unknown error'}`);
      }
    },
  });

  // ── Sync all ──
  async function handleSyncAll() {
    setSyncingAll(true);
    try {
      const results = await syncAllIntegrations();
      queryClient.invalidateQueries({ queryKey: ['integration_sync_logs'] });

      const succeeded = Object.values(results).filter(r => r.status === 'success').length;
      const failed = Object.values(results).filter(r => r.status === 'error').length;

      if (failed === 0) {
        toast.success(`All integrations synced (${succeeded}/4)`);
      } else {
        toast.warning(`${succeeded}/4 integrations synced, ${failed} failed`);
      }
    } catch (err) {
      toast.error(`Sync all failed — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncingAll(false);
    }
  }

  const anyConfigured = PLATFORMS.some(isConfigured);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect live data sources to replace sample data with real operational data.
          </p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={!anyConfigured || syncingAll}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {syncingAll ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Sync All
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        <strong className="text-foreground">Setup:</strong> Add your API credentials to the{' '}
        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.env</code> file using{' '}
        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.env.example</code> as a
        template, then restart the dev server. Credentials are never committed to version control.
      </div>

      {/* Platform grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map(platform => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            syncLog={getSyncLog(platform.id)}
            isSyncing={syncingPlatforms.has(platform.id) || syncingAll}
            onSync={(id) => syncMutation.mutate(id)}
            onTest={(id) => testMutation.mutate(id)}
          />
        ))}
      </div>

      {/* CORS note */}
      <p className="text-xs text-muted-foreground text-center">
        Note: Some integrations may require a server-side proxy (e.g. Supabase Edge Function)
        if the platform does not allow browser-side CORS requests.
      </p>
    </div>
  );
}
