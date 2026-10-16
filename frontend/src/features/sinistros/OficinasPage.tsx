import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Search } from 'lucide-react';

import { PageBanner } from '@/components/VendedorUi';
import { claims, type ClaimWorkshop, type ClaimWorkshopInput } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useCanManageClaims } from './SinistrosModule';
import { WorkshopForm } from './WorkshopForm';
import { Message, Modal, errorMessage } from './ui';

export function OficinasPage() {
  const canManage = useCanManageClaims();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [insurerId, setInsurerId] = useState('');
  const [editing, setEditing] = useState<ClaimWorkshop | 'new' | null>(null);

  const catalogQuery = useQuery({ queryKey: ['claims', 'catalogs'], queryFn: claims.catalogs });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['claims', 'catalogs'] });
  const saveMutation = useMutation({
    mutationFn: (input: ClaimWorkshopInput) =>
      editing && editing !== 'new'
        ? claims.updateWorkshop(editing.id, input)
        : claims.createWorkshop(input),
    onSuccess: async () => {
      setEditing(null);
      await refresh();
    },
  });
  const archiveMutation = useMutation({ mutationFn: claims.archiveWorkshop, onSuccess: refresh });

  const insurers = catalogQuery.data?.insurers ?? [];
  const insurerNames = new Map(insurers.map((insurer) => [insurer.id, insurer.name]));
  const term = q.trim().toLowerCase();
  const workshops = (catalogQuery.data?.workshops ?? []).filter((workshop) => {
    if (insurerId && !workshop.insurer_ids.includes(insurerId)) return false;
    if (!term) return true;
    return [workshop.name, workshop.city ?? '', workshop.address].some((value) =>
      value.toLowerCase().includes(term),
    );
  });

  return (
    <div className="space-y-4">
      <PageBanner
        icon={Building2}
        title="Oficinas"
        description="Oficinas cadastradas e as seguradoras que as referenciam."
      >
        {canManage && (
          <button
            type="button"
            className="btn-orange inline-flex items-center gap-2 rounded-xl"
            onClick={() => {
              saveMutation.reset();
              setEditing('new');
            }}
            disabled={!catalogQuery.data}
          >
            <Plus className="h-4 w-4" /> Nova oficina
          </button>
        )}
      </PageBanner>

      <section className="grid gap-2 rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-3 md:grid-cols-[minmax(240px,1fr)_240px]">
        <label className="flex items-center gap-2 rounded-xl border border-[#18314d] bg-[#0b1d2d] px-3 py-2 text-sm text-[#9fb7cf]">
          <Search className="h-4 w-4" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por nome ou cidade"
            className="w-full bg-transparent outline-none placeholder:text-[#68819b]"
            aria-label="Buscar oficinas"
          />
        </label>
        <select
          value={insurerId}
          onChange={(event) => setInsurerId(event.target.value)}
          className="input"
          aria-label="Filtrar por seguradora referenciada"
        >
          <option value="">Todas as seguradoras</option>
          {insurers.map((insurer) => (
            <option key={insurer.id} value={insurer.id}>
              {insurer.name}
            </option>
          ))}
        </select>
      </section>

      {archiveMutation.error instanceof Error && (
        <Message kind="error">{archiveMutation.error.message}</Message>
      )}

      {catalogQuery.isLoading ? (
        <Message>Carregando oficinas…</Message>
      ) : catalogQuery.isError ? (
        <Message kind="error">Não foi possível carregar as oficinas.</Message>
      ) : workshops.length === 0 ? (
        <Message>
          {term || insurerId
            ? 'Nenhuma oficina corresponde aos filtros.'
            : 'Nenhuma oficina cadastrada.'}
        </Message>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {workshops.map((workshop) => (
            <article
              key={workshop.id}
              className="rounded-xl border border-[#18314d] bg-[#0b1d2d] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-white">{workshop.name}</h3>
                  <p className="mt-1 text-sm text-[#9fb7cf]">
                    {[workshop.city, workshop.address].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-sm text-[#9fb7cf]">
                    {workshop.phone ? formatPhone(workshop.phone) : 'Telefone não informado'} ·
                    Responsável: {workshop.responsible_name}
                  </p>
                  <p className="mt-1 text-xs text-[#6f89a5]">
                    Seguradoras:{' '}
                    {workshop.insurer_ids
                      .map((id) => insurerNames.get(id))
                      .filter(Boolean)
                      .join(', ') || 'Nenhuma'}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Editar ${workshop.name}`}
                      onClick={() => {
                        saveMutation.reset();
                        setEditing(workshop);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost rounded-lg text-red-200"
                      disabled={archiveMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Arquivar a oficina ${workshop.name}?`)) {
                          archiveMutation.mutate(workshop.id);
                        }
                      }}
                    >
                      Arquivar
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && catalogQuery.data && (
        <Modal
          title={editing === 'new' ? 'Nova oficina' : 'Editar oficina'}
          description="Vincule a oficina às seguradoras que a referenciam."
          titleId="workshop-form-title"
          onClose={() => setEditing(null)}
        >
          <WorkshopForm
            insurers={insurers}
            initial={editing === 'new' ? undefined : editing}
            saving={saveMutation.isPending}
            error={errorMessage(saveMutation.error)}
            submitLabel={editing === 'new' ? 'Cadastrar oficina' : 'Salvar oficina'}
            onSubmit={(input) => saveMutation.mutate(input)}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
