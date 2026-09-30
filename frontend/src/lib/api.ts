import { api } from './http';

export interface CatalogItem {
  id: string;
  name: string;
}

export interface LeadListItem {
  id: string;
  name: string;
  kind: 'pf' | 'pj';
  city: string | null;
  state: string | null;
  phones: string[];
  archived: boolean;
}

export interface LeadListResponse {
  items: LeadListItem[];
  page: number;
  per_page: number;
  total: number;
}

export interface LeadPhone {
  phone_e164: string;
  original: string | null;
  is_primary: boolean;
}

export interface LeadFull {
  id: string;
  kind: 'pf' | 'pj';
  name: string;
  document: string | null;
  city: string | null;
  state: string | null;
  indicator_name: string | null;
  notes: string | null;
  origin_id: string | null;
  client_type_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  phones: LeadPhone[];
}

export interface CreateLeadInput {
  name: string;
  kind?: 'pf' | 'pj';
  phones: string[];
  document?: string | null;
  city?: string | null;
  state?: string | null;
  indicator_name?: string | null;
  notes?: string | null;
  origin_id?: string | null;
  client_type_id?: string | null;
  vehicles?: Array<{ plate?: string | null; model?: string | null; year?: number | null }>;
}

export interface Availability {
  id: string;
  lead_id: string;
  product_id: string;
  lead_name: string;
  lead_city: string | null;
  lead_state: string | null;
  phones: string[];
  origin_id: string | null;
  released_at: string;
  claimed_by: string | null;
}

export interface AvailabilityList {
  items: Availability[];
  page: number;
  per_page: number;
  total: number;
}

export const catalog = {
  products: () =>
    api<{ items: Array<{ id: string; name: string; slug: string; is_active: boolean }> }>(
      '/products',
    ),
  origins: () => api<{ items: CatalogItem[] }>('/origins'),
  clientTypes: () => api<{ items: CatalogItem[] }>('/client-types'),
  insurers: () => api<{ items: CatalogItem[] }>('/insurers'),
};

