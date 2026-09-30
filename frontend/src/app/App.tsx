import { Navigate, Route, Routes } from 'react-router-dom';

import { LoginPage } from '@/features/auth/LoginPage';
import { AdminLayout } from '@/features/admin/AdminLayout';
import { AdminDashboard } from '@/features/admin/AdminDashboard';
import { AdminLeadsPage } from '@/features/admin/AdminLeadsPage';
import { AdminProducaoPage } from '@/features/admin/AdminProducaoPage';
import { AdminBonusPage } from '@/features/admin/AdminBonusPage';
import { AdminUsuariosPage } from '@/features/admin/AdminUsuariosPage';
import { AdminAusenciasPage } from '@/features/admin/AdminAusenciasPage';
import { AdminConcessoesPage } from '@/features/admin/AdminConcessoesPage';
import { AdminCrossSellPage } from '@/features/admin/AdminCrossSellPage';
import { SdrLayout } from '@/features/sdr/SdrLayout';
import { SdrDashboard } from '@/features/sdr/SdrDashboard';
import { SdrProspeccaoPage } from '@/features/sdr/SdrProspeccaoPage';
import { SdrAgendamentosPage } from '@/features/sdr/SdrAgendamentosPage';
import { SdrImportacoesPage } from '@/features/sdr/SdrImportacoesPage';
import { VendedorLayout } from '@/features/vendedor/VendedorLayout';
import { VendedorDashboard } from '@/features/vendedor/VendedorDashboard';
import { ProspeccaoPage } from '@/features/vendedor/ProspeccaoPage';
import { AgendamentosPage } from '@/features/vendedor/AgendamentosPage';
import { FunilPage } from '@/features/vendedor/FunilPage';
import { FollowupsPage } from '@/features/vendedor/FollowupsPage';

import { RequireAuth } from './RequireAuth';
import { useAuth } from './AuthProvider';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid h-screen place-items-center">
        <div className="text-text-secondary">Carregando…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <LoginPage />} />
      <Route element={<RequireAuth roles={['vendedor']} />}>
        <Route element={<VendedorLayout />}>
          <Route path="/" element={<VendedorDashboard />} />
          <Route path="/prospeccao" element={<ProspeccaoPage />} />
          <Route path="/agendamentos" element={<AgendamentosPage />} />
          <Route path="/funil" element={<FunilPage />} />
          <Route path="/followups" element={<FollowupsPage />} />
        </Route>
      </Route>
      <Route element={<RequireAuth roles={['sdr']} />}>
        <Route path="/sdr" element={<SdrLayout />}>
          <Route index element={<SdrDashboard />} />
          <Route path="prospeccao" element={<SdrProspeccaoPage />} />
          <Route path="agendamentos" element={<SdrAgendamentosPage />} />
          <Route path="importacoes" element={<SdrImportacoesPage />} />
        </Route>
      </Route>
      <Route element={<RequireAuth roles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="prospeccao" element={<AdminLeadsPage />} />
          <Route path="producao" element={<AdminProducaoPage />} />
          <Route path="bonus" element={<AdminBonusPage />} />
          <Route path="equipe" element={<AdminUsuariosPage />} />
          <Route path="ausencias" element={<AdminAusenciasPage />} />
          <Route path="concessoes" element={<AdminConcessoesPage />} />
          <Route path="cross-sell" element={<AdminCrossSellPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function homeFor(role: string) {
  if (role === 'admin') return '/admin';
  if (role === 'sdr') return '/sdr';
  return '/';
}
