import { LogOut, Search, Settings, User } from 'lucide-react';

import { useAuth } from '@/app/AuthProvider';
import { NotificationBell } from './NotificationBell';

export function TopBar({ children, addAction }: { children?: React.ReactNode; addAction?: () => void }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-base/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2 pr-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-cyan to-brand-blue text-black font-bold">
          L
        </div>
        <span className="text-sm font-semibold tracking-wide text-text-primary">Lynk</span>
      </div>
      <div className="flex-1">{children}</div>
      <label className="relative hidden md:block w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          placeholder="Pesquisar cliente (nome, placa)…"
          className="input pl-9"
          aria-label="Busca global"
        />
      </label>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-brand-cyan"
        aria-label="Adicionar"
        onClick={addAction}
        disabled={!addAction}
        title={addAction ? 'Nova venda direta' : 'Adicionar'}
      >
        +
      </button>
      <NotificationBell />
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface"
        aria-label="Perfil"
        title={user?.name ?? ''}
      >
        <User className="h-4 w-4 text-brand-cyan" />
      </button>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface"
        aria-label="Configurações"
      >
        <Settings className="h-4 w-4 text-brand-cyan" />
      </button>
      <button
        type="button"
        onClick={() => void logout()}
        className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface"
        aria-label="Sair"
      >
        <LogOut className="h-4 w-4 text-brand-cyan" />
      </button>
    </header>
  );
}
