import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { catalog, leads, sales } from '@/lib/api';

interface Props {
  opportunityId?: string;
  leadId?: string;
  leadName?: string;
  productId?: string;
  onClose: () => void;
  onSuccess?: (saleId: string) => void;
}

export function SaleFormDialog({
  opportunityId,
  leadId,
  leadName,
  productId,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ['products'], queryFn: catalog.products });
  const insurers = useQuery({ queryKey: ['catalog', 'insurers'], queryFn: catalog.insurers });
  const clientTypes = useQuery({
    queryKey: ['catalog', 'client-types'],
    queryFn: catalog.clientTypes,
  });
  const leadsList = useQuery({
    queryKey: ['leads', 'sale-picker'],
    queryFn: () => leads.list({ per_page: 200 }),
    enabled: !leadId,
  });

  const [form, setForm] = useState({
    lead_id: leadId ?? '',
    product_id: productId ?? '',
    insurer_id: '',
    client_type_id: '',
    net_premium: '',
    commission_pct: '',
    closed_on: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      product_id: productId ?? f.product_id,
      lead_id: leadId ?? f.lead_id,
    }));
  }, [productId, leadId]);

  const mut = useMutation({
    mutationFn: () =>
      sales.create({
        lead_id: form.lead_id,
        product_id: form.product_id,
        insurer_id: form.insurer_id,
        client_type_id: form.client_type_id,
        net_premium: form.net_premium,
        commission_pct: normalizePct(form.commission_pct),
        closed_on: form.closed_on,
        opportunity_id: opportunityId,
        notes: form.notes || undefined,
      }),
    onSuccess: (sale) => {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['me', 'production'] });
      qc.invalidateQueries({ queryKey: ['me', 'bonus'] });
      onSuccess?.(sale.id);
      onClose();
    },
    onError: (err) => setError((err as Error).message),
  });

  const commissionPreview = previewCommission(form.net_premium, form.commission_pct);
  const missing =
    !form.lead_id ||
    !form.product_id ||
    !form.insurer_id ||
    !form.client_type_id ||
    !form.net_premium ||
    !form.commission_pct ||
    !form.closed_on;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg card-strong p-6">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {opportunityId ? 'Registrar venda' : 'Venda direta'}
            </h2>
            {leadName && (
              <p className="text-xs text-text-secondary">
                Cliente: <strong>{leadName}</strong>
              </p>
            )}
            <p className="mt-1 text-xs text-text-muted">
              Comissão calculada no servidor (RN-033). Você pode editar esta venda até 23h59 do
              próximo dia útil (RN-034).
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {!leadId && (
            <Field label="Lead" required>
              <select
                className="input"
                value={form.lead_id}
                onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
              >
                <option value="">Selecione…</option>
                {leadsList.data?.items.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Produto" required>
            <select
              className="input"
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              disabled={!!productId}
            >
              <option value="">Selecione…</option>
              {products.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Seguradora" required>
            <select
              className="input"
              value={form.insurer_id}
              onChange={(e) => setForm({ ...form, insurer_id: e.target.value })}
            >
              <option value="">Selecione…</option>
              {insurers.data?.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de cliente" required>
            <select
              className="input"
              value={form.client_type_id}
              onChange={(e) => setForm({ ...form, client_type_id: e.target.value })}
            >
              <option value="">Selecione…</option>
              {clientTypes.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data de fechamento" required>
            <input
              type="date"
              className="input"
              value={form.closed_on}
              onChange={(e) => setForm({ ...form, closed_on: e.target.value })}
            />
          </Field>
          <Field label="Prêmio líquido (R$)" required>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.net_premium}
              onChange={(e) => setForm({ ...form, net_premium: e.target.value })}
            />
          </Field>
          <Field label="% comissão" required hint="Ex.: 15 para 15%">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="input"
              value={form.commission_pct}
              onChange={(e) => setForm({ ...form, commission_pct: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Observações">
          <textarea
            className="input h-16"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        <div className="mt-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-xs">
          Comissão prevista: <strong>{commissionPreview}</strong>
        </div>

        {error && <p className="mt-3 text-xs text-state-danger">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => mut.mutate()}
            disabled={missing || mut.isPending}
          >
            {mut.isPending ? 'Registrando…' : 'Registrar venda'}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizePct(value: string): string {
  // Aceita "15" ou "15,00" ou "0.15" — sempre devolve a fração (0..1)
  if (!value) return '0';
  const clean = value.replace(',', '.').trim();
  const n = Number(clean);
  if (!isFinite(n) || n <= 0) return '0';
  return n > 1 ? String(n / 100) : String(n);
}

function previewCommission(net: string, pct: string): string {
  const n = Number((net || '0').replace(',', '.'));
  const p = Number(normalizePct(pct));
  if (!isFinite(n) || !isFinite(p) || n <= 0 || p <= 0) return 'R$ —';
  const value = (n * p).toFixed(2);
  return `R$ ${value.replace('.', ',')}`;
}

function Field({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mt-3">
      <label className="label">
        {label} {required && <span className="text-brand-orange">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-text-muted">{hint}</p>}
    </div>
  );
}
