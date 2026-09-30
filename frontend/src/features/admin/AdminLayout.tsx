import { LogOut, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

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
      { to: '/admin/equipe', label: 'Equipe' },
      { to: '/admin/ausencias', label: 'Ausências' },
      { to: '/admin/concessoes', label: 'Concessões' },
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr]">
      <aside className="border-r border-border bg-surface/80 p-4">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan to-brand-blue text-black font-bold">
            L
          </div>
          <div>
            <div className="text-sm font-semibold">Lynk</div>
            <div className="text-xs text-text-secondary">Admin</div>
          </div>
        </div>
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
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-1.5 text-sm ${
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
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-text-secondary">
          <span title={user?.email}>{user?.name}</span>
          <div className="flex gap-2">
            <button type="button" aria-label="Configurações"><Settings className="h-4 w-4" /></button>
            <button type="button" onClick={() => void logout()} aria-label="Sair"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
      <main className="p-6">
        <div className="mb-4 flex justify-end">
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
