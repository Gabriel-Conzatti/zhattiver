import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { useAuth } from '@/app/AuthProvider';
import {
  claims,
  type ClaimCatalogs,
  type ClaimCreateInput,
  type ClaimPartyInput,
  type ClaimServiceType,
} from '@/lib/api';
import { WorkshopForm } from './WorkshopForm';
import {
  COVERAGE_OPTIONS,
  Field,
  Message,
  Modal,
  SERVICE_TYPE_OPTIONS,
  errorMessage,
  includesThirdParty,
} from './ui';

const OTHER_COVERAGE = '__outra__';

export function NewClaimForm({
  catalogs,
  users,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  catalogs: ClaimCatalogs;
  users: Array<{ id: string; name: string }>;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: ClaimCreateInput) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showWorkshop, setShowWorkshop] = useState(false);
  const [form, setForm] = useState({
    insured_name: '',
    insured_document: '',
    insured_phone: '',
    branch_id: catalogs.branches[0]?.id ?? '',
    vehicle_plate: '',
    vehicle_model: '',
    vehicle_year: '',
    property_address: '',
    coverage: '',
    coverage_other: '',
    insurer_id: catalogs.insurers[0]?.id ?? '',
    workshop_id: '',
    service_type: '' as ClaimServiceType | '',
    responsible_user_id: users.some((item) => item.id === user?.id) ? (user?.id ?? '') : '',
    with_third_party: false,
    third_name: '',
    third_document: '',
    third_phone: '',
    opened_on: new Date().toISOString().slice(0, 10),
    claim_number: '',
    notes: '',
  });
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const workshopMutation = useMutation({
    mutationFn: claims.createWorkshop,
    onSuccess: async (workshop) => {
      await queryClient.invalidateQueries({ queryKey: ['claims', 'catalogs'] });
      update('workshop_id', workshop.id);
      setShowWorkshop(false);
    },
  });

  const itemType = catalogs.branches.find((branch) => branch.id === form.branch_id)?.item_type;
  const workshops = catalogs.workshops.filter((workshop) =>
    workshop.insurer_ids.includes(form.insurer_id),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.service_type) return;
    const parties: ClaimPartyInput[] = [
      {
        role: 'segurado',
        name: form.insured_name.trim(),
        document: form.insured_document.trim(),
        phone: form.insured_phone.trim(),
      },
    ];
    if (form.with_third_party && form.third_name.trim()) {
      parties.push({
        role: 'terceiro',
        name: form.third_name.trim(),
        document: form.third_document.trim() || undefined,
        phone: form.third_phone.trim() || undefined,
      });
    }
    const item =
      itemType === 'vehicle'
        ? {
            vehicle_plate: form.vehicle_plate.trim(),
            vehicle_model: form.vehicle_model.trim(),
            vehicle_year: Number(form.vehicle_year),
          }
        : itemType === 'property'
          ? {
              property_address: form.property_address.trim(),
              coverage:
                form.coverage === OTHER_COVERAGE ? form.coverage_other.trim() : form.coverage,
            }
          : {};
    onSubmit({
      branch_id: form.branch_id,
      insurer_id: form.insurer_id,
      workshop_id: form.workshop_id || null,
      service_type: form.service_type,
      responsible_user_id: form.responsible_user_id,
      opened_on: form.opened_on,
      claim_number: form.claim_number.trim() || undefined,
      notes: form.notes.trim() || undefined,
      parties,
      ...item,
    });
  }

  return (
    <Modal
      title="Novo sinistro"
      description="Informe o essencial para abrir; o acompanhamento segue no histórico."
      titleId="new-claim-title"
      onClose={onClose}
    >
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && <Message kind="error">{error}</Message>}

        <Section title="Segurado">
          <Field
            label="Nome do segurado"
            value={form.insured_name}
            onChange={(value) => update('insured_name', value)}
            required
          />
          <Field
            label="CPF/CNPJ"
            value={form.insured_document}
            onChange={(value) => update('insured_document', value)}
            required
          />
          <Field
            label="Telefone do segurado"
            value={form.insured_phone}
            onChange={(value) => update('insured_phone', value)}
            placeholder="(51) 99999-9999"
            required
          />
        </Section>

        <Section title="Item segurado">
          <label className="text-sm text-[#b7cce0]">
            Ramo
            <select
              value={form.branch_id}
              onChange={(event) => update('branch_id', event.target.value)}
              className="input mt-1 w-full"
              required
              aria-label="Ramo"
            >
              {catalogs.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          {itemType === 'vehicle' && (
            <>
              <Field
                label="Placa"
                value={form.vehicle_plate}
                onChange={(value) => update('vehicle_plate', value)}
                required
              />
              <Field
                label="Modelo"
                value={form.vehicle_model}
                onChange={(value) => update('vehicle_model', value)}
                required
              />
              <Field
                label="Ano"
                type="number"
                value={form.vehicle_year}
                onChange={(value) => update('vehicle_year', value)}
                required
              />
            </>
          )}
          {itemType === 'property' && (
            <>
              <div className="sm:col-span-2">
                <Field
                  label="Endereço do imóvel"
                  value={form.property_address}
                  onChange={(value) => update('property_address', value)}
                  required
                />
              </div>
              <label className="text-sm text-[#b7cce0]">
                Cobertura acionada
                <select
                  value={form.coverage}
                  onChange={(event) => update('coverage', event.target.value)}
                  className="input mt-1 w-full"
                  required
                  aria-label="Cobertura acionada"
                >
                  <option value="">Selecione…</option>
                  {COVERAGE_OPTIONS.map((coverage) => (
                    <option key={coverage} value={coverage}>
                      {coverage}
                    </option>
                  ))}
                  <option value={OTHER_COVERAGE}>Outra</option>
                </select>
              </label>
              {form.coverage === OTHER_COVERAGE && (
                <Field
                  label="Qual cobertura?"
                  value={form.coverage_other}
                  onChange={(value) => update('coverage_other', value)}
                  required
                />
              )}
            </>
          )}
        </Section>

        <Section title="Atendimento">
          <label className="text-sm text-[#b7cce0]">
            Seguradora
            <select
              value={form.insurer_id}
              onChange={(event) => {
                const insurerId = event.target.value;
                setForm((current) => ({
                  ...current,
                  insurer_id: insurerId,
                  workshop_id: catalogs.workshops
                    .find((workshop) => workshop.id === current.workshop_id)
                    ?.insurer_ids.includes(insurerId)
                    ? current.workshop_id
                    : '',
                }));
              }}
              className="input mt-1 w-full"
              required
              aria-label="Seguradora"
            >
              {catalogs.insurers.map((insurer) => (
                <option key={insurer.id} value={insurer.id}>
                  {insurer.name}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm text-[#b7cce0]">
            <label htmlFor="new-claim-workshop">Oficina (opcional)</label>
            <div className="mt-1 flex gap-2">
              <select
                id="new-claim-workshop"
                value={form.workshop_id}
                onChange={(event) => update('workshop_id', event.target.value)}
                className="input w-full"
              >
                <option value="">Sem oficina definida</option>
                {workshops.map((workshop) => (
                  <option key={workshop.id} value={workshop.id}>
                    {workshop.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-button h-auto"
                aria-label="Cadastrar nova oficina"
                title="Cadastrar nova oficina"
                onClick={() => {
                  workshopMutation.reset();
                  setShowWorkshop(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <label className="text-sm text-[#b7cce0]">
            Tipo de atendimento
            <select
              value={form.service_type}
              onChange={(event) => {
                const value = event.target.value as ClaimServiceType | '';
                setForm((current) => ({
                  ...current,
                  service_type: value,
                  with_third_party: value ? includesThirdParty(value) : current.with_third_party,
                }));
              }}
              className="input mt-1 w-full"
              required
              aria-label="Tipo de atendimento"
            >
              <option value="">Selecione…</option>
              {SERVICE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#b7cce0]">
            Responsável
            <select
              value={form.responsible_user_id}
              onChange={(event) => update('responsible_user_id', event.target.value)}
              className="input mt-1 w-full"
              required
              aria-label="Responsável"
            >
              <option value="">Selecione…</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </Section>

        <div className="rounded-xl border border-[#18314d] p-3">
          <label className="flex items-center gap-2 text-sm text-[#b7cce0]">
            <input
              type="checkbox"
              checked={form.with_third_party}
              onChange={(event) => update('with_third_party', event.target.checked)}
            />
            Cadastrar terceiro vinculado ao sinistro
          </label>
          {form.with_third_party && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field
                label="Nome do terceiro"
                value={form.third_name}
                onChange={(value) => update('third_name', value)}
                required
              />
              <Field
                label="CPF/CNPJ do terceiro"
                value={form.third_document}
                onChange={(value) => update('third_document', value)}
              />
              <Field
                label="Telefone do terceiro"
                value={form.third_phone}
                onChange={(value) => update('third_phone', value)}
              />
            </div>
          )}
        </div>

        <Section title="Complementos">
          <Field
            label="Data de abertura"
            type="date"
            value={form.opened_on}
            onChange={(value) => update('opened_on', value)}
            required
          />
          <Field
            label="Número do sinistro"
            value={form.claim_number}
            onChange={(value) => update('claim_number', value)}
          />
          <label className="text-sm text-[#b7cce0] sm:col-span-2">
            Observações
            <textarea
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              className="input mt-1 min-h-20 w-full"
            />
          </label>
        </Section>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost rounded-xl" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-orange rounded-xl" disabled={loading}>
            {loading ? 'Salvando…' : 'Cadastrar sinistro'}
          </button>
        </div>
      </form>

      {showWorkshop && (
        <Modal
          title="Nova oficina"
          description="A oficina já fica selecionada neste sinistro."
          titleId="new-claim-workshop-title"
          onClose={() => setShowWorkshop(false)}
        >
          <WorkshopForm
            insurers={catalogs.insurers}
            initialInsurerIds={form.insurer_id ? [form.insurer_id] : []}
            saving={workshopMutation.isPending}
            error={errorMessage(workshopMutation.error)}
            submitLabel="Cadastrar oficina"
            onSubmit={(input) => workshopMutation.mutate(input)}
            onCancel={() => setShowWorkshop(false)}
          />
        </Modal>
      )}
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7aa2c8]">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
