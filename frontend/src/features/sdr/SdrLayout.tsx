import { Outlet, useNavigate } from 'react-router-dom';

import { NavPill } from '@/components/NavPill';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/app/AuthProvider';

const NAV = [
  { to: '/sdr', label: 'Dashboard', end: true },
  { to: '/sdr/prospeccao', label: 'Prospecção' },
  { to: '/sdr/agendamentos', label: 'Agendamentos' },
  { to: '/sdr/importacoes', label: 'Importações' },
];

export function SdrLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // O estado `focusNew` faz a tela de destino focar o formulário de cadastro.
  const newActions = [
    {
      label: 'Novo lead de prospecção',
      onClick: () => navigate('/sdr/prospeccao', { state: { focusNew: true } }),
    },
    {
      label: 'Novo agendamento',
      onClick: () => navigate('/sdr/agendamentos', { state: { focusNew: true } }),
    },
  ];
  const navItems =
    user?.grants.includes('claims.manage') || user?.grants.includes('claims.read')
      ? [...NAV, { to: '/sdr/sinistros', label: 'Sinistros' }]
      : NAV;

  return (
    <div className="min-h-screen">
      <TopBar newActions={newActions}>
        <div className="flex lg:justify-center">
          <NavPill items={navItems} />
        </div>
      </TopBar>
      <main className="mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
