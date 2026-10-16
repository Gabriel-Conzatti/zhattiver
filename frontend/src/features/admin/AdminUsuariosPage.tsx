import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';

import { admin, catalog, type AdminUser } from '@/lib/api';

const CLAIMS_ACCESS_OPTIONS: Array<{ value: AdminUser['claims_access']; label: string }> = [
  { value: 'none', label: 'Sem acesso' },
  { value: 'read', label: 'Consulta' },
  { value: 'manage', label: 'Operação' },
];

const CLAIMS_ACCESS_LABELS: Record<AdminUser['claims_access'], string> = {
  none: 'Sem acesso',
  read: 'Consulta',
  manage: 'Operação',
};

function ProfilesField({
  value,
  role,
  onRoleChange,
  onChange,
}: {
  value: AdminUser['claims_access'];
  role: AdminUser['role'];
  onRoleChange: (value: AdminUser['role']) => void;
  onChange: (value: AdminUser['claims_access']) => void;
}) {
  const isAdmin = role === 'admin';
  const isClaimsOnly = role === 'sinistros';
  const claimsSelected = isAdmin || isClaimsOnly || value !== 'none';

  const selectCommercialRole = (profile: Exclude<AdminUser['role'], 'sinistros'>) => {
    if (role === profile && claimsSelected) {
      onRoleChange('sinistros');
      return;
    }
    onRoleChange(profile);
  };

  return (
    <Field label="Perfis">
      <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Perfis do usuário">
        {(['vendedor', 'sdr', 'admin'] as const).map((profile) => (
          <button
            type="button"
            key={profile}
            role="checkbox"
            aria-checked={role === profile}
            onClick={() => selectCommercialRole(profile)}
            className={`nav-pill-item ${role === profile ? 'bg-brand-cyan/20 text-brand-cyan' : ''}`}
          >
            {profile === 'vendedor'
              ? 'Vendedor'
              : profile === 'sdr'
                ? 'SDR'
                : 'Administrador'}
          </button>
        ))}
        <label
          className={`nav-pill-item ${isClaimsOnly ? 'cursor-default' : 'cursor-pointer'} ${claimsSelected ? 'bg-brand-cyan/20 text-brand-cyan' : ''}`}
        >
          <input
            type="checkbox"
            className="sr-only"
            aria-label="Sinistros"
            checked={claimsSelected}
            disabled={isAdmin || isClaimsOnly}
            onChange={(e) => onChange(e.target.checked ? 'manage' : 'none')}
          />
          Sinistros
        </label>
      </div>
      {claimsSelected && (
        <select
          aria-label="Nível de acesso a sinistros"
          className="input mt-2"
          value={isAdmin ? 'manage' : value}
          disabled={isAdmin}
          onChange={(e) => onChange(e.target.value as AdminUser['claims_access'])}
        >
          {CLAIMS_ACCESS_OPTIONS.filter((option) => option.value !== 'none').map((option) => (
            <option key={option.value} value={option.value}>
              Sinistros: {option.label}
            </option>
          ))}
        </select>
      )}
      <p className="mt-1 text-xs text-text-secondary">
        {isAdmin
          ? 'Administrador sempre opera sinistros.'
          : isClaimsOnly
            ? 'Perfil exclusivo: este usuário verá somente o módulo de sinistros.'
            : value === 'none'
              ? 'Selecione Sinistros para adicionar essa função ao perfil comercial.'
              : 'Para deixar somente Sinistros, clique novamente no perfil comercial selecionado.'}
      </p>
    </Field>
  );
}

