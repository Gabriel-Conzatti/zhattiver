import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Plus, Save } from 'lucide-react';

import { admin, type AdminCatalogItem, type AdminCatalogs } from '@/lib/api';

const NAMED_CATALOGS: Array<{
  kind: string;
  key: keyof Pick<
    AdminCatalogs,
    'products' | 'origins' | 'client_types' | 'insurers' | 'tag_categories'
  >;
  title: string;
}> = [
  { kind: 'products', key: 'products', title: 'Produtos' },
  { kind: 'origins', key: 'origins', title: 'Origens' },
  { kind: 'client-types', key: 'client_types', title: 'Tipos de cliente' },
  { kind: 'insurers', key: 'insurers', title: 'Seguradoras' },
  { kind: 'tag-categories', key: 'tag_categories', title: 'Categorias de tag' },
];

export function AdminCatalogsSection({
  catalogs,
  loading,
}: {
  catalogs: AdminCatalogs | undefined;
  loading: boolean;
}) {
  if (loading) {
    return <section className="card p-6 text-sm text-text-secondary">Carregando catálogos…</section>;
  }
  if (!catalogs) return null;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Catálogos gerais</h2>
        <p className="text-xs text-text-secondary">
          Itens em uso são arquivados, nunca excluídos. É possível restaurá-los mantendo o histórico.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {NAMED_CATALOGS.map((definition) => (
          <NamedCatalogCard
            key={definition.kind}
            kind={definition.kind}
            title={definition.title}
            items={catalogs[definition.key]}
          />
        ))}
        <TagsCard items={catalogs.tags} categories={catalogs.tag_categories} />
      </div>
    </section>
  );
}

function NamedCatalogCard({
  kind,
  title,
  items,
}: {
  kind: string;
  title: string;
  items: AdminCatalogItem[];
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => admin.createCatalogItem(kind, { name }),
    onSuccess: () => {
      setName('');
      setFeedback('Item criado.');
      invalidateCatalogs(qc);
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  return (
    <article className="card p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 flex gap-2">
        <input
          aria-label={`Novo item em ${title}`}
          className="input flex-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Novo item"
        />
        <button
          type="button"
          className="btn-primary"
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      {feedback && <p className="mt-2 text-xs text-text-secondary">{feedback}</p>}
      <div className="mt-4 space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-text-secondary">Nenhum item configurado.</p>
        )}
        {items.map((item) => (
          <CatalogRow key={item.id} kind={kind} item={item} />
        ))}
      </div>
    </article>
  );
}

function CatalogRow({
  kind,
  item,
  extraChanges,
  children,
}: {
  kind: string;
  item: AdminCatalogItem;
  extraChanges?: () => Record<string, string | null>;
  children?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(item.name);
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => setName(item.name), [item.name]);
  const update = useMutation({
    mutationFn: (changes: Record<string, unknown>) =>
      admin.updateCatalogItem(kind, item.id, changes),
    onSuccess: () => {
      setFeedback('Item atualizado.');
      invalidateCatalogs(qc);
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  return (
    <div className={`rounded-xl border border-border p-3 ${item.archived ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-44 flex-1">
          <span className="label">Nome</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {children}
        <button
          type="button"
          className="btn-ghost"
          disabled={!name.trim() || update.isPending}
          onClick={() => update.mutate({ name, ...extraChanges?.() })}
        >
          <Save className="h-4 w-4" /> Salvar
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={update.isPending}
          onClick={() => update.mutate({ archived: !item.archived })}
        >
          <ArchiveRestore className="h-4 w-4" />
          {item.archived ? 'Restaurar' : 'Arquivar'}
        </button>
      </div>
      {feedback && <p className="mt-2 text-xs text-text-secondary">{feedback}</p>}
    </div>
  );
}

function TagsCard({
  items,
  categories,
}: {
  items: AdminCatalogItem[];
  categories: AdminCatalogItem[];
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [color, setColor] = useState('#0079FF');
  const [feedback, setFeedback] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      admin.createCatalogItem('tags', {
        name,
        category_id: categoryId || null,
        color,
      }),
    onSuccess: () => {
      setName('');
      setFeedback('Tag criada.');
      invalidateCatalogs(qc);
    },
    onError: (error) => setFeedback((error as Error).message),
  });
  return (
    <article className="card p-4">
      <h3 className="font-semibold">Tags</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_80px_auto]">
        <input
          aria-label="Nome da nova tag"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nova tag"
        />
        <select
          aria-label="Categoria da nova tag"
          className="input"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Sem categoria</option>
          {categories.filter((item) => !item.archived).map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <input
          aria-label="Cor da nova tag"
          className="input h-10 p-1"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      {feedback && <p className="mt-2 text-xs text-text-secondary">{feedback}</p>}
      <div className="mt-4 space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-text-secondary">Nenhuma tag configurada.</p>
        )}
        {items.map((item) => (
          <TagRow key={item.id} item={item} categories={categories} />
        ))}
      </div>
    </article>
  );
}

function TagRow({
  item,
  categories,
}: {
  item: AdminCatalogItem;
  categories: AdminCatalogItem[];
}) {
  const [categoryId, setCategoryId] = useState(item.category_id ?? '');
  const [color, setColor] = useState(item.color ?? '#0079FF');
  useEffect(() => {
    setCategoryId(item.category_id ?? '');
    setColor(item.color ?? '#0079FF');
  }, [item.category_id, item.color]);
  return (
    <CatalogRow
      kind="tags"
      item={item}
      extraChanges={() => ({ category_id: categoryId || null, color })}
    >
      <label className="min-w-40">
        <span className="label">Categoria</span>
        <select
          className="input"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Sem categoria</option>
          {categories
            .filter((category) => !category.archived || category.id === categoryId)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}{category.archived ? ' (arquivada)' : ''}
              </option>
            ))}
        </select>
      </label>
      <label className="w-20">
        <span className="label">Cor</span>
        <input
          className="input h-10 p-1"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
      </label>
    </CatalogRow>
  );
}

function invalidateCatalogs(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'catalogs'] });
  void queryClient.invalidateQueries({ queryKey: ['catalog'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'funnels'] });
}
