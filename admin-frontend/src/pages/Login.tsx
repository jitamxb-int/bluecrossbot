import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, LogIn, AlertTriangle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { login } from '../features/thunks/authThunks';
import { selectLoginError, selectLoginStatus } from '../features/selectors/authSelectors';
import { isAuthenticated } from '../features/storage/authStorage';
import { ROUTES } from '../routes/routePaths';

const Login = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loginStatus = useAppSelector(selectLoginStatus);
  const loginError = useAppSelector(selectLoginError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Already logged in → skip the login page (keeps it out of history).
  if (isAuthenticated()) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const submitting = loginStatus === 'loading';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || submitting) return;
    try {
      await dispatch(login({ email: email.trim(), password })).unwrap();
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch {
      /* error is surfaced via loginError */
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Admin Portal</CardTitle>
          <CardDescription>Sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gmail.com"
                disabled={submitting}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={submitting}
                required
              />
            </div>

            {loginError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {loginError}
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={!email.trim() || !password || submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {submitting ? 'Signing in…' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
