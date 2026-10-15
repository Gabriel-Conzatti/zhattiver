import { LogOut, Settings, User } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/app/AuthProvider';
import { NotificationBell } from './NotificationBell';

export function TopBar({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-base/90 px-3 py-2 backdrop-blur sm:px-4">
      <Link
        to={homePath(user?.role)}
        className="flex shrink-0 items-center rounded-md px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
        aria-label="Página inicial"
        title="Página inicial"
      >
        <img src="/logo-lynk.svg" alt="Lynk" className="h-12 w-12 object-contain" />
      </Link>
      <div className="scrollbar-none order-3 w-full min-w-0 overflow-x-auto lg:order-none lg:flex-1">
        {children}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
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

function homePath(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'sdr') return '/sdr';
  return '/';
}
