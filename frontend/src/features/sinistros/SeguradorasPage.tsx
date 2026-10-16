import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, Info as InfoIcon, Lightbulb, Phone, Search } from 'lucide-react';

import { PageBanner } from '@/components/VendedorUi';
import { claims, type ClaimInsurerProfile } from '@/lib/api';
import { useCanManageClaims } from './SinistrosModule';
import { Message, Panel, formatDateTime } from './ui';

const SECTIONS = [
  { key: 'contacts', label: 'Números de contato', icon: Phone },
  { key: 'rental_car_contact', label: 'Contato para carro reserva', icon: Car },
  { key: 'notes', label: 'Observações, manhas e atalhos', icon: Lightbulb },
] as const;

type ProfileFields = Pick<ClaimInsurerProfile, (typeof SECTIONS)[number]['key']>;

export function SeguradorasPage() {
  const canManage = useCanManageClaims();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['claims', 'insurers'], queryFn: claims.insurerProfiles });

  const items = query.data?.items ?? [];
  const term = q.trim().toLowerCase();
  const filtered = items.filter((item) => item.name.toLowerCase().includes(term));
  const selected = items.find((item) => item.insurer_id === selectedId) ?? filtered[0];

  return (
    <div className="space-y-4">
      <PageBanner
        icon={InfoIcon}
        title="Infos das seguradoras"
        description="Contatos, carro reserva, manhas e atalhos de cada seguradora."
      />
      {query.isLoading ? (
        <Message>Carregando seguradoras…</Message>
      ) : query.isError ? (
        <Message kind="error">Não foi possível carregar as seguradoras.</Message>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <section className="rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-3">
            <label className="flex items-center gap-2 rounded-xl border border-[#18314d] bg-[#0b1d2d] px-3 py-2 text-sm text-[#9fb7cf]">
              <Search className="h-4 w-4" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar seguradora"
                className="w-full bg-transparent outline-none placeholder:text-[#68819b]"
                aria-label="Buscar seguradora"
              />
            </label>
            <ul className="mt-2 space-y-1" aria-label="Seguradoras">
              {filtered.map((item) => (
                <li key={item.insurer_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.insurer_id)}
                    aria-current={selected?.insurer_id === item.insurer_id ? 'true' : undefined}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selected?.insurer_id === item.insurer_id
                        ? 'bg-[#0d2940] text-white'
                        : 'text-[#9fb7cf] hover:bg-[#0b1d2d]'
                    }`}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-[#6f89a5]">Nenhuma seguradora.</li>
              )}
            </ul>
          </section>
          {selected ? (
            <InsurerProfile key={selected.insurer_id} profile={selected} canManage={canManage} />
          ) : (
            <Message>Selecione uma seguradora.</Message>
          )}
        </div>
      )}
    </div>
  );
}

function InsurerProfile({
  profile,
  canManage,
}: {
  profile: ClaimInsurerProfile;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileFields>({
    contacts: profile.contacts,
    rental_car_contact: profile.rental_car_contact,
    notes: profile.notes,
  });
  const mutation = useMutation({
    mutationFn: () => claims.saveInsurerProfile(profile.insurer_id, form),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['claims', 'insurers'] });
    },
  });

  return (
    <section className="space-y-3 rounded-[20px] border border-[#1a2d40] bg-[#081d30] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">{profile.name}</h2>
          {profile.updated_at && (
            <p className="text-xs text-[#6f89a5]">
              Atualizado em {formatDateTime(profile.updated_at)}
            </p>
          )}
        </div>
        {canManage && !editing && (
          <button type="button" className="btn-ghost rounded-xl" onClick={() => setEditing(true)}>
            Editar informações
          </button>
        )}
      </div>
      {mutation.error instanceof Error && (
        <Message kind="error">{mutation.error.message}</Message>
      )}
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {SECTIONS.map((section) => (
            <label key={section.key} className="block text-sm text-[#b7cce0]">
              {section.label}
              <textarea
                className="input mt-1 min-h-24 w-full"
                value={form[section.key] ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, [section.key]: event.target.value }))
                }
              />
            </label>
          ))}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost rounded-xl" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-orange rounded-xl" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      ) : (
        SECTIONS.map((section) => (
          <Panel key={section.key} title={section.label} icon={section.icon}>
            <p className="whitespace-pre-wrap text-sm text-[#b7cce0]">
              {profile[section.key] || 'Nada registrado ainda.'}
            </p>
          </Panel>
        ))
      )}
    </section>
  );
}
