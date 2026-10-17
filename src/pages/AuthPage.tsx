import { useState } from 'react';
import { ArrowLeft, Mail, Lock, User } from 'lucide-react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, displayName || undefined);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if (mode === 'signup') {
      toast('Account created! Welcome to ORVEXA.', 'success');
    }
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Visual side */}
      <div className="relative md:w-1/2 h-64 md:h-auto overflow-hidden">
        <img
          src="https://images.pexels.com/photos/9067815/pexels-photo-9067815.jpeg?auto=compress&cs=tinysrgb&h=900&w=600"
          alt="Creative showcase"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/70 to-[var(--bg-base)]/40" />
        <div className="relative z-10 flex h-full flex-col justify-end p-8 md:p-12">
          <Logo size={36} />
          <h1 className="mt-6 font-display text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            {mode === 'signin' ? 'Welcome back to ORVEXA' : 'Start creating with ORVEXA'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-sm">
            {mode === 'signin'
              ? 'Sign in to continue your creative journey.'
              : 'Create your account and get 50 free credits to start.'}
          </p>
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-6">
          <Link to="/" className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-20">
          <div className="w-full max-w-sm">
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {mode === 'signin' ? 'Enter your credentials to access your workspace.' : 'Fill in your details to get started.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {mode === 'signup' && (
                <div className="relative">
                  <User className="absolute left-3 top-[38px] h-4 w-4 text-[var(--text-tertiary)] z-10" />
                  <Input
                    label="Display Name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="pl-10"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-[38px] h-4 w-4 text-[var(--text-tertiary)] z-10" />
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-[38px] h-4 w-4 text-[var(--text-tertiary)] z-10" />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                />
              </div>

              {error && (
                <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)] animate-fade-in">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-[var(--text-secondary)]">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
                className="text-[var(--accent)] font-medium hover:underline"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
