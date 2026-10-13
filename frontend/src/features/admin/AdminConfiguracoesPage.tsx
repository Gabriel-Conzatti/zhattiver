import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Settings2 } from 'lucide-react';

import {
  admin,
  catalog,
  type ConfigurableName,
  type FunnelConfig,
  type FunnelStageConfig,
} from '@/lib/api';

export function AdminConfiguracoesPage() {
  const funnels = useQuery({ queryKey: ['admin', 'funnels'], queryFn: admin.funnels });
  const products = useQuery({ queryKey: ['catalog', 'products'], queryFn: catalog.products });
  const lossReasons = useQuery({
    queryKey: ['admin', 'loss-reasons'],
    queryFn: admin.lossReasons,
  });
  const nextActionTypes = useQuery({
    queryKey: ['admin', 'next-action-types'],
    queryFn: admin.nextActionTypes,
  });
  const failed = [funnels, products, lossReasons, nextActionTypes].find((query) => query.isError);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Settings2 className="h-6 w-6 text-brand-cyan" /> Configurações
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure funis, etapas, mensagens e catálogos comerciais da organização.
        </p>
      </header>

      {failed ? (
        <section className="card p-6 text-sm text-state-danger">
          Configurações indisponíveis. {(failed.error as Error).message}
        </section>
      ) : (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Funis e mensagens</h2>
              <p className="text-xs text-text-secondary">
                A etapa inicial define a mensagem usada no primeiro contato. Variáveis aceitas:
                {' {nome_cliente}, {nome_vendedor} e {nome_indicador}.'}
              </p>
            </div>
            <NewFunnelForm products={products.data?.items ?? []} />
            {funnels.isLoading ? (
              <div className="card p-6 text-sm text-text-secondary">Carregando funis…</div>
            ) : funnels.data?.items.length === 0 ? (
              <div className="card p-6 text-sm text-text-secondary">
                Nenhum funil configurado. Crie o primeiro acima.
              </div>
            ) : (
              funnels.data?.items.map((funnel) => (
                <FunnelEditor
                  key={funnel.id}
                  funnel={funnel}
                  productName={
                    products.data?.items.find((product) => product.id === funnel.product_id)?.name ??
                    'Produto indisponível'
                  }
                />
              ))
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ConfigurableList
              title="Motivos de perda"
              description="Motivo selecionável ao encerrar uma oportunidade como perdida."
              items={lossReasons.data?.items ?? []}
              loading={lossReasons.isLoading}
              queryKey={['admin', 'loss-reasons']}
              create={admin.createLossReason}
              update={admin.updateLossReason}
            />
            <ConfigurableList
              title="Tipos de próxima ação"
              description="Opções disponíveis para planejar o próximo contato."
              items={nextActionTypes.data?.items ?? []}
              loading={nextActionTypes.isLoading}
              queryKey={['admin', 'next-action-types']}
              create={admin.createNextActionType}
              update={admin.updateNextActionType}
            />
          </section>
        </>
      )}
    </div>
  );
}

function NewFunnelForm({
  products,
}: {
  products: Array<{ id: string; name: string }>;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [productId, setProductId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => admin.createFunnel({ name, product_id: productId, is_default: false }),
    onSuccess: () => {
      setName('');
      setFeedback('Funil criado.');
      void qc.invalidateQueries({ queryKey: ['admin', 'funnels'] });
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <label className="min-w-56 flex-1">
        <span className="label">Nome do novo funil</span>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="min-w-48">
        <span className="label">Produto</span>
        <select
          className="input"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">Selecione…</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.name}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn-primary"
        disabled={!name.trim() || !productId || create.isPending}
        onClick={() => create.mutate()}
      >
        <Plus className="h-4 w-4" /> {create.isPending ? 'Criando…' : 'Criar funil'}
      </button>
      {feedback && <p className="w-full text-xs text-text-secondary">{feedback}</p>}
    </div>
  );
}

function FunnelEditor({ funnel, productName }: { funnel: FunnelConfig; productName: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState(funnel.name);
  const [newStage, setNewStage] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => admin.updateFunnel(funnel.id, { name }),
    onSuccess: () => {
      setFeedback('Funil atualizado.');
      void qc.invalidateQueries({ queryKey: ['admin', 'funnels'] });
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  const setDefault = useMutation({
    mutationFn: () => admin.updateFunnel(funnel.id, { is_default: !funnel.is_default }),
    onSuccess: () => {
      setFeedback('Funil padrão atualizado.');
      void qc.invalidateQueries({ queryKey: ['admin', 'funnels'] });
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  const addStage = useMutation({
    mutationFn: () =>
      admin.createFunnelStage(funnel.id, {
        name: newStage,
        order_index: funnel.stages.length,
        is_initial: funnel.stages.length === 0,
        is_final: false,
      }),
    onSuccess: () => {
      setNewStage('');
      setFeedback('Etapa criada.');
      void qc.invalidateQueries({ queryKey: ['admin', 'funnels'] });
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-end gap-3 border-b border-border p-4">
        <label className="min-w-56 flex-1">
          <span className="label">{productName}</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={funnel.is_default}
            disabled={setDefault.isPending}
            onChange={() => setDefault.mutate()}
          />
          Funil padrão
        </label>
        <button type="button" className="btn-ghost" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" /> Salvar nome
        </button>
      </header>
      <div className="space-y-3 p-4">
        {feedback && <p className="text-xs text-text-secondary">{feedback}</p>}
        {funnel.stages.length === 0 && (
          <p className="text-sm text-state-warning">
            Funil indisponível para operação até possuir pelo menos uma etapa inicial.
          </p>
        )}
        {funnel.stages.map((stage) => (
          <StageEditor key={stage.id} stage={stage} />
        ))}
        <div className="flex gap-2 border-t border-border pt-3">
          <input
            className="input flex-1"
            placeholder="Nome da nova etapa"
            value={newStage}
            onChange={(event) => setNewStage(event.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!newStage.trim() || addStage.isPending}
            onClick={() => addStage.mutate()}
          >
            <Plus className="h-4 w-4" /> Adicionar etapa
          </button>
        </div>
      </div>
    </article>
  );
}

function StageEditor({ stage }: { stage: FunnelStageConfig }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(stage);
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => setDraft(stage), [stage]);
  const save = useMutation({
    mutationFn: () =>
      admin.updateFunnelStage(stage.id, {
        name: draft.name,
        order_index: draft.order_index,
        is_initial: draft.is_initial,
        is_final: draft.is_final,
        message_template: draft.message_template,
      }),
    onSuccess: () => {
      setFeedback('Etapa atualizada.');
      void qc.invalidateQueries({ queryKey: ['admin', 'funnels'] });
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-surface-2/40 p-3 xl:grid-cols-[90px_1fr_2fr_auto]">
      <label>
        <span className="label">Ordem</span>
        <input
          type="number"
          min={0}
          className="input"
          value={draft.order_index}
          onChange={(event) => setDraft({ ...draft, order_index: Number(event.target.value) })}
        />
      </label>
      <label>
        <span className="label">Etapa</span>
        <input
          className="input"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <span className="mt-2 flex gap-4 text-xs text-text-secondary">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={draft.is_initial}
              onChange={(event) => setDraft({ ...draft, is_initial: event.target.checked })}
            /> Inicial
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={draft.is_final}
              onChange={(event) => setDraft({ ...draft, is_final: event.target.checked })}
            /> Final
          </label>
        </span>
      </label>
      <label>
        <span className="label">Mensagem da etapa</span>
        <textarea
          className="input min-h-20"
          value={draft.message_template ?? ''}
          onChange={(event) => setDraft({ ...draft, message_template: event.target.value })}
          placeholder="Mensagem opcional com {nome_cliente}"
        />
      </label>
      <button
        type="button"
        className="btn-ghost self-end"
        disabled={!draft.name.trim() || save.isPending}
        onClick={() => save.mutate()}
      >
        <Save className="h-4 w-4" /> Salvar
      </button>
      {feedback && <p className="text-xs text-text-secondary xl:col-span-4">{feedback}</p>}
    </div>
  );
}

function ConfigurableList({
  title,
  description,
  items,
  loading,
  queryKey,
  create,
  update,
}: {
  title: string;
  description: string;
  items: ConfigurableName[];
  loading: boolean;
  queryKey: string[];
  create: (name: string) => Promise<ConfigurableName>;
  update: (
    id: string,
    changes: Partial<Pick<ConfigurableName, 'name' | 'is_active'>>,
  ) => Promise<ConfigurableName>;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const createItem = useMutation({
    mutationFn: () => create(name),
    onSuccess: () => {
      setName('');
      setFeedback('Configuração criada.');
      void qc.invalidateQueries({ queryKey });
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  const toggleItem = useMutation({
    mutationFn: (item: ConfigurableName) =>
      update(item.id, { is_active: !item.is_active }),
    onSuccess: () => {
      setFeedback('Configuração atualizada.');
      void qc.invalidateQueries({ queryKey });
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  return (
    <article className="card p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-xs text-text-secondary">{description}</p>
      <div className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          value={name}
          placeholder="Nova opção"
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={!name.trim() || createItem.isPending}
          onClick={() => createItem.mutate()}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      {feedback && <p className="mt-2 text-xs text-text-secondary">{feedback}</p>}
      <div className="mt-4 space-y-2">
        {loading && <p className="text-sm text-text-secondary">Carregando…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-text-secondary">Nenhuma opção configurada.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <span className={item.is_active ? '' : 'text-text-muted line-through'}>{item.name}</span>
            <button
              type="button"
              className="btn-ghost"
              disabled={toggleItem.isPending}
              onClick={() => toggleItem.mutate(item)}
            >
              {item.is_active ? 'Desativar' : 'Reativar'}
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}
