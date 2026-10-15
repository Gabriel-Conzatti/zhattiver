import { Outlet } from 'react-router-dom';

import { NavPill } from '@/components/NavPill';
import { TopBar } from '@/components/TopBar';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/prospeccao', label: 'Prospecção' },
  { to: '/agendamentos', label: 'Agendamentos' },
  { to: '/funil', label: 'Funil' },
  { to: '/followups', label: 'Follow-ups' },
];

export function VendedorLayout() {
  return (
    <div className="min-h-screen">
      <TopBar>
        <div className="flex lg:justify-center">
          <NavPill items={NAV} />
        </div>
      </TopBar>
      <main className="mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