export function AdminUsuariosPage() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: admin.users });
  const products = useQuery({ queryKey: ['products'], queryFn: catalog.products });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const items = users.data?.items ?? [];
  const productMap = useMemo(
    () => Object.fromEntries((products.data?.items ?? []).map((p) => [p.id, p.name])),
    [products.data],
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-text-secondary">
            Gerencie perfis, produtos autorizados e redefinição de senha. Informações
            individuais de bônus permanecem protegidas.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          <UserPlus className="h-4 w-4" /> Novo usuário
        </button>
      </header>

      <section className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Perfil</th>
                <th className="px-4 py-2 text-left">Produtos</th>
                <th className="px-4 py-2 text-left">Sinistros</th>
                <th className="px-4 py-2 text-left">Meta/dia</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2 text-text-secondary">{u.email}</td>
                  <td className="px-4 py-2">
                    <span className="badge bg-brand-blue/20 text-brand-cyan">{u.role}</span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {u.product_ids.length === 0
                      ? '—'
                      : u.product_ids.map((id) => productMap[id] ?? id.slice(0, 8)).join(', ')}
                  </td>
                  <td className="px-4 py-2">
                    {CLAIMS_ACCESS_LABELS[u.claims_access] ?? 'Sem acesso'}
                  </td>
                  <td className="px-4 py-2">
                    {u.role === 'vendedor' ? (u.daily_prospecting_quota ?? 'Não definida') : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`badge ${u.is_active ? 'bg-state-success/20 text-state-success' : 'bg-state-danger/20 text-state-danger'}`}
                    >
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setEditing(u)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-secondary">
                    Nenhum usuário.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {creating && (
        <CreateDialog
          products={products.data?.items ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'users'] });
            setCreating(false);
          }}
        />
      )}
      {editing && (
        <EditDialog
          user={editing}
          products={products.data?.items ?? []}
          onClose={() => setEditing(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'users'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CreateDialog({
  products,
  onClose,
  onDone,
}: {
  products: Array<{ id: string; name: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'vendedor' as AdminUser['role'],
    password: '',
    product_ids: [] as string[],
    claims_access: 'none' as AdminUser['claims_access'],
  });
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () =>
      admin.createUser({
        email: form.email,
        name: form.name,
        role: form.role,
        password: form.password,
        product_ids: form.product_ids,
        claims_access: form.role === 'admin' ? undefined : form.claims_access,
      }),
    onSuccess: onDone,
    onError: (err) => setError((err as Error).message),
  });
  return (
    <Modal title="Novo usuário" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" required>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Email" required>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Senha (mín. 10)" required>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
      </div>
      <ProfilesField
        value={form.claims_access}
        role={form.role}
        onRoleChange={(role) => setForm({ ...form, role })}
        onChange={(value) => setForm({ ...form, claims_access: value })}
      />
      <Field label="Produtos autorizados">
        <div className="mt-1 flex flex-wrap gap-2">
          {products.map((p) => {
            const selected = form.product_ids.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`nav-pill-item ${selected ? 'bg-brand-cyan/20 text-brand-cyan' : ''}`}
                onClick={() =>
                  setForm({
                    ...form,
                    product_ids: selected
                      ? form.product_ids.filter((x) => x !== p.id)
                      : [...form.product_ids, p.id],
                  })
                }
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </Field>
      {error && <p className="mt-2 text-xs text-state-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => mut.mutate()}
          disabled={
            !form.email || !form.name || form.password.length < 10 || mut.isPending
          }
        >
          {mut.isPending ? 'Criando…' : 'Criar usuário'}
        </button>
      </div>
    </Modal>
  );
}

function EditDialog({
  user,
  products,
  onClose,
  onDone,
}: {
  user: AdminUser;
  products: Array<{ id: string; name: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    is_active: user.is_active,
    product_ids: user.product_ids,
    reset_password: '',
    claims_access: user.claims_access,
    new_prospecting_quota: '',
    quota_effective_from: new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }),
  });
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () =>
      admin.updateUser(user.id, {
        name: form.name,
        role: form.role,
        is_active: form.is_active,
        product_ids: form.product_ids,
        reset_password: form.reset_password || undefined,
        claims_access: form.role === 'admin' ? undefined : form.claims_access,
        daily_prospecting_quota:
          form.new_prospecting_quota === ''
            ? undefined
            : Number(form.new_prospecting_quota),
        quota_effective_from:
          form.new_prospecting_quota === '' ? undefined : form.quota_effective_from,
      }),
    onSuccess: onDone,
    onError: (err) => setError((err as Error).message),
  });
  return (
    <Modal title={`Editar ${user.name}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome">
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
        />
        Usuário ativo
      </label>
      <ProfilesField
        value={form.claims_access}
        role={form.role}
        onRoleChange={(role) => setForm({ ...form, role })}
        onChange={(value) => setForm({ ...form, claims_access: value })}
      />
      <Field label="Produtos autorizados">
        <div className="mt-1 flex flex-wrap gap-2">
          {products.map((p) => {
            const selected = form.product_ids.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`nav-pill-item ${selected ? 'bg-brand-cyan/20 text-brand-cyan' : ''}`}
                onClick={() =>
                  setForm({
                    ...form,
                    product_ids: selected
                      ? form.product_ids.filter((x) => x !== p.id)
                      : [...form.product_ids, p.id],
                  })
                }
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Nova senha (opcional, mín. 10)">
        <input
          className="input"
          type="password"
          value={form.reset_password}
          onChange={(e) => setForm({ ...form, reset_password: e.target.value })}
        />
      </Field>
      {form.role === 'vendedor' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nova meta diária de prospecção">
            <input
              aria-label="Nova meta diária de prospecção"
              className="input"
              type="number"
              min={0}
              max={10000}
              placeholder={
                user.daily_prospecting_quota === null
                  ? 'Não definida'
                  : `Atual: ${user.daily_prospecting_quota}`
              }
              value={form.new_prospecting_quota}
              onChange={(e) =>
                setForm({ ...form, new_prospecting_quota: e.target.value })
              }
            />
          </Field>
          <Field label="Vigência da nova meta">
            <input
              aria-label="Vigência da nova meta"
              className="input"
              type="date"
              value={form.quota_effective_from}
              onChange={(e) =>
                setForm({ ...form, quota_effective_from: e.target.value })
              }
            />
          </Field>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-state-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
        >
          {mut.isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl card-strong p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[1rem] font-semibold">{title}</h3>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="mt-3">
      <label className="label">
        {label} {required && <span className="text-brand-orange">*</span>}
      </label>
      {children}
    </div>
  );
}
