import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  Send,
  Zap,
} from 'lucide-react';

import { DashboardPanelMessage } from '@/components/DashboardUi';
import {
  Badge,
  DayCount,
  GoalStrip,
  PanelCard,
  StatTile,
  formatDateBr,
} from '@/components/VendedorUi';
import { catalog, opportunities, schedules, type Schedule } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { CopyMessageDialog } from './CopyMessageDialog';

const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const WEEKDAY_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

const selectClass =
  'rounded-lg border border-[#16314d] bg-[#0a2035] px-3 py-2 text-sm text-[#dcecff] outline-none transition focus:border-[#00CBFF]';

export function AgendamentosPage() {
  const qc = useQueryClient();
  const [contactTarget, setContactTarget] = useState<Schedule | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Schedule | null>(null);
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const query = useQuery({
    queryKey: ['schedules', 'mine'],
    queryFn: () => schedules.list({ scope: 'mine', filter: 'active' }),
  });
  const goalsQuery = useQuery({ queryKey: ['me', 'goals'], queryFn: opportunities.myGoals });
  const originsQuery = useQuery({ queryKey: ['catalog', 'origins'], queryFn: catalog.origins });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const originNames = new Map((originsQuery.data?.items ?? []).map((item) => [item.id, item.name]));
  const goals = goalsQuery.data;

  const inWindow = items.filter((item) => item.view.in_window);
  const overdue = items.filter((item) => item.view.past_contact_limit);
  const next30 = items.filter(
    (item) => !item.view.past_contact_limit && daysUntil(item.coverage_end_date) <= 30,
  );
  const unconfirmed = items.filter((item) => !item.date_confirmed);

  const availableOrigins = useMemo(
    () => Array.from(new Set(items.map((item) => item.origin_id).filter(Boolean) as string[])),
    [items],
  );

  const searched = items.filter((item) => {
    const term = search.trim().toLowerCase();
    if (term) {
      const name = (item.lead_name ?? '').toLowerCase();
      const phone = item.lead_phone ?? '';
      if (!name.includes(term) && !phone.includes(term)) return false;
    }
    if (origin && item.origin_id !== origin) return false;
    return true;
  });

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of searched) {
      const key = item.coverage_end_date.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [searched]);

  const visible = selectedDay
    ? searched.filter((item) => item.coverage_end_date.slice(0, 10) === selectedDay)
    : searched;

  const groups = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const item of [...visible].sort((a, b) =>
      a.coverage_end_date.localeCompare(b.coverage_end_date),
    )) {
      const key = item.coverage_end_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [visible]);

  const hasFilters = Boolean(search || origin || selectedDay);

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-[#16314d] bg-[#081d30] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">Agendamentos</h1>
            <p className="text-sm leading-5 text-[#8faac4]">
              A janela ideal começa de 5 a 7 dias úteis antes da vigência. Fora do limite de
              abordagem, use a ação “Resolver”.
            </p>
          </div>
          {goalsQuery.isSuccess && (
            <GoalStrip
              label="Meta do dia"
              done={goals?.schedules.done ?? 0}
              target={goals?.schedules.target ?? 0}
            />
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile label="Agendamentos ativos" value={items.length} icon={CalendarCheck} tone="blue" />
          <StatTile label="Em evidência (5 a 7 dias)" value={inWindow.length} icon={Zap} tone="orange" />
          <StatTile label="Próximos 30 dias" value={next30.length} icon={Clock} tone="cyan" />
          <StatTile label="Agendamentos atrasados" value={overdue.length} icon={AlarmClock} tone="red" />
          <StatTile label="Data a confirmar" value={unconfirmed.length} icon={HelpCircle} tone="amber" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-[20px] border border-[#16314d] bg-[#081d30] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou telefone"
                aria-label="Buscar agendamento"
                className="min-w-[180px] flex-1 rounded-lg border border-[#16314d] bg-[#0a2035] px-3 py-2 text-sm text-[#dcecff] outline-none transition placeholder:text-[#6f8aa6] focus:border-[#00CBFF]"
              />
              <select
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                aria-label="Filtrar por origem"
                className={selectClass}
              >
                <option value="">Origem</option>
                {availableOrigins.map((id) => (
                  <option key={id} value={id}>
                    {originNames.get(id) ?? 'Origem'}
                  </option>
                ))}
              </select>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setOrigin('');
                    setSelectedDay(null);
                  }}
                  className="text-xs font-semibold text-[#7dd3fc] transition hover:text-white"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </section>

          {query.isLoading ? (
            <DashboardPanelMessage kind="loading">Carregando agendamentos…</DashboardPanelMessage>
          ) : query.isError ? (
            <DashboardPanelMessage kind="error" onRetry={() => void query.refetch()}>
              Não foi possível carregar os agendamentos.
            </DashboardPanelMessage>
          ) : groups.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-[#18314d] bg-[#0b1d2d] p-6 text-sm text-[#9bb2c9]">
              {hasFilters
                ? 'Nenhum agendamento corresponde aos filtros aplicados.'
                : 'Nenhum agendamento ativo no momento.'}
            </p>
          ) : (
            groups.map(([day, dayItems]) => (
              <section key={day} className="rounded-[20px] border border-[#16314d] bg-[#081d30] p-3">
                <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7aa2c8]">
                  {longDayLabel(day)}
                </h2>
                <div className="space-y-2">
                  {dayItems.map((schedule) => {
                    const tone = schedule.view.past_contact_limit
                      ? 'red'
                      : schedule.view.in_window
                        ? 'orange'
                        : 'cyan';
                    return (
                      <article
                        key={schedule.id}
                        className="flex flex-wrap items-center gap-3 overflow-hidden rounded-[16px] border border-[#132c45] bg-[#0a2035] p-3"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-10 w-1 shrink-0 rounded-full ${
                            tone === 'red' ? 'bg-[#ef4444]' : tone === 'orange' ? 'bg-[#f97316]' : 'bg-[#00CBFF]'
                          }`}
                        />
                        <DayCount days={schedule.view.business_days_remaining} tone={tone} />
                        <div className="min-w-[140px] flex-1">
                          <div className="truncate font-medium text-white">
                            {schedule.lead_name ?? 'Lead sem nome'}
                          </div>
                          <div className="text-[11px] text-[#7aa2c8]">
                            {schedule.lead_phone ? formatPhone(schedule.lead_phone) : 'Sem telefone'}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>
                            {(schedule.origin_id && originNames.get(schedule.origin_id)) || 'Agendamento'}
                          </Badge>
                          {!schedule.date_confirmed && <Badge tone="amber">Data a confirmar</Badge>}
                        </div>
                        <div className="text-sm text-[#b7d1eb]">
                          {formatDateBr(schedule.coverage_end_date)}
                          <div className="text-[11px] text-[#7aa2c8]">{schedule.view.label}</div>
                        </div>
                        <div className="ml-auto">
                          {schedule.view.past_contact_limit ? (
                            <button
                              type="button"
                              className="rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#fb923c]"
                              onClick={() => setResolveTarget(schedule)}
                            >
                              Resolver
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f7fda] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#168ee8]"
                              onClick={() => setContactTarget(schedule)}
                            >
                              <Send className="h-3.5 w-3.5" aria-hidden="true" /> Contatar
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="min-w-0">
          <PanelCard
            title={`${MONTH_NAMES[cursor.month]} ${cursor.year}`}
            icon={CalendarClock}
            action={
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => setCursor(shiftMonth(cursor, -1))}
                  className="rounded-md border border-[#16314d] p-1.5 text-[#7dd3fc] transition hover:border-[#00CBFF] hover:text-white"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => setCursor(shiftMonth(cursor, 1))}
                  className="rounded-md border border-[#16314d] p-1.5 text-[#7dd3fc] transition hover:border-[#00CBFF] hover:text-white"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7aa2c8]">
              {WEEKDAY_SHORT.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {buildCalendar(cursor.year, cursor.month).map((cell, index) => {
                if (cell === null) return <span key={`empty-${index}`} />;
                const iso = isoDate(cursor.year, cursor.month, cell);
                const count = countsByDay.get(iso) ?? 0;
                const active = selectedDay === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${cell} de ${MONTH_NAMES[cursor.month]}, ${count} ${count === 1 ? 'agendamento' : 'agendamentos'}`}
                    onClick={() => setSelectedDay(active ? null : iso)}
                    className={`flex h-11 flex-col items-center justify-center rounded-lg border text-xs transition ${
                      active
                        ? 'border-[#00CBFF] bg-[#0c243a] text-white'
                        : 'border-[#132c45] bg-[#0a2035] text-[#b7d1eb] hover:border-[#00CBFF]/60'
                    }`}
                  >
                    <span>{cell}</span>
                    {count > 0 && (
                      <span
                        className={`mt-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-semibold text-white ${
                          count >= 3 ? 'bg-[#f97316]' : 'bg-[#0f7fda]'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-[14px] border border-[#132c45] bg-[#0a2035] px-3 py-2">
              <div>
                <div className="text-sm font-semibold text-white">
                  {selectedDay ? formatDateBr(selectedDay) : 'Todos os dias'}
                </div>
                <div className="text-[11px] text-[#7aa2c8]">
                  {selectedDay
                    ? `${countsByDay.get(selectedDay) ?? 0} ${
                        (countsByDay.get(selectedDay) ?? 0) === 1 ? 'agendamento' : 'agendamentos'
                      }`
                    : `${searched.length} ${searched.length === 1 ? 'agendamento' : 'agendamentos'}`}
                </div>
              </div>
              {selectedDay && (
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="text-xs font-semibold text-[#7dd3fc] transition hover:text-white"
                >
                  Ver todos
                </button>
              )}
            </div>
          </PanelCard>
        </aside>
      </div>

      {contactTarget && (
        <CopyMessageDialog
          leadId={contactTarget.lead_id}
          leadName={contactTarget.lead_name ?? '—'}
          productId={contactTarget.product_id}
          scheduleId={contactTarget.id}
          origin="schedule"
          onClose={() => setContactTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['schedules'] });
            qc.invalidateQueries({ queryKey: ['me', 'goals'] });
          }}
        />
      )}
      {resolveTarget && (
        <ResolveDialog schedule={resolveTarget} onClose={() => setResolveTarget(null)} />
      )}
    </div>
  );
}

function shiftMonth(cursor: { year: number; month: number }, delta: number) {
  const next = new Date(cursor.year, cursor.month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

function buildCalendar(year: number, month: number): Array<number | null> {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  return cells;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function longDayLabel(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(year, month - 1, day);
  return `Dia ${day} de ${MONTH_NAMES[month - 1]} de ${year} — ${WEEKDAY_LONG[date.getDay()]}`;
}

function daysUntil(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return Number.POSITIVE_INFINITY;
  const target = new Date(year, month - 1, day).getTime();
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target - base) / 86_400_000);
}

function ResolveDialog({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => schedules.resolve(schedule.id, { reason: reason.trim(), new_date: newDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      onClose();
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md card-strong p-6">
        <h2 className="text-lg font-semibold">Resolver agendamento</h2>
        <p className="mt-1 text-xs text-text-secondary">
          A justificativa é obrigatória. Um novo agendamento será criado com a data informada.
        </p>
        <label className="label mt-4" htmlFor="resolve-reason">
          Justificativa
        </label>
        <textarea
          id="resolve-reason"
          className="input h-24"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <label className="label mt-3" htmlFor="resolve-date">
          Nova data
        </label>
        <input
          id="resolve-date"
          type="date"
          className="input"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
        />
        {error && (
          <div className="mt-3 rounded-lg border border-state-danger/30 bg-state-danger/10 px-3 py-2 text-sm text-state-danger">
            {error}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-orange"
            disabled={mut.isPending || reason.trim().length < 3 || !newDate}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Resolvendo…' : 'Resolver e reagendar'}
          </button>
        </div>
      </div>
    </div>
  );
}
