import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Hourglass, Loader2, Save, Info } from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchSessionConfig, updateSessionConfig } from '../features/thunks/sessionConfigThunks';
import {
  selectSessionConfig,
  selectConfigFetchStatus,
  selectConfigFetchError,
  selectConfigUpdating,
  selectConfigUpdateError,
} from '../features/selectors/sessionConfigSelectors';

const MIN_MINUTES = 1;
const MAX_MINUTES = 1440;
const PRESETS = [15, 20, 30, 60];

function formatUpdatedAt(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const SessionConfigPage = () => {
  const dispatch = useAppDispatch();
  const config = useAppSelector(selectSessionConfig);
  const fetchStatus = useAppSelector(selectConfigFetchStatus);
  const fetchError = useAppSelector(selectConfigFetchError);
  const updating = useAppSelector(selectConfigUpdating);
  const updateError = useAppSelector(selectConfigUpdateError);

  const [value, setValue] = useState('');

  useEffect(() => {
    dispatch(fetchSessionConfig());
  }, [dispatch]);

  // Seed the input once the current value loads (and after a successful save).
  useEffect(() => {
    if (config) setValue(String(config.max_session_duration_minutes));
  }, [config?.max_session_duration_minutes]);

  const parsed = Number(value);
  const isValid =
    value.trim() !== '' &&
    Number.isInteger(parsed) &&
    parsed >= MIN_MINUTES &&
    parsed <= MAX_MINUTES;
  const isUnchanged = config != null && parsed === config.max_session_duration_minutes;

  const validationMessage = useMemo(() => {
    if (value.trim() === '') return null;
    if (!Number.isInteger(parsed)) return 'Enter a whole number of minutes.';
    if (parsed < MIN_MINUTES) return `Minimum is ${MIN_MINUTES} minute.`;
    if (parsed > MAX_MINUTES) return `Maximum is ${MAX_MINUTES} minutes (24 hours).`;
    return null;
  }, [value, parsed]);

  const handleSave = async () => {
    if (!isValid || isUnchanged) return;
    try {
      await dispatch(
        updateSessionConfig({ max_session_duration_minutes: parsed }),
      ).unwrap();
      toast.success(`Maximum session duration set to ${formatDuration(parsed)}.`);
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to update session configuration.');
    }
  };

  const isLoading = fetchStatus === 'loading' && !config;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Session Configuration</h1>
          <p className="text-muted-foreground">
            Control how long a chat session stays active before it automatically expires.
          </p>
        </div>

        {fetchError && !config && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {fetchError}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading configuration…</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Main config card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Hourglass className="w-5 h-5 text-primary" />
                  Maximum Session Duration
                </CardTitle>
                <CardDescription>
                  Measured from the moment a session is created. Once this limit is reached the
                  session is closed automatically — even during an active conversation — and the
                  user is asked to start a new one.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="max-duration">Duration (minutes)</Label>
                  <Input
                    id="max-duration"
                    type="number"
                    min={MIN_MINUTES}
                    max={MAX_MINUTES}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="e.g. 30"
                    disabled={updating}
                    aria-invalid={validationMessage != null}
                  />
                  {validationMessage ? (
                    <p className="text-xs text-destructive">{validationMessage}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Allowed range: {MIN_MINUTES}–{MAX_MINUTES} minutes (up to 24 hours).
                    </p>
                  )}
                </div>

                {/* Quick presets */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Quick set</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset) => {
                      const active = parsed === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={updating}
                          onClick={() => setValue(String(preset))}
                          className={`px-3 py-1.5 rounded-md border text-sm transition-colors disabled:opacity-50 ${
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {formatDuration(preset)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {updateError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {updateError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button onClick={handleSave} disabled={!isValid || isUnchanged || updating} className="gap-2">
                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {updating ? 'Saving…' : 'Save changes'}
                  </Button>
                  {isUnchanged && !updating && (
                    <span className="text-xs text-muted-foreground">No changes to save.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Current value summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Current Setting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-5 rounded-lg bg-blue-50 border border-blue-100 text-center">
                  <p className="text-3xl font-bold text-blue-900">
                    {config ? formatDuration(config.max_session_duration_minutes) : '—'}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {config ? `${config.max_session_duration_minutes} minutes` : 'Not loaded'}
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Last updated</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatUpdatedAt(config?.updated_at)}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>This applies globally to all newly created chat sessions.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SessionConfigPage;
