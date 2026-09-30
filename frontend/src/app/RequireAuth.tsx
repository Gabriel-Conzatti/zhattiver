import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from './AuthProvider';
import type { Role } from '@/lib/types';

interface Props {
  roles: Role[];
}

export function RequireAuth({ roles }: Props) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />;
  return <Outlet />;
}
