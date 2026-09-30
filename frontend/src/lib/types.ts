export type Role = 'admin' | 'vendedor' | 'sdr';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organization_id: string;
  products: string[];
  grants: string[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}
