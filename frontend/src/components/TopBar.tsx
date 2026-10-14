import { LogOut, Plus, Settings, User } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/app/AuthProvider';
import { NotificationBell } from './NotificationBell';

export function TopBar({ children, addAction }: { children?: React.ReactNode; addAction?: () => void }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-base/90 px-3 py-2 backdrop-blur sm:px-4">
      <div className="flex shrink-0 items-center gap-2">
        <img src="/logo-lynk.svg" alt="" className="h-8 w-8 object-contain" />
        <span className="hidden text-sm font-semibold tracking-wide text-text-primary sm:inline">
          Lynk
        </span>
      </div>
      <div className="scrollbar-none order-3 w-full min-w-0 overflow-x-auto lg:order-none lg:flex-1">
        {children}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {addAction && (
          <button
            type="button"
            className="icon-button text-brand-cyan"
            aria-label="Nova venda"
            onClick={addAction}
            title="Nova venda"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
        <NotificationBell />
        <Link
          to={profilePath(user?.role)}
          className="icon-button"
          aria-label="Perfil"
          title={user?.name ?? 'Perfil'}
        >
          <User className="h-4 w-4 text-brand-cyan" />
        </Link>
        {user?.role === 'admin' && (
          <Link
            to="/admin/configuracoes"
            className="icon-button"
            aria-label="Configurações"
            title="Configurações"
          >
            <Settings className="h-4 w-4 text-brand-cyan" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => void logout()}
          className="icon-button"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="h-4 w-4 text-brand-cyan" />
        </button>
      </div>
    </header>
  );
}

function profilePath(role?: string) {
  if (role === 'admin') return '/admin/perfil';
  if (role === 'sdr') return '/sdr/perfil';
  return '/perfil';
}
