import { NavLink, Outlet } from 'react-router-dom';

import { TopBar } from '@/components/TopBar';

const NAV = [
  { to: '/sdr', label: 'Dashboard', end: true },
  { to: '/sdr/prospeccao', label: 'Prospecção' },
  { to: '/sdr/agendamentos', label: 'Agendamentos' },
  { to: '/sdr/importacoes', label: 'Importações' },
];

export function SdrLayout() {
  return (
    <div className="min-h-screen">
      <TopBar>
        <nav aria-label="Navegação SDR" className="flex justify-center gap-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-pill-item ${isActive ? 'bg-brand-blue/20 text-text-primary' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </TopBar>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
