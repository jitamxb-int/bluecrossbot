import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { changePassword } from '../features/thunks/authThunks';
import { selectAuthUser, selectChanging } from '../features/selectors/authSelectors';
import { getAdminEmail } from '../features/storage/authStorage';

const ChangePassword = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const changing = useAppSelector(selectChanging);
  const email = user?.email ?? getAdminEmail() ?? '';

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = !!current && !!next && !!confirm && !mismatch && !changing && !!email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (!canSubmit) return;
    try {
      await dispatch(
        changePassword({
          email,
          current_password: current,
          new_password: next,
          confirm_new_password: confirm,
        }),
      ).unwrap();
      toast.success('Password updated successfully.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      const message = typeof err === 'string' ? err : 'Failed to change password.';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Change Credentials</h1>
          <p className="text-muted-foreground">Update your administrator password.</p>
        </div>

        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Password
            </CardTitle>
            <CardDescription>
              {email ? <>Signed in as <span className="font-medium text-foreground">{email}</span>.</> : 'Enter your current and new password.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current">Current password</Label>
                <Input id="current" type="password" autoComplete="current-password"
                  value={current} onChange={(e) => setCurrent(e.target.value)} disabled={changing} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new">New password</Label>
                <Input id="new" type="password" autoComplete="new-password"
                  value={next} onChange={(e) => setNext(e.target.value)} disabled={changing} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" type="password" autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={changing} required
                  aria-invalid={mismatch} />
                {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" className="gap-2" disabled={!canSubmit}>
                {changing ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {changing ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ChangePassword;