export const leads = {
  list: (params: { page?: number; per_page?: number; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.per_page) qs.set('per_page', String(params.per_page));
    if (params.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<LeadListResponse>(`/leads${suffix}`);
  },
  create: (input: CreateLeadInput) =>
    api<LeadFull>('/leads', { method: 'POST', body: input }),
  archive: (id: string, reason?: string) =>
    api<void>(`/leads/${id}/archive`, { method: 'POST', body: { reason } }),
  release: (leadId: string, productId: string, originId?: string) =>
    api<{ id: string; already_open: boolean }>('/availabilities', {
      method: 'POST',
      body: { lead_id: leadId, product_id: productId, origin_id: originId },
    }),
  availabilities: (params: { page?: number; per_page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.per_page) qs.set('per_page', String(params.per_page));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<AvailabilityList>(`/availabilities${suffix}`);
  },
};

export interface ImportBatchSummary {
  id: string;
  type: string;
  status: 'pending' | 'reviewing' | 'confirmed' | 'failed';
  filename: string;
  rows_total: number;
  rows_ok: number;
  rows_error: number;
  rows_duplicate: number;
  created_at: string;
}

export interface ImportBatchDetail extends ImportBatchSummary {
  rows: Array<{
    id: string;
    line_no: number;
    status: 'ok' | 'duplicate' | 'error' | 'skipped';
    errors: string[] | null;
    payload: Record<string, string>;
    normalized: Record<string, unknown> | null;
    duplicate_of_lead_id: string | null;
  }>;
}

export const importsApi = {
  list: () => api<{ items: ImportBatchSummary[] }>('/imports'),
  get: (id: string) => api<ImportBatchDetail>(`/imports/${id}`),
  upload: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const csrf = document.cookie.split('; ').find((r) => r.startsWith('lynk_csrf='))?.split('=')[1];
    const res = await fetch('/api/v1/imports/leads', {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : undefined,
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return (await res.json()) as { id: string; status: string };
  },
  confirm: (id: string) =>
    api<{ status: string; created: number; failed: number }>(`/imports/${id}/confirm`, {
      method: 'POST',
    }),
};

// -------------------- Etapa 4: oportunidades e agendamentos ------------------

export interface Opportunity {
  id: string;
  lead_id: string;
  product_id: string;
  funnel_id: string;
  current_stage_id: string;
  owner_user_id: string;
  state: 'open' | 'won' | 'lost';
  origin: string | null;
  opened_at: string;
  closed_at: string | null;
  last_relevant_at: string;
  message?: string | null;
  lead_name?: string | null;
  stage_name?: string | null;
}

export interface CopyMessageResponse {
  opportunity: Opportunity;
  counted: boolean;
  reused: boolean;
}

export interface DailyGoals {
  prospecting: { done: number; target: number };
  schedules: { done: number; target: number };
  followups: { done: number; target: number };
  closes_at_hour: number;
}

export const opportunities = {
  copyMessage: (input: {
    lead_id: string;
    product_id: string;
    idempotency_key: string;
    schedule_id?: string;
    origin?: string;
  }) => api<CopyMessageResponse>('/opportunities/copy-message', { method: 'POST', body: input }),
  list: (params: { state?: string; scope?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.state) qs.set('state', params.state);
    if (params.scope) qs.set('scope', params.scope);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<{ items: Opportunity[] }>(`/opportunities${suffix}`);
  },
  get: (id: string) => api<OpportunityDetail>(`/opportunities/${id}`),
  win: (id: string) =>
    api<Opportunity>(`/opportunities/${id}/win`, { method: 'POST', body: {} }),
  lose: (id: string, input: { loss_reason_id: string; justification: string }) =>
    api<Opportunity>(`/opportunities/${id}/lose`, { method: 'POST', body: input }),
  recycle: (
    id: string,
    input: { new_date: string; notes?: string; date_confirmed?: boolean },
  ) =>
    api<{ opportunity: Opportunity; schedule_id: string; coverage_end_date: string }>(
      `/opportunities/${id}/recycle`,
      { method: 'POST', body: input },
    ),
  changeStage: (id: string, stage_id: string) =>
    api<Opportunity>(`/opportunities/${id}/stage`, { method: 'POST', body: { stage_id } }),
  activity: (
    id: string,
    input: { type: 'contact' | 'call' | 'response' | 'note'; text?: string; idempotency_key?: string },
  ) => api<{ id: string; type: string; occurred_at: string }>(`/opportunities/${id}/activities`, {
    method: 'POST',
    body: input,
  }),
  createNextAction: (
    id: string,
    input: { type: string; due_at: string; notes?: string },
  ) =>
    api<{ id: string; type: string; due_at: string; state: string; notes: string | null; origin: string }>(
      `/opportunities/${id}/next-actions`,
      { method: 'POST', body: input },
    ),
  markNextActionDone: (id: string) =>
    api<{ id: string; state: string; done_at: string }>(`/next-actions/${id}/done`, {
      method: 'POST',
      body: {},
    }),
  myGoals: () => api<DailyGoals>('/me/goals/today'),
  myFollowups: () =>
    api<{
      pending: Array<{ opportunity_id: string; lead_name: string | null; last_relevant_at: string }>;
      next_actions: Array<{
        id: string;
        opportunity_id: string;
        type: string;
        due_at: string;
        origin: string;
        notes: string | null;
      }>;
    }>('/me/followups'),
  lossReasons: () => api<{ items: Array<{ id: string; name: string }> }>('/loss-reasons'),
  nextActionTypes: () =>
    api<{ items: Array<{ id: string; name: string; slug: string }> }>('/next-action-types'),
};

export interface OpportunityDetail {
  opportunity: Opportunity & { loss_reason_id: string | null; loss_justification: string | null };
  lead: { id: string | null; name: string | null; city: string | null; state: string | null };
  stages: Array<{ id: string; name: string; order_index: number }>;
  activities: Array<{
    id: string;
    type: string;
    occurred_at: string;
    actor_user_id: string;
    payload: Record<string, unknown> | null;
  }>;
  next_actions: Array<{
    id: string;
    type: string;
    due_at: string;
    state: 'open' | 'done' | 'cancelled';
    origin: string;
    notes: string | null;
    done_at: string | null;
  }>;
}

export interface ScheduleView {
  business_days_remaining: number;
  in_window: boolean;
  can_contact: boolean;
  past_contact_limit: boolean;
  label: string;
  window_opens_on: string;
  contact_limit_on: string;
}

export interface Schedule {
  id: string;
  lead_id: string;
  lead_name: string | null;
  lead_phone: string | null;
  product_id: string;
  owner_user_id: string | null;
  coverage_end_date: string;
  date_confirmed: boolean;
  state: 'scheduled' | 'contacted' | 'resolved' | 'cancelled';
  origin_id: string | null;
  notes: string | null;
  previous_schedule_id: string | null;
  view: ScheduleView;
}

export const schedules = {
  list: (params: { scope?: string; filter?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.scope) qs.set('scope', params.scope);
    if (params.filter) qs.set('filter', params.filter);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<{ items: Schedule[]; today: string }>(`/schedules${suffix}`);
  },
  create: (input: {
    lead_id: string;
    product_id: string;
    coverage_end_date: string;
    owner_user_id?: string | null;
    date_confirmed?: boolean;
    origin_id?: string | null;
    notes?: string | null;
  }) => api<Schedule>('/schedules', { method: 'POST', body: input }),
  resolve: (id: string, input: { reason: string; new_date: string; notes?: string }) =>
    api<{ previous: Schedule; next: Schedule }>(`/schedules/${id}/resolve`, {
      method: 'POST',
      body: input,
    }),
};

// -------------------- Etapa 6: vendas e bônus --------------------------------

export interface SaleSummary {
  id: string;
  lead_id: string;
  opportunity_id: string | null;
  product_id: string;
  seller_user_id: string;
  insurer_id: string;
  client_type_id: string;
  closed_on: string;
  origin: string | null;
  registered_at: string;
  edit_deadline_at: string;
  state: string;
  cancelled_reason?: string | null;
  cancelled_kind?: string | null;
  net_premium?: string;
  commission_pct?: string;
  commission_amount?: string;
  lead_name?: string | null;
}

export interface SaleCreateInput {
  lead_id: string;
  product_id: string;
  insurer_id: string;
  client_type_id: string;
  net_premium: string;
  commission_pct: string;
  closed_on: string;
  opportunity_id?: string;
  origin?: string;
  notes?: string;
}

export const sales = {
  list: (params: { scope?: string; state?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.scope) qs.set('scope', params.scope);
    if (params.state) qs.set('state', params.state);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<{ items: SaleSummary[] }>(`/sales${suffix}`);
  },
  create: (input: SaleCreateInput) => api<SaleSummary>('/sales', { method: 'POST', body: input }),
  get: (id: string) => api<SaleSummary>(`/sales/${id}`),
  update: (id: string, changes: Partial<SaleCreateInput> & { notes?: string }) =>
    api<SaleSummary>(`/sales/${id}`, { method: 'PATCH', body: changes }),
  validate: (id: string) => api<SaleSummary>(`/sales/${id}/validate`, { method: 'POST', body: {} }),
  cancel: (id: string, reason: string) =>
    api<SaleSummary>(`/sales/${id}/cancel`, { method: 'POST', body: { reason } }),
};

export interface DailyGoalsWithProduction extends DailyGoals {}

export interface ProductionSummary {
  year: number;
  month: number;
  product_id: string | null;
  count: number;
  net_premium: string | null;
  commission_amount: string | null;
  goal: { target_count: number; target_net_premium: string };
}

export interface BonusSummary {
  available: boolean;
  reason?: string;
  year?: number;
  month?: number;
  product_id?: string;
  base?: string;
  current?: string;
  amount?: string | null;
  rule_id?: string | null;
  predicted_on?: string;
  next_bracket?: {
    name: string;
    bracket_min: string;
    missing: string;
    bonus_kind: string;
    value: string;
  } | null;
}

export interface AdminBonusRow {
  id: string;
  user_id: string;
  product_id: string;
  year: number;
  month: number;
  state: 'predicted' | 'approved' | 'paid' | 'cancelled';
  metric_base: string;
  metric_value: string;
  amount: string;
  predicted_on: string;
  paid_at: string | null;
  paid_amount: string | null;
}

export const bonusApi = {
  myProduction: (params: { year?: number; month?: number; product_id?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.year) qs.set('year', String(params.year));
    if (params.month) qs.set('month', String(params.month));
    if (params.product_id) qs.set('product_id', params.product_id);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<ProductionSummary>(`/me/production${suffix}`);
  },
  myBonus: (params: { year?: number; month?: number; base?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.year) qs.set('year', String(params.year));
    if (params.month) qs.set('month', String(params.month));
    if (params.base) qs.set('base', params.base);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<BonusSummary>(`/me/bonus${suffix}`);
  },
  adminList: (params: { year?: number; month?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.year) qs.set('year', String(params.year));
    if (params.month) qs.set('month', String(params.month));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<{ items: AdminBonusRow[] }>(`/admin/bonus${suffix}`);
  },
  refresh: (year: number, month: number) =>
    api<{ refreshed: number }>(`/admin/bonus/refresh?year=${year}&month=${month}`, {
      method: 'POST',
      body: {},
    }),
  approve: (id: string) =>
    api<{ id: string; state: string }>(`/admin/bonus/${id}/approve`, {
      method: 'POST',
      body: {},
    }),
  pay: (id: string, paid_amount?: string) =>
    api<{ id: string; state: string; paid_at: string | null; paid_amount: string | null }>(
      `/admin/bonus/${id}/pay`,
      { method: 'POST', body: paid_amount ? { paid_amount } : {} },
    ),
  bonusRules: () =>
    api<{
      items: Array<{
        id: string;
        product_id: string;
        name: string;
        base: string;
        bracket_min: string;
        bracket_max: string | null;
        bonus_kind: string;
        value: string;
        effective_from: string;
        effective_to: string | null;
      }>;
    }>('/bonus-rules'),
  createBonusRule: (input: {
    product_id: string;
    name: string;
    base: string;
    bracket_min: string;
    bracket_max?: string | null;
    bonus_kind: string;
    value: string;
    effective_from: string;
    effective_to?: string | null;
  }) => api<{ id: string }>('/bonus-rules', { method: 'POST', body: input }),
  goals: (year: number, month: number) =>
    api<{
      items: Array<{
        id: string;
        user_id: string;
        product_id: string | null;
        year: number;
        month: number;
        target_count: number;
        target_net_premium: string;
      }>;
    }>(`/monthly-goals?year=${year}&month=${month}`),
  createGoal: (input: {
    user_id: string;
    product_id?: string | null;
    year: number;
    month: number;
    target_count: number;
    target_net_premium: string;
  }) => api<{ id: string }>('/monthly-goals', { method: 'POST', body: input }),
};

// -------------------- Etapa 7: gestão administrativa -----------------------

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'vendedor' | 'sdr';
  is_active: boolean;
  last_login_at: string | null;
  product_ids: string[];
}

export const admin = {
  dashboard: () =>
    api<{
      leads_total: number;
      open_opportunities: number;
      pending_sales: number;
      active_schedules: number;
      active_users: number;
    }>('/admin/dashboard'),
  users: () => api<{ items: AdminUser[] }>('/admin/users'),
  createUser: (input: {
    email: string;
    name: string;
    role: string;
    password: string;
    product_ids?: string[];
  }) => api<AdminUser>('/admin/users', { method: 'POST', body: input }),
  updateUser: (id: string, changes: Partial<{
    name: string;
    role: string;
    is_active: boolean;
    product_ids: string[];
    reset_password: string;
  }>) => api<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: changes }),
  grants: () =>
    api<{
      items: Array<{
        id: string;
        user_id: string;
        target_user_id: string | null;
        permission: string;
        scope: Record<string, unknown>;
        starts_at: string | null;
        ends_at: string | null;
        reason: string | null;
        revoked_at: string | null;
        granted_by: string;
      }>;
    }>('/admin/grants'),
  createGrant: (input: {
    user_id: string;
    permission: string;
    target_user_id?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    reason?: string | null;
  }) => api<{ id: string }>('/admin/grants', { method: 'POST', body: input }),
  revokeGrant: (id: string) =>
    api<void>(`/admin/grants/${id}/revoke`, { method: 'POST', body: {} }),
  absences: () =>
    api<{
      items: Array<{
        id: string;
        user_id: string;
        substitute_user_id: string | null;
        starts_on: string;
        ends_on: string;
        reason: string | null;
      }>;
    }>('/admin/absences'),
  createAbsence: (input: {
    user_id: string;
    substitute_user_id?: string | null;
    starts_on: string;
    ends_on: string;
    reason?: string | null;
  }) => api<{ id: string }>('/admin/absences', { method: 'POST', body: input }),
  transfer: (input: {
    from_user_id: string;
    to_user_id: string;
    include_schedules?: boolean;
    include_next_actions?: boolean;
    include_opportunities?: boolean;
  }) =>
    api<{ schedules: number; next_actions: number; opportunities: number }>(
      '/admin/transfers',
      { method: 'POST', body: input },
    ),
  crossSell: {
    list: () =>
      api<{
        items: Array<{
          id: string;
          name: string;
          target_product_id: string;
          state: 'draft' | 'partial' | 'released';
          total_items: number;
          released_items: number;
          created_at: string;
        }>;
      }>('/admin/cross-sell/lists'),
    get: (id: string) =>
      api<{
        id: string;
        name: string;
        target_product_id: string;
        state: string;
        total_items: number;
        released_items: number;
        filters: Record<string, unknown>;
        items: Array<{
          id: string;
          lead_id: string;
          lead_name: string;
          city: string | null;
          state: string | null;
          item_state: 'pending' | 'released' | 'skipped';
          last_contact_at: string | null;
          released_at: string | null;
        }>;
      }>(`/admin/cross-sell/lists/${id}`),
    create: (input: {
      name: string;
      target_product_id: string;
      has_product_ids?: string[];
      lacks_product_ids?: string[];
      include_unknown?: boolean;
    }) =>
      api<{ id: string; total_items: number }>('/admin/cross-sell/lists', {
        method: 'POST',
        body: input,
      }),
    release: (id: string, item_ids?: string[]) =>
      api<{ released: number; state: string }>(
        `/admin/cross-sell/lists/${id}/release`,
        { method: 'POST', body: item_ids ? { item_ids } : {} },
      ),
  },
};

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  link_path: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export const notifications = {
  list: (unread = false) =>
    api<{ items: NotificationRow[]; unread_count: number }>(
      `/notifications${unread ? '?unread=true' : ''}`,
    ),
  read: (id: string) =>
    api<NotificationRow>(`/notifications/${id}/read`, { method: 'POST', body: {} }),
  readAll: () => api<void>('/notifications/read-all', { method: 'POST', body: {} }),
};
