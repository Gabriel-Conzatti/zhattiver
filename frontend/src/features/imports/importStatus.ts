import type { ImportBatchSummary } from '@/lib/api';

const LABELS: Record<ImportBatchSummary['status'], string> = {
  pending: 'Pendente',
  reviewing: 'Em revisão',
  confirmed: 'Confirmada',
  failed: 'Falhou',
  discarded: 'Descartada',
};

export function importStatusLabel(status: ImportBatchSummary['status']) {
  return LABELS[status];
}
