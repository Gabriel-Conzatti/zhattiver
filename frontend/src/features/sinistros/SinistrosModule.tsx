import { Outlet, useOutletContext } from 'react-router-dom';

import { useAuth } from '@/app/AuthProvider';
import { NavPill } from '@/components/NavPill';

interface ClaimsModuleContext {
  readOnly: boolean;
}

export function claimsNavItems(basePath: string) {
  return [
    { to: basePath, label: 'Dashboard', end: true },
    { to: `${basePath}/abertos`, label: 'Abertos' },
    { to: `${basePath}/fechados`, label: 'Fechados' },
    { to: `${basePath}/oficinas`, label: 'Oficinas' },
    { to: `${basePath}/infos`, label: 'Infos' },
  ];
}

/**
 * Agrupa as telas de sinistros. Quando a área própria já exibe a navegação no
 * cabeçalho (perfil exclusivo de sinistros), `basePath` pode ser omitido.
 */
export function SinistrosModule({
  basePath,
  readOnly = false,
}: {
  basePath?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-4">
      {basePath && (
        <div className="scrollbar-none overflow-x-auto">
          <NavPill items={claimsNavItems(basePath)} label="Navegação de sinistros" />
        </div>
      )}
      <Outlet context={{ readOnly } satisfies ClaimsModuleContext} />
    </div>
  );
}

export function useCanManageClaims() {
  const { user } = useAuth();
  const context = useOutletContext<ClaimsModuleContext | undefined>();
  return (
    !context?.readOnly &&
    (user?.role === 'admin' || user?.grants.includes('claims.manage') === true)
  );
}
