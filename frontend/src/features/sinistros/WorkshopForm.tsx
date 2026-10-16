import { useState, type FormEvent } from 'react';

import type { CatalogItem, ClaimWorkshop, ClaimWorkshopInput } from '@/lib/api';
import { Field, Message } from './ui';

export function WorkshopForm({
  insurers,
  initial,
  initialInsurerIds = [],
  saving,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  insurers: CatalogItem[];
  initial?: ClaimWorkshop;
  initialInsurerIds?: string[];
  saving: boolean;
  error?: string;
  submitLabel: string;
  onSubmit: (input: ClaimWorkshopInput) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
    city: initial?.city ?? '',
    responsible_name: initial?.responsible_name ?? '',
    insurer_ids: initial?.insurer_ids ?? initialInsurerIds,
  });
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim(),
      city: form.city.trim() || null,
      responsible_name: form.responsible_name.trim(),
      insurer_ids: form.insurer_ids,
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      {error && <Message kind="error">{error}</Message>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Nome da oficina"
          value={form.name}
          onChange={(value) => update('name', value)}
          required
        />
        <Field
          label="Responsável"
          value={form.responsible_name}
          onChange={(value) => update('responsible_name', value)}
          required
        />
        <Field label="Telefone" value={form.phone} onChange={(value) => update('phone', value)} />
        <Field label="Cidade" value={form.city} onChange={(value) => update('city', value)} />
        <div className="sm:col-span-2">
          <Field
            label="Endereço"
            value={form.address}
            onChange={(value) => update('address', value)}
            required
          />
        </div>
      </div>
      <fieldset>
        <legend className="text-sm text-[#b7cce0]">Seguradoras referenciadas</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {insurers.map((insurer) => {
            const selected = form.insurer_ids.includes(insurer.id);
            return (
              <label
                key={insurer.id}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                  selected
                    ? 'border-[#00CBFF] bg-[#00CBFF]/10 text-white'
                    : 'border-[#18314d] text-[#9fb7cf]'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selected}
                  onChange={() =>
                    update(
                      'insurer_ids',
                      selected
                        ? form.insurer_ids.filter((id) => id !== insurer.id)
                        : [...form.insurer_ids, insurer.id],
                    )
                  }
                />
                {insurer.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-ghost rounded-xl" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="btn-orange rounded-xl"
          disabled={
            saving ||
            !form.name.trim() ||
            !form.address.trim() ||
            !form.responsible_name.trim() ||
            form.insurer_ids.length === 0
          }
        >
          {saving ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
