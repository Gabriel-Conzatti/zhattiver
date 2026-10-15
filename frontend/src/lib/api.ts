import { api } from './http';
import type { CurrentUser } from './types';

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

export interface ClaimStatus {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_terminal: boolean;
}

export interface ClaimListItem {
  id: string;
  status_id: string;
  branch_id: string;
  insurer_id: string;
  workshop_id: string | null;
  status: string | null;
  status_name: string | null;
  team_id: string | null;
  responsible_user_id: string | null;
  lead_id: string | null;
  opportunity_id: string | null;
  sale_id: string | null;
  claim_number: string | null;
  branch: string;
  insurer: string;
  service_type: string | null;
  has_third_party: boolean;
  workshop: string | null;
  opened_on: string;
  expected_on: string | null;
  concluded_on: string | null;
  closed_on: string | null;
  indemnified_on: string | null;
  indemnified_amount: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimWorkshop {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  responsible_name: string;
  insurer_ids: string[];
}

export interface ClaimCatalogs {
  branches: CatalogItem[];
  insurers: CatalogItem[];
  workshops: ClaimWorkshop[];
}

export interface ClaimDetail extends ClaimListItem {
  parties: Array<{ id: string; role: string; name: string; phone: string | null; notes: string | null }>;
  events: Array<{ id: string; event_type: string; description: string; occurred_at: string }>;
  tasks: Array<{
    id: string;
    title: string;
    owner_user_id: string | null;
    due_on: string | null;
    priority: string;
    done_at: string | null;
  }>;
}

export const claims = {
  statuses: () => api<{ items: ClaimStatus[] }>('/claims/statuses'),
  catalogs: () => api<ClaimCatalogs>('/claims/catalogs'),
  assignees: () =>
    api<{
      users: Array<{ id: string; name: string }>;
      teams: Array<{ id: string; name: string }>;
    }>('/claims/assignees'),
  list: (
    params: {
      q?: string;
      status?: string;
      responsible_user_id?: string;
      insurer?: string;
      overdue?: boolean;
      page?: number;
      per_page?: number;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.status) qs.set('status', params.status);
    if (params.responsible_user_id) {
      qs.set('responsible_user_id', params.responsible_user_id);
    }
    if (params.insurer) qs.set('insurer', params.insurer);
    if (params.overdue) qs.set('overdue', 'true');
    if (params.page) qs.set('page', String(params.page));
    if (params.per_page) qs.set('per_page', String(params.per_page));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<{
      items: ClaimListItem[];
      page: number;
      per_page: number;
      total: number;
    }>(`/claims${suffix}`);
  },
  get: (id: string) => api<ClaimDetail>(`/claims/${id}`),
  update: (id: string, input: { branch_id?: string; insurer_id?: string; workshop_id?: string | null; responsible_user_id?: string | null; claim_number?: string | null; expected_on?: string | null; concluded_on?: string | null; indemnified_on?: string | null; indemnified_amount?: string | null; notes?: string | null }) =>
    api<ClaimDetail>(`/claims/${id}`, { method: 'PATCH', body: input }),
  create: (input: {
    status_id: string;
    branch_id: string;
    insurer_id: string;
    workshop_id?: string | null;
    opened_on: string;
    claim_number?: string;
    team_id?: string | null;
    responsible_user_id?: string | null;
    service_type?: string;
    has_third_party?: boolean;
    expected_on?: string | null;
    indemnified_on?: string | null;
    indemnified_amount?: string | null;
    notes?: string;
    parties?: Array<{ role: string; name: string; phone?: string; notes?: string }>;
  }) => api<ClaimDetail>('/claims', { method: 'POST', body: input }),
  changeStatus: (id: string, status_id: string) =>
    api<ClaimDetail>(`/claims/${id}/status`, { method: 'POST', body: { status_id } }),
  assign: (
    id: string,
    input: { responsible_user_id: string | null; team_id?: string | null },
  ) => api<ClaimDetail>(`/claims/${id}/assign`, { method: 'POST', body: input }),
  addEvent: (id: string, description: string) =>
    api<ClaimDetail>(`/claims/${id}/events`, { method: 'POST', body: { description } }),
  addTask: (id: string, input: { title: string; due_on?: string; priority?: string }) =>
    api<{ id: string; title: string }>(`/claims/${id}/tasks`, { method: 'POST', body: input }),
  updateTask: (claimId: string, taskId: string, done: boolean) =>
    api<ClaimDetail>(`/claims/${claimId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: { done },
    }),
  addParty: (
    id: string,
    input: { role: string; name: string; phone?: string; notes?: string },
  ) => api<{ id: string }>(`/claims/${id}/parties`, { method: 'POST', body: input }),
  archive: (id: string, reason: string) =>
    api<void>(`/claims/${id}/archive`, { method: 'POST', body: { reason } }),
  createWorkshop: (input: {
    name: string;
    phone?: string;
    address: string;
    responsible_name: string;
    insurer_ids: string[];
  }) => api<ClaimWorkshop>('/claims/workshops', { method: 'POST', body: input }),
  updateWorkshop: (
    id: string,
    input: Partial<{
      name: string;
      phone: string | null;
      address: string;
      responsible_name: string;
      insurer_ids: string[];
    }>,
  ) => api<ClaimWorkshop>(`/claims/workshops/${id}`, { method: 'PATCH', body: input }),
  archiveWorkshop: (id: string) =>
    api<void>(`/claims/workshops/${id}/archive`, { method: 'POST' }),
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

export interface DirectLeadInput {
  name: string;
  phone: string;
  product_id: string;
  city?: string | null;
  state?: string | null;
}

export interface DailyGoals {
  prospecting: { done: number; target: number };
  schedules: { done: number; target: number };
  followups: { done: number; target: number };
  closes_at_hour: number;
}

export const opportunities = {
  createDirectLead: (input: DirectLeadInput) =>
    api<{ lead: { id: string; name: string }; opportunity: Opportunity }>(
      '/opportunities/direct-lead',
      { method: 'POST', body: input },
    ),
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

export type DailyGoalsWithProduction = DailyGoals;

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

export interface MonthlyGoalRow {
  id: string;
  user_id: string;
  product_id: string | null;
  year: number;
  month: number;
  target_count: number;
  target_net_premium: string;
  notes: string | null;
}

export interface BonusRuleRow {
  id: string;
  product_id: string;
  name: string;
  base: 'count' | 'net_premium';
  bracket_min: string;
  bracket_max: string | null;
  bonus_kind: 'fixed' | 'percent';
  value: string;
  effective_from: string;
  effective_to: string | null;
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
  cancel: (id: string, reason: string) =>
    api<{ id: string; state: string }>(`/admin/bonus/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    }),
  bonusRules: () => api<{ items: BonusRuleRow[] }>('/bonus-rules'),
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
  endBonusRule: (id: string, effective_to: string) =>
    api<{ id: string; effective_to: string }>(`/bonus-rules/${id}`, {
      method: 'PATCH',
      body: { effective_to },
    }),
  goals: (year: number, month: number) =>
    api<{ items: MonthlyGoalRow[] }>(`/monthly-goals?year=${year}&month=${month}`),
  createGoal: (input: {
    user_id: string;
    product_id?: string | null;
    year: number;
    month: number;
    target_count: number;
    target_net_premium: string;
    notes?: string | null;
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
  daily_prospecting_quota: number | null;
  quota_effective_from: string | null;
  claims_access: 'none' | 'read' | 'manage';
}

export interface AuditLogEntry {
  id: number;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  occurred_at: string;
}

export interface AuditLogListResponse {
  items: AuditLogEntry[];
  page: number;
  per_page: number;
  total: number;
}

export interface FunnelStageConfig {
  id: string;
  name: string;
  order_index: number;
  is_initial: boolean;
  is_final: boolean;
  message_template: string | null;
  archived: boolean;
}

export interface FunnelConfig {
  id: string;
  product_id: string;
  name: string;
  is_default: boolean;
  archived: boolean;
  stages: FunnelStageConfig[];
}

export interface ConfigurableName {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface ProductionReport {
  year: number;
  month: number;
  filters: {
    seller_user_id: string | null;
    product_id: string | null;
  };
  state_counts: {
    registered: number;
    revision_pending: number;
    validated: number;
    cancelled: number;
  };
  totals: {
    validated_count: number;
    net_premium: string;
    commission_amount: string;
  };
  items: Array<{
    seller_user_id: string;
    seller_name: string;
    product_id: string;
    product_name: string;
    validated_count: number;
    net_premium: string;
    commission_amount: string;
  }>;
}

export interface AdminCatalogItem {
  id: string;
  name: string;
  slug?: string;
  is_active?: boolean;
  archived: boolean;
  category_id?: string | null;
  color?: string | null;
}

export interface AdminCatalogs {
  products: AdminCatalogItem[];
  origins: AdminCatalogItem[];
  client_types: AdminCatalogItem[];
  insurers: AdminCatalogItem[];
  tag_categories: AdminCatalogItem[];
  tags: AdminCatalogItem[];
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
  productionReport: (params: {
    year: number;
    month: number;
    seller_user_id?: string;
    product_id?: string;
  }) => {
    const qs = new URLSearchParams({
      year: String(params.year),
      month: String(params.month),
    });
    if (params.seller_user_id) qs.set('seller_user_id', params.seller_user_id);
    if (params.product_id) qs.set('product_id', params.product_id);
    return api<ProductionReport>(`/admin/reports/production?${qs.toString()}`);
  },
  catalogs: () => api<AdminCatalogs>('/admin/catalogs'),
  createCatalogItem: (
    kind: string,
    input: { name: string; category_id?: string | null; color?: string | null },
  ) =>
    api<AdminCatalogItem>(`/admin/catalogs/${kind}`, {
      method: 'POST',
      body: input,
    }),
  updateCatalogItem: (
    kind: string,
    id: string,
    changes: {
      name?: string;
      category_id?: string | null;
      color?: string | null;
      archived?: boolean;
    },
  ) =>
    api<AdminCatalogItem>(`/admin/catalogs/${kind}/${id}`, {
      method: 'PATCH',
      body: changes,
    }),
  users: () => api<{ items: AdminUser[] }>('/admin/users'),
  createUser: (input: {
    email: string;
    name: string;
    role: string;
    password: string;
    product_ids?: string[];
    claims_access?: string;
  }) => api<AdminUser>('/admin/users', { method: 'POST', body: input }),
  updateUser: (id: string, changes: Partial<{
    name: string;
    role: string;
    is_active: boolean;
    product_ids: string[];
    reset_password: string;
    daily_prospecting_quota: number;
    quota_effective_from: string;
    claims_access: string;
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
  audit: (
    params: {
      page?: number;
      per_page?: number;
      actor_user_id?: string;
      entity_type?: string;
      entity_id?: string;
      action?: string;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api<AuditLogListResponse>(`/audit${suffix}`);
  },
  funnels: () => api<{ items: FunnelConfig[] }>('/admin/funnels'),
  createFunnel: (input: { product_id: string; name: string; is_default: boolean }) =>
    api<{ id: string }>('/admin/funnels', { method: 'POST', body: input }),
  updateFunnel: (
    id: string,
    changes: Partial<{ name: string; is_default: boolean; archived: boolean }>,
  ) => api(`/admin/funnels/${id}`, { method: 'PATCH', body: changes }),
  createFunnelStage: (
    funnelId: string,
    input: {
      name: string;
      order_index: number;
      is_initial: boolean;
      is_final: boolean;
      message_template?: string | null;
    },
  ) =>
    api<FunnelStageConfig>(`/admin/funnels/${funnelId}/stages`, {
      method: 'POST',
      body: input,
    }),
  updateFunnelStage: (
    id: string,
    changes: Partial<Omit<FunnelStageConfig, 'id'>>,
  ) => api<FunnelStageConfig>(`/admin/funnel-stages/${id}`, { method: 'PATCH', body: changes }),
  lossReasons: () =>
    api<{ items: ConfigurableName[] }>('/loss-reasons?include_inactive=true'),
  createLossReason: (name: string) =>
    api<ConfigurableName>('/loss-reasons', { method: 'POST', body: { name } }),
  updateLossReason: (id: string, changes: Partial<Pick<ConfigurableName, 'name' | 'is_active'>>) =>
    api<ConfigurableName>(`/loss-reasons/${id}`, { method: 'PATCH', body: changes }),
  nextActionTypes: () =>
    api<{ items: ConfigurableName[] }>('/next-action-types?include_inactive=true'),
  createNextActionType: (name: string) =>
    api<ConfigurableName>('/next-action-types', { method: 'POST', body: { name } }),
  updateNextActionType: (
    id: string,
    changes: Partial<Pick<ConfigurableName, 'name' | 'is_active'>>,
  ) => api<ConfigurableName>(`/next-action-types/${id}`, { method: 'PATCH', body: changes }),
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

export const profile = {
  update: (name: string) =>
    api<CurrentUser>('/auth/profile', {
      method: 'PATCH',
      body: { name },
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>('/auth/change-password', {
      method: 'POST',
      body: {
        current_password: currentPassword,
        new_password: newPassword,
      },
    }),
};

export const passwordRecovery = {
  request: (email: string) =>
    api<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),
  reset: (token: string, newPassword: string) =>
    api<void>('/auth/reset-password', {
      method: 'POST',
      body: { token, new_password: newPassword },
    }),
};
