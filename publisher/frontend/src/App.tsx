import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from './services/auth.tsx';
import { APP, url } from './services/app.ts';
import { PublisherPage } from './pages/admin/PublisherPage.tsx';
import { Button } from './components/atoms/Button.tsx';
import { Card } from './components/atoms/Card.tsx';
import { Input, Label } from './components/atoms/Input.tsx';

/** Follows the device's light / dark setting. */
function useSystemTheme() {
  useEffect(() => {
    const q = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', q.matches);
    apply();
    q.addEventListener('change', apply);
    return () => q.removeEventListener('change', apply);
  }, []);
}

function useProjectName(): string {
  const [name, setName] = useState('');
  useEffect(() => {
    fetch(url('/api/config'))
      .then((r) => r.json())
      .then((d: { name?: string }) => {
        setName(d.name ?? '');
        if (d.name) document.title = `Publicador · ${d.name}`;
      })
      .catch(() => {});
  }, []);
  return name;
}

function Login({ name }: { name: string }) {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await login(password));
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-light px-4 dark:bg-navy">
      <Card className="w-full max-w-sm p-6">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">Publicador</p>
        <h1 className="mb-4 font-display text-2xl font-black text-ink dark:text-white">{name || 'Ingresar'}</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="pw">Contraseña</Label>
            <Input id="pw" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" loading={busy} disabled={!password}>
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function App() {
  useSystemTheme();
  const { token, logout } = useAuth();
  const name = useProjectName();
  if (!APP.embedded && !token) return <Login name={name} />;
  return (
    <div className="min-h-screen bg-gray-light dark:bg-navy">
      <header className="flex items-center justify-between gap-3 border-b border-gray-medium/60 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5 sm:px-8">
        <p className="font-display text-lg font-extrabold text-ink dark:text-white">{name || 'Publicador'}</p>
        {APP.embedded ? (
          <a href={APP.returnUrl} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-dark hover:bg-gray-medium/60 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white">
            <ArrowLeft size={14} /> Volver al panel
          </a>
        ) : (
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut size={14} /> Salir
          </Button>
        )}
      </header>
      <PublisherPage />
    </div>
  );
}
