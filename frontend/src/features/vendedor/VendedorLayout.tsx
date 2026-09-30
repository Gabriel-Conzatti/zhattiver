import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { NavPill } from '@/components/NavPill';
import { TopBar } from '@/components/TopBar';
import { SaleFormDialog } from './SaleFormDialog';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/prospeccao', label: 'Prospecção' },
  { to: '/agendamentos', label: 'Agendamentos' },
  { to: '/funil', label: 'Funil' },
  { to: '/followups', label: 'Follow-ups' },
];

export function VendedorLayout() {
  const [showSale, setShowSale] = useState(false);
  return (
    <div className="min-h-screen">
      <TopBar addAction={() => setShowSale(true)}>
        <div className="flex justify-center">
          <NavPill items={NAV} />
        </div>
      </TopBar>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      {showSale && <SaleFormDialog onClose={() => setShowSale(false)} />}
    </div>
  );
}
