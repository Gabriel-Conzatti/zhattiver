import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Archive, CheckCircle2, PhoneCall, Send } from 'lucide-react';

import { catalog, leads } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { ApiRequestError } from '@/lib/http';

const leadSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório'),
  phones: z
    .string()
    .trim()
    .min(1, 'Informe pelo menos um telefone')
    .transform((v) => v.split(/[,;\n]/g).map((x) => x.trim()).filter(Boolean)),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2, 'UF com 2 letras').optional(),
  indicator_name: z.string().trim().optional(),
  origin_id: z.string().optional(),
  client_type_id: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

export function SdrProspeccaoPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'warn'; text: string } | null>(
    null,
  );

  const listQuery = useQuery({
    queryKey: ['leads', 'sdr', search],
    queryFn: () => leads.list({ q: search || undefined, per_page: 50 }),
  });

  const originsQuery = useQuery({ queryKey: ['catalog', 'origins'], queryFn: catalog.origins });
  const clientTypesQuery = useQuery({
    queryKey: ['catalog', 'client-types'],
    queryFn: catalog.clientTypes,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({ defaultValues: { name: '', phones: '' as unknown as string[] } });

  const createMutation = useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const parsed = leadSchema.parse(values);
      return leads.create({
        name: parsed.name,
        phones: parsed.phones,
        city: parsed.city || null,
        state: parsed.state ? parsed.state.toUpperCase() : null,
        indicator_name: parsed.indicator_name || null,
        origin_id: parsed.origin_id || null,
        client_type_id: parsed.client_type_id || null,
      });
    },
    onSuccess: () => {
      setFeedback({ tone: 'success', text: 'Lead cadastrado' });
      reset({ name: '', phones: '' as unknown as string[], city: '', state: '', indicator_name: '' });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.code === 'duplicate_lead') {
        const details = err.details as { lead_id?: string; lead_name?: string } | undefined;
        setFeedback({
          tone: 'warn',
          text: `Duplicado: já existe "${details?.lead_name ?? ''}" com esse telefone.`,
        });
      } else {
        setFeedback({ tone: 'error', text: (err as Error).message });
      }
    },
  });

  const onSubmit = (values: LeadFormValues) => createMutation.mutate(values);

  const rows = listQuery.data?.items ?? [];
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: catalog.products });
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const primaryProduct =
    selectedProduct || productsQuery.data?.items[0]?.id || '';

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Novo lead</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Telefone é o identificador de duplicidade (RN-076/077). Formatos equivalentes são
          reconhecidos.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Nome" error={errors.name?.message}>
            <input className="input" autoComplete="off" {...register('name')} />
          </Field>
          <Field
            label="Telefone(s)"
            hint="Separe por vírgula. Use DDD."
            error={errors.phones?.message as string | undefined}
          >
            <input
              className="input"
              placeholder="(51) 99999-9999"
              autoComplete="off"
              {...register('phones' as never)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cidade">
              <input className="input" {...register('city')} />
            </Field>
            <Field label="UF" error={errors.state?.message}>
              <input className="input uppercase" maxLength={2} {...register('state')} />
            </Field>
            <Field label="Origem">
              <select className="input" {...register('origin_id')}>
                <option value="">—</option>
                {originsQuery.data?.items.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Indicado por">
              <input className="input" {...register('indicator_name')} />
            </Field>
            <Field label="Tipo de cliente">
              <select className="input" {...register('client_type_id')}>
                <option value="">—</option>
                {clientTypesQuery.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {feedback && <Feedback tone={feedback.tone} text={feedback.text} />}
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Cadastrar lead'}
          </button>
        </form>
      </section>

      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-lg font-semibold">Leads cadastrados</h2>
            <p className="text-xs text-text-secondary">
              Disponibilize para o produto autorizado quando estiver pronto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="input w-40"
              value={primaryProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              aria-label="Produto"
            >
              {productsQuery.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {(productsQuery.data?.items.length ?? 0) === 0 && (
                <option value="">Nenhum produto</option>
              )}
            </select>
            <label className="relative w-64">
              <input
                type="search"
                placeholder="Buscar por nome…"
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
        </header>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Telefones</th>
                <th className="px-4 py-2 text-left">Cidade / UF</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-secondary">
                    Carregando…
                  </td>
                </tr>
              )}
              {!listQuery.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-secondary">
                    Nenhum lead cadastrado ainda.
                  </td>
                </tr>
              )}
              {rows.map((lead) => (
                <tr key={lead.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-xs text-text-muted">
                      {lead.kind === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {lead.phones.map((p) => (
                      <div key={p} className="flex items-center gap-2 text-xs">
                        <PhoneCall className="h-3 w-3 text-brand-cyan" />
                        {formatPhone(p)}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">
                    {[lead.city, lead.state].filter(Boolean).join(' — ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ReleaseButton
                      leadId={lead.id}
                      productId={primaryProduct || null}
                      onFeedback={setFeedback}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReleaseButton({
  leadId,
  productId,
  onFeedback,
}: {
  leadId: string;
  productId: string | null;
  onFeedback: (f: { tone: 'success' | 'error' | 'warn'; text: string }) => void;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => leads.release(leadId, productId!),
    onSuccess: (data) => {
      onFeedback({
        tone: data.already_open ? 'warn' : 'success',
        text: data.already_open ? 'Já estava disponível' : 'Lead disponibilizado',
      });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => onFeedback({ tone: 'error', text: (err as Error).message }),
  });
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        className="btn-orange"
        disabled={!productId || mut.isPending}
        title={!productId ? 'Cadastre um produto em Configurações' : 'Disponibilizar'}
        onClick={() => mut.mutate()}
      >
        <Send className="h-4 w-4" /> Disponibilizar
      </button>
      <button type="button" className="btn-ghost" aria-label="Arquivar">
        <Archive className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-state-danger">{error}</p>}
    </div>
  );
}

function Feedback({ tone, text }: { tone: 'success' | 'error' | 'warn'; text: string }) {
  const cls =
    tone === 'success'
      ? 'border-state-success/30 bg-state-success/10 text-state-success'
      : tone === 'warn'
        ? 'border-state-warning/30 bg-state-warning/10 text-state-warning'
        : 'border-state-danger/30 bg-state-danger/10 text-state-danger';
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
      <CheckCircle2 className="h-4 w-4" /> {text}
    </div>
  );
}
