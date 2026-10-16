import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Plus, Settings, User } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/app/AuthProvider';
import { NotificationBell } from './NotificationBell';

export interface NewAction {
  label: string;
  onClick: () => void;
}

interface TopBarProps {
  children?: React.ReactNode;
  newActions?: NewAction[];
}

export function TopBar({ children, newActions = [] }: TopBarProps) {
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
        {newActions.length > 0 && <NewMenu actions={newActions} />}
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

function NewMenu({ actions }: { actions: NewAction[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="btn-orange h-9 px-3 text-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Plus className="h-4 w-4" /> Novo <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface-2 py-1 shadow-card"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-sm text-text-primary transition hover:bg-surface"
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function profilePath(role?: string) {
  if (role === 'admin') return '/admin/perfil';
  if (role === 'sdr') return '/sdr/perfil';
  if (role === 'sinistros') return '/area-sinistros/perfil';
  return '/perfil';
}

function homePath(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'sdr') return '/sdr';
  if (role === 'sinistros') return '/area-sinistros';
  return '/';
}
