import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '@/app/AuthProvider';
import { NavPill } from '@/components/NavPill';
import { TopBar } from '@/components/TopBar';
import { NewLeadDialog } from './NewLeadDialog';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/prospeccao', label: 'Prospecção' },
  { to: '/agendamentos', label: 'Agendamentos' },
  { to: '/funil', label: 'Funil' },
  { to: '/followups', label: 'Follow-ups' },
];

export function VendedorLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNewLead, setShowNewLead] = useState(false);
  const navItems =
    user?.grants.includes('claims.manage') || user?.grants.includes('claims.read')
      ? [...NAV, { to: '/sinistros', label: 'Sinistros' }]
      : NAV;

  return (
    <div className="min-h-screen">
      <TopBar action={{ label: 'Novo lead', onClick: () => setShowNewLead(true) }}>
        <div className="flex lg:justify-center">
          <NavPill items={navItems} />
        </div>
      </TopBar>
      <main className="mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
      {showNewLead && (
        <NewLeadDialog
          onClose={() => setShowNewLead(false)}
          onSuccess={() => {
            setShowNewLead(false);
            navigate('/funil');
          }}
        />
      )}
    </div>
  );
}
