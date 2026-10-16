import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { catalog, leads, type LeadFull } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { ApiRequestError } from '@/lib/http';

export function LeadEditDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const leadQuery = useQuery({ queryKey: ['leads', 'detail', leadId], queryFn: () => leads.get(leadId) });

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="lead-edit-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="card-strong max-h-[90vh] w-full max-w-xl overflow-y-auto p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <h2 id="lead-edit-title" className="text-lg font-semibold">
            Editar lead
          </h2>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </header>
        {leadQuery.isLoading ? (
          <p className="text-sm text-text-secondary">Carregando lead…</p>
        ) : leadQuery.isError || !leadQuery.data ? (
          <p className="text-sm text-state-danger">Não foi possível carregar o lead.</p>
        ) : (
          <LeadEditForm lead={leadQuery.data} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function LeadEditForm({ lead, onClose }: { lead: LeadFull; onClose: () => void }) {
  const queryClient = useQueryClient();
  const originsQuery = useQuery({ queryKey: ['catalog', 'origins'], queryFn: catalog.origins });
  const clientTypesQuery = useQuery({
    queryKey: ['catalog', 'client-types'],
    queryFn: catalog.clientTypes,
  });
  const [form, setForm] = useState({
    name: lead.name,
    kind: lead.kind,
    document: lead.document ?? '',
    phones: lead.phones.map((phone) => formatPhone(phone.phone_e164)).join(', '),
    postal_code: lead.postal_code ?? '',
    city: lead.city ?? '',
    state: lead.state ?? '',
    origin_id: lead.origin_id ?? '',
    client_type_id: lead.client_type_id ?? '',
    indicator_name: lead.indicator_name ?? '',
    notes: lead.notes ?? '',
  });
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const mutation = useMutation({
    mutationFn: () =>
      leads.update(lead.id, {
        name: form.name.trim(),
        kind: form.kind,
        document: form.document.trim() || null,
        phones: form.phones
          .split(/[,;\n]/g)
          .map((phone) => phone.trim())
          .filter(Boolean),
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        origin_id: form.origin_id || null,
        client_type_id: form.client_type_id || null,
        indicator_name: form.indicator_name.trim() || null,
        notes: form.notes.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.phones.trim()) return;
    mutation.mutate();
  }

  const error = mutation.error;
  const duplicate =
    error instanceof ApiRequestError && error.code === 'duplicate_lead'
      ? (error.details as { lead_name?: string } | undefined)?.lead_name
      : undefined;

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <Field label="Nome">
          <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </Field>
        <Field label="Pessoa">
          <select
            className="input"
            value={form.kind}
            onChange={(e) => update('kind', e.target.value as 'pf' | 'pj')}
          >
            <option value="pf">Física</option>
            <option value="pj">Jurídica</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone(s)">
          <input className="input" value={form.phones} onChange={(e) => update('phones', e.target.value)} required />
        </Field>
        <Field label="CPF/CNPJ">
          <input className="input" value={form.document} onChange={(e) => update('document', e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-[120px_1fr_72px] gap-3">
        <Field label="CEP">
          <input
            className="input"
            value={form.postal_code}
            onChange={(e) => update('postal_code', e.target.value)}
            inputMode="numeric"
          />
        </Field>
        <Field label="Cidade">
          <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} />
        </Field>
        <Field label="UF">
          <input
            className="input uppercase"
            maxLength={2}
            value={form.state}
            onChange={(e) => update('state', e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Origem">
          <select className="input" value={form.origin_id} onChange={(e) => update('origin_id', e.target.value)}>
            <option value="">—</option>
            {originsQuery.data?.items.map((origin) => (
              <option key={origin.id} value={origin.id}>
                {origin.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo de cliente">
          <select
            className="input"
            value={form.client_type_id}
            onChange={(e) => update('client_type_id', e.target.value)}
          >
            <option value="">—</option>
            {clientTypesQuery.data?.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Indicado por">
        <input
          className="input"
          value={form.indicator_name}
          onChange={(e) => update('indicator_name', e.target.value)}
        />
      </Field>
      <Field label="Observações">
        <textarea className="input h-20" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
      </Field>
      {error && (
        <div className="rounded-lg border border-state-danger/30 bg-state-danger/10 p-3 text-sm text-state-danger">
          {duplicate
            ? `Telefone já cadastrado no lead "${duplicate}".`
            : error instanceof Error
              ? error.message
              : 'Não foi possível salvar o lead.'}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar lead'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
