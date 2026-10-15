import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { catalog, opportunities } from '@/lib/api';
import { ApiRequestError } from '@/lib/http';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function NewLeadDialog({ onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ['products'], queryFn: catalog.products });
  const [form, setForm] = useState({
    name: '',
    phone: '',
    product_id: '',
    city: '',
    state: '',
  });
  const productId = form.product_id || products.data?.items[0]?.id || '';
  const mutation = useMutation({
    mutationFn: () =>
      opportunities.createDirectLead({
        name: form.name.trim(),
        phone: form.phone.trim(),
        product_id: productId,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      onSuccess();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !productId) return;
    mutation.mutate();
  }

  const unavailable = products.isSuccess && products.data.items.length === 0;
  const error = mutation.error;

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="new-lead-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="card-strong w-full max-w-lg p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="new-lead-title" className="text-lg font-semibold">
              Novo lead
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              O lead será criado diretamente na primeira etapa do seu funil.
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </header>

        {products.isLoading ? (
          <p className="text-sm text-text-secondary">Carregando produtos…</p>
        ) : products.isError ? (
          <div className="rounded-lg border border-state-danger/30 bg-state-danger/10 p-3 text-sm text-state-danger">
            Não foi possível carregar seus produtos.
          </div>
        ) : unavailable ? (
          <div className="rounded-lg border border-state-warning/30 bg-state-warning/10 p-3 text-sm text-state-warning">
            Nenhum produto está associado ao seu usuário.
          </div>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <Field label="Nome">
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                autoComplete="off"
                required
              />
            </Field>
            <Field label="Telefone">
              <input
                className="input"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="(51) 99999-9999"
                autoComplete="tel"
                required
              />
            </Field>
            <Field label="Produto">
              <select
                className="input"
                value={productId}
                onChange={(event) => setForm({ ...form, product_id: event.target.value })}
                required
              >
                {products.data?.items.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-[1fr_88px] gap-3">
              <Field label="Cidade">
                <input
                  className="input"
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                />
              </Field>
              <Field label="UF">
                <input
                  className="input uppercase"
                  value={form.state}
                  onChange={(event) => setForm({ ...form, state: event.target.value })}
                  maxLength={2}
                />
              </Field>
            </div>

            {error && (
              <div className="rounded-lg border border-state-danger/30 bg-state-danger/10 p-3 text-sm text-state-danger">
                {error instanceof ApiRequestError ? error.message : 'Não foi possível criar o lead.'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={mutation.isPending || !form.name.trim() || !form.phone.trim() || !productId}
              >
                {mutation.isPending ? 'Criando…' : 'Criar no funil'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
