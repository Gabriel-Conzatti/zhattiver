import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Sparkles } from 'lucide-react';

import { admin, catalog } from '@/lib/api';

export function AdminCrossSellPage() {
  const qc = useQueryClient();
  const lists = useQuery({ queryKey: ['cross-sell', 'lists'], queryFn: admin.crossSell.list });
  const products = useQuery({ queryKey: ['products'], queryFn: catalog.products });
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    target_product_id: '',
    has_product_ids: [] as string[],
    lacks_product_ids: [] as string[],
    include_unknown: false,
  });

  const detail = useQuery({
    queryKey: ['cross-sell', 'list', selected],
    queryFn: () => admin.crossSell.get(selected!),
    enabled: !!selected,
  });

  const createList = useMutation({
    mutationFn: () =>
      admin.crossSell.create({
        name: form.name,
        target_product_id: form.target_product_id,
        has_product_ids: form.has_product_ids,
        lacks_product_ids: form.lacks_product_ids,
        include_unknown: form.include_unknown,
      }),
    onSuccess: (data) => {
      setFeedback(`Lista gerada com ${data.total_items} candidatos.`);
      setSelected(data.id);
      qc.invalidateQueries({ queryKey: ['cross-sell'] });
      setForm({ ...form, name: '' });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const releaseAll = useMutation({
    mutationFn: () => admin.crossSell.release(selected!),
    onSuccess: (data) => {
      setFeedback(`${data.released} clientes disponibilizados.`);
      qc.invalidateQueries({ queryKey: ['cross-sell'] });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  const releaseSelected = useMutation({
    mutationFn: (ids: string[]) => admin.crossSell.release(selected!, ids),
    onSuccess: (data) => {
      setFeedback(`${data.released} clientes disponibilizados.`);
      qc.invalidateQueries({ queryKey: ['cross-sell'] });
    },
  });

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const item of detail.data?.items ?? []) {
      if (item.item_state === 'pending') next[item.id] = value;
    }
    setChecked(next);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-brand-cyan" /> Gerar pré-lista
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Filtros por produtos que o cliente possui (has) ou não (lacks). SDR não participa da
          operação de cross-sell (RN-060..063).
        </p>
        <div className="mt-3 space-y-3">
          <input
            className="input"
            placeholder="Nome da lista"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="input"
            value={form.target_product_id}
            onChange={(e) => setForm({ ...form, target_product_id: e.target.value })}
          >
            <option value="">Produto alvo…</option>
            {products.data?.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div>
            <div className="mb-1 text-xs text-text-secondary">Cliente possui (has)</div>
            <ProductPicker
              products={products.data?.items ?? []}
              selected={form.has_product_ids}
              onChange={(v) => setForm({ ...form, has_product_ids: v })}
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-text-secondary">Cliente NÃO possui (lacks)</div>
            <ProductPicker
              products={products.data?.items ?? []}
              selected={form.lacks_product_ids}
              onChange={(v) => setForm({ ...form, lacks_product_ids: v })}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={form.include_unknown}
              onChange={(e) => setForm({ ...form, include_unknown: e.target.checked })}
            />
            Incluir clientes com situação desconhecida
          </label>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => createList.mutate()}
            disabled={!form.name || !form.target_product_id || createList.isPending}
          >
            {createList.isPending ? 'Gerando…' : 'Gerar pré-lista'}
          </button>
          {feedback && (
            <p className="rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-3 py-2 text-xs">
              {feedback}
            </p>
          )}
        </div>

        <h3 className="mt-6 text-sm font-semibold">Listas geradas</h3>
        <ul className="mt-2 space-y-1">
          {(lists.data?.items ?? []).map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setSelected(l.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selected === l.id ? 'border-brand-cyan bg-brand-blue/10' : 'border-border hover:bg-surface-2'
                }`}
              >
                <div className="font-medium">{l.name}</div>
                <div className="mt-1 text-xs text-text-muted">
                  {l.released_items}/{l.total_items} liberados · {l.state}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-hidden">
        {!selected && (
          <p className="p-6 text-sm text-text-secondary">
            Selecione uma lista à esquerda para revisar os candidatos.
          </p>
        )}
        {selected && detail.data && (
          <>
            <header className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h2 className="text-base font-semibold">{detail.data.name}</h2>
                <p className="text-xs text-text-secondary">
                  {detail.data.released_items} de {detail.data.total_items} liberados · estado{' '}
                  {detail.data.state}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => toggleAll(true)}>
                  Selecionar todos
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    releaseSelected.mutate(
                      Object.entries(checked)
                        .filter(([, v]) => v)
                        .map(([k]) => k),
                    )
                  }
                  disabled={releaseSelected.isPending || !Object.values(checked).some(Boolean)}
                >
                  <Send className="h-3.5 w-3.5" /> Liberar selecionados
                </button>
                <button
                  type="button"
                  className="btn-orange"
                  onClick={() => releaseAll.mutate()}
                  disabled={releaseAll.isPending}
                >
                  Liberar todos
                </button>
              </div>
            </header>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Sel</th>
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">Cidade</th>
                    <th className="px-4 py-2 text-left">Último contato</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.items.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          disabled={i.item_state !== 'pending'}
                          checked={!!checked[i.id]}
                          onChange={(e) =>
                            setChecked((prev) => ({ ...prev, [i.id]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-4 py-2">{i.lead_name}</td>
                      <td className="px-4 py-2 text-text-secondary">
                        {[i.city, i.state].filter(Boolean).join(' — ') || '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-text-muted">
                        {i.last_contact_at
                          ? new Date(i.last_contact_at).toLocaleDateString('pt-BR')
                          : 'Sem registro'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`badge ${
                            i.item_state === 'released'
                              ? 'bg-state-success/20 text-state-success'
                              : 'bg-surface-2 text-text-secondary'
                          }`}
                        >
                          {i.item_state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ProductPicker({
  products,
  selected,
  onChange,
}: {
  products: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {products.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            className={`nav-pill-item ${on ? 'bg-brand-cyan/20 text-brand-cyan' : ''}`}
            onClick={() =>
              onChange(on ? selected.filter((x) => x !== p.id) : [...selected, p.id])
            }
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
