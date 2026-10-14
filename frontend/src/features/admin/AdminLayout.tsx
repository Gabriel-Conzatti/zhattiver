import { useState } from 'react';
import { LogOut, Menu, Settings, User, X } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/app/AuthProvider';
import { NotificationBell } from '@/components/NotificationBell';

const GROUPS: Array<{ label: string; items: Array<{ to: string; label: string; end?: boolean }> }> = [
  {
    label: 'Comercial',
    items: [
      { to: '/admin', label: 'Dashboard', end: true },
      { to: '/admin/prospeccao', label: 'Prospecção' },
      { to: '/admin/cross-sell', label: 'Cross-Sell' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/admin/producao', label: 'Produção' },
      { to: '/admin/bonus', label: 'Bônus' },
      { to: '/admin/relatorios', label: 'Relatórios' },
      { to: '/admin/equipe', label: 'Equipe' },
      { to: '/admin/ausencias', label: 'Ausências' },
      { to: '/admin/concessoes', label: 'Concessões' },
      { to: '/admin/auditoria', label: 'Auditoria' },
      { to: '/admin/configuracoes', label: 'Configurações' },
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-base/95 px-3 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          className="icon-button"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">Funil Sustentare</div>
          <div className="text-xs text-text-secondary">Administração</div>
        </div>
        <NotificationBell />
      </header>
      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/65 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(86vw,280px)] flex-col border-r border-border bg-surface p-4 shadow-2xl transition-transform lg:static lg:w-auto lg:translate-x-0 lg:shadow-none ${
          menuOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible'
        }`}
      >
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo-funil.svg" alt="" className="h-9 w-9 object-contain" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Funil Sustentare</div>
            <div className="text-xs text-text-secondary">Admin</div>
          </div>
          <button
            type="button"
            className="icon-button lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Navegação administrativa">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">
                {group.label}
              </div>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `block rounded-lg px-3 py-2 text-sm ${
                          isActive
                            ? 'bg-gradient-to-r from-brand-cyan to-brand-blue text-black'
                            : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4 text-xs text-text-secondary">
          <span className="min-w-0 truncate" title={user?.email}>{user?.name}</span>
          <div className="flex gap-2">
            <Link to="/admin/perfil" className="p-1 hover:text-brand-cyan" aria-label="Perfil" title="Perfil"><User className="h-4 w-4" /></Link>
            <Link to="/admin/configuracoes" className="p-1 hover:text-brand-cyan" aria-label="Configurações" title="Configurações"><Settings className="h-4 w-4" /></Link>
            <button type="button" className="p-1 hover:text-brand-cyan" onClick={() => void logout()} aria-label="Sair" title="Sair"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 p-3 sm:p-4 lg:p-6">
        <div className="mb-4 hidden justify-end lg:flex">
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
