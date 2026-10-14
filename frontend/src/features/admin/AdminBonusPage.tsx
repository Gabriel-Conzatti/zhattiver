import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Plus, RotateCw, Target, Trophy } from 'lucide-react';

import {
  AdminBonusRow,
  AdminUser,
  BonusRuleRow,
  MonthlyGoalRow,
  admin,
  bonusApi,
  catalog,
} from '@/lib/api';

type Section = 'payments' | 'goals' | 'rules';

const MONTHS = [
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

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function AdminBonusPage() {
  const now = new Date();
  const [section, setSection] = useState<Section>('payments');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: admin.users });
  const products = useQuery({ queryKey: ['catalog', 'products'], queryFn: catalog.products });
  const sellers = useMemo(
    () => (users.data?.items ?? []).filter((user) => user.role === 'vendedor'),
    [users.data],
  );
  const productItems = products.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Metas e bônus</h1>
        <p className="text-sm text-text-secondary">
          Configure metas por competência, mantenha faixas com vigência mensal e acompanhe
          a apuração preservando o histórico.
        </p>
      </header>

      <nav className="nav-pill w-fit max-w-full overflow-x-auto scrollbar-none" aria-label="Seções de metas e bônus">
        <SectionButton active={section === 'payments'} onClick={() => setSection('payments')}>
          Apuração
        </SectionButton>
        <SectionButton active={section === 'goals'} onClick={() => setSection('goals')}>
          Metas mensais
        </SectionButton>
        <SectionButton active={section === 'rules'} onClick={() => setSection('rules')}>
          Faixas de bônus
        </SectionButton>
      </nav>

      {section !== 'rules' && (
        <PeriodFields year={year} month={month} onYear={setYear} onMonth={setMonth} />
      )}

      {(users.isError || products.isError) && (
        <ErrorMessage>Não foi possível carregar vendedores e produtos.</ErrorMessage>
      )}

      {section === 'payments' && (
        <PaymentsSection
          year={year}
          month={month}
          sellers={sellers}
          products={productItems}
        />
      )}
      {section === 'goals' && (
        <GoalsSection
          year={year}
          month={month}
          sellers={sellers}
          products={productItems}
        />
      )}
      {section === 'rules' && <RulesSection products={productItems} />}
    </div>
  );
}

function PaymentsSection({
  year,
  month,
  sellers,
  products,
}: {
  year: number;
  month: number;
  sellers: AdminUser[];
  products: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'bonus', year, month],
    queryFn: () => bonusApi.adminList({ year, month }),
  });
  const refresh = useMutation({
    mutationFn: () => bonusApi.refresh(year, month),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'bonus', year, month] }),
  });
  const approve = useMutation({
    mutationFn: (id: string) => bonusApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'bonus', year, month] }),
  });
  const pay = useMutation({
    mutationFn: (id: string) => bonusApi.pay(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'bonus', year, month] }),
  });
  const cancel = useMutation({
    mutationFn: () => bonusApi.cancel(cancelPaymentId ?? '', cancelReason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bonus', year, month] });
      setCancelPaymentId(null);
      setCancelReason('');
    },
  });
  const names = createNameMaps(sellers, products);
  const items = list.data?.items ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Apuração da competência</h2>
          <p className="text-sm text-text-secondary">
            Somente vendas validadas entram no cálculo.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          <RotateCw className="h-3.5 w-3.5" />
          {refresh.isPending ? 'Recalculando…' : 'Recalcular'}
        </button>
      </div>

      {(list.isError || refresh.isError || approve.isError || pay.isError || cancel.isError) && (
        <ErrorMessage>
          {mutationError(refresh.error ?? approve.error ?? pay.error ?? cancel.error) ??
            'Não foi possível carregar a apuração.'}
        </ErrorMessage>
      )}
      {list.isLoading ? (
        <LoadingMessage />
      ) : (
        <PaymentsTable
          items={items}
          names={names}
          approve={approve.mutate}
          pay={pay.mutate}
          cancel={(id) => {
            setCancelPaymentId(id);
            setCancelReason('');
          }}
        />
      )}

      {cancelPaymentId && (
        <form
          className="card space-y-4 border-state-danger/40 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            cancel.mutate();
          }}
        >
          <div>
            <h3 className="font-semibold">Cancelar bônus previsto</h3>
            <p className="text-sm text-text-secondary">
              Informe o motivo. Bônus já pagos não podem ser cancelados.
            </p>
          </div>
          <label className="label">
            Justificativa
            <textarea
              className="input mt-1 min-h-20"
              value={cancelReason}
              minLength={3}
              maxLength={500}
              required
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-orange" disabled={cancel.isPending || cancelReason.trim().length < 3}>
              {cancel.isPending ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setCancelPaymentId(null)}>
              Voltar
            </button>
          </div>
        </form>
      )}

      <div className="card p-5">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Trophy className="h-4 w-4 text-brand-orange" />
          Ao marcar como pago, a regra e a métrica atuais são preservadas no histórico.
        </div>
      </div>
    </section>
  );
}

function GoalsSection({
  year,
  month,
  sellers,
  products,
}: {
  year: number;
  month: number;
  sellers: AdminUser[];
  products: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [sellerId, setSellerId] = useState('');
  const [productId, setProductId] = useState('');
  const [targetCount, setTargetCount] = useState('0');
  const [targetPremium, setTargetPremium] = useState('0');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const goals = useQuery({
    queryKey: ['admin', 'monthly-goals', year, month],
    queryFn: () => bonusApi.goals(year, month),
  });
  const save = useMutation({
    mutationFn: () =>
      bonusApi.createGoal({
        user_id: sellerId,
        product_id: productId || null,
        year,
        month,
        target_count: Number(targetCount),
        target_net_premium: targetPremium,
        notes: notes || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'monthly-goals', year, month] });
      setSaved(true);
    },
  });
  const names = createNameMaps(sellers, products);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    save.mutate();
  }

  function edit(goal: MonthlyGoalRow) {
    setSellerId(goal.user_id);
    setProductId(goal.product_id ?? '');
    setTargetCount(String(goal.target_count));
    setTargetPremium(goal.target_net_premium);
    setNotes(goal.notes ?? '');
    setSaved(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <section className="space-y-4">
      <form className="card grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3" onSubmit={submit}>
        <div className="md:col-span-2 xl:col-span-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Target className="h-4 w-4 text-brand-cyan" />
            Meta de {MONTHS[month - 1]} de {year}
          </h2>
          <p className="text-sm text-text-secondary">
            Salvar novamente o mesmo vendedor e produto atualiza a meta da competência.
          </p>
        </div>
        <SelectField label="Vendedor" value={sellerId} onChange={setSellerId} required>
          <option value="">Selecione</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Produto" value={productId} onChange={setProductId}>
          <option value="">Meta geral</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </SelectField>
        <NumberField label="Quantidade alvo" value={targetCount} onChange={setTargetCount} min="0" step="1" />
        <NumberField
          label="Prêmio líquido alvo"
          value={targetPremium}
          onChange={setTargetPremium}
          min="0"
          step="0.01"
        />
        <label className="label md:col-span-2">
          Observações
          <textarea
            className="input mt-1 min-h-20"
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-3">
          <button type="submit" className="btn-primary" disabled={save.isPending || !sellerId}>
            <Plus className="h-4 w-4" />
            {save.isPending ? 'Salvando…' : 'Salvar meta'}
          </button>
          {saved && <span className="text-sm text-state-success">Meta salva com sucesso.</span>}
        </div>
        {save.isError && (
          <div className="md:col-span-2 xl:col-span-3">
            <ErrorMessage>{mutationError(save.error)}</ErrorMessage>
          </div>
        )}
      </form>

      {goals.isError && <ErrorMessage>Não foi possível carregar as metas.</ErrorMessage>}
      {goals.isLoading ? (
        <LoadingMessage />
      ) : (
        <GoalsTable items={goals.data?.items ?? []} names={names} onEdit={edit} />
      )}
    </section>
  );
}

function RulesSection({ products }: { products: Array<{ id: string; name: string }> }) {
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [base, setBase] = useState<'count' | 'net_premium'>('net_premium');
  const [bracketMin, setBracketMin] = useState('0');
  const [bracketMax, setBracketMax] = useState('');
  const [kind, setKind] = useState<'fixed' | 'percent'>('fixed');
  const [value, setValue] = useState('');
  const [fromMonth, setFromMonth] = useState(currentMonthValue());
  const [toMonth, setToMonth] = useState('');
  const [saved, setSaved] = useState(false);
  const rules = useQuery({ queryKey: ['admin', 'bonus-rules'], queryFn: bonusApi.bonusRules });
  const create = useMutation({
    mutationFn: () =>
      bonusApi.createBonusRule({
        product_id: productId,
        name,
        base,
        bracket_min: bracketMin,
        bracket_max: bracketMax || null,
        bonus_kind: kind,
        value,
        effective_from: `${fromMonth}-01`,
        effective_to: toMonth ? lastDayOfMonth(toMonth) : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bonus-rules'] });
      setSaved(true);
      setName('');
      setValue('');
    },
  });
  const endRule = useMutation({
    mutationFn: (id: string) => bonusApi.endBonusRule(id, lastDayOfMonth(currentMonthValue())),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'bonus-rules'] }),
  });
  const productNames = new Map(products.map((product) => [product.id, product.name]));

  function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    create.mutate();
  }

  return (
    <section className="space-y-4">
      <form className="card grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4" onSubmit={submit}>
        <div className="md:col-span-2 xl:col-span-4">
          <h2 className="font-semibold">Nova faixa de bônus</h2>
          <p className="text-sm text-text-secondary">
            Faixas publicadas são históricas. Para alterar valores, encerre a vigência
            anterior e cadastre a próxima competência sem sobreposição.
          </p>
        </div>
        <SelectField label="Produto" value={productId} onChange={setProductId} required>
          <option value="">Selecione</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Nome da faixa" value={name} onChange={setName} required />
        <SelectField label="Base de cálculo" value={base} onChange={(next) => setBase(next as typeof base)}>
          <option value="net_premium">Prêmio líquido</option>
          <option value="count">Quantidade de vendas</option>
        </SelectField>
        <SelectField label="Tipo de bônus" value={kind} onChange={(next) => setKind(next as typeof kind)}>
          <option value="fixed">Valor fixo</option>
          <option value="percent">Percentual da base</option>
        </SelectField>
        <NumberField label="Início da faixa" value={bracketMin} onChange={setBracketMin} min="0" step="0.01" />
        <NumberField label="Fim da faixa (opcional)" value={bracketMax} onChange={setBracketMax} min="0" step="0.01" />
        <NumberField
          label={kind === 'percent' ? 'Percentual decimal (0,10 = 10%)' : 'Valor do bônus'}
          value={value}
          onChange={setValue}
          min="0.0001"
          step="0.0001"
          required
        />
        <TextField label="Competência inicial" value={fromMonth} onChange={setFromMonth} type="month" required />
        <TextField label="Competência final (opcional)" value={toMonth} onChange={setToMonth} type="month" />
        <div className="flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-4">
          <button
            type="submit"
            className="btn-primary"
            disabled={create.isPending || !productId || !name || !value || !fromMonth}
          >
            <Plus className="h-4 w-4" />
            {create.isPending ? 'Publicando…' : 'Publicar faixa'}
          </button>
          {saved && <span className="text-sm text-state-success">Faixa publicada com sucesso.</span>}
        </div>
        {create.isError && (
          <div className="md:col-span-2 xl:col-span-4">
            <ErrorMessage>{mutationError(create.error)}</ErrorMessage>
          </div>
        )}
      </form>

      {rules.isError && <ErrorMessage>Não foi possível carregar as faixas.</ErrorMessage>}
      {endRule.isError && <ErrorMessage>{mutationError(endRule.error)}</ErrorMessage>}
      {rules.isLoading ? (
        <LoadingMessage />
      ) : (
        <RulesTable
          items={rules.data?.items ?? []}
          productNames={productNames}
          onEnd={(id) => endRule.mutate(id)}
          ending={endRule.isPending}
        />
      )}
    </section>
  );
}

function PaymentsTable({
  items,
  names,
  approve,
  pay,
  cancel,
}: {
  items: AdminBonusRow[];
  names: ReturnType<typeof createNameMaps>;
  approve: (id: string) => void;
  pay: (id: string) => void;
  cancel: (id: string) => void;
}) {
  return (
    <Table>
      <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
        <tr>
          <Header>Vendedor</Header>
          <Header>Produto</Header>
          <Header>Base</Header>
          <Header align="right">Apurado</Header>
          <Header align="right">Bônus</Header>
          <Header>Previsto</Header>
          <Header>Estado</Header>
          <Header align="right">Ações</Header>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && <EmptyRow columns={8}>Sem apurações para a competência.</EmptyRow>}
        {items.map((row) => (
          <tr key={row.id} className="border-t border-border">
            <Cell>{names.users.get(row.user_id) ?? 'Vendedor indisponível'}</Cell>
            <Cell>{names.products.get(row.product_id) ?? 'Produto indisponível'}</Cell>
            <Cell>{row.metric_base === 'net_premium' ? 'Prêmio líquido' : 'Quantidade'}</Cell>
            <Cell align="right">{formatMetric(row.metric_value, row.metric_base)}</Cell>
            <Cell align="right" strong>{money(row.amount)}</Cell>
            <Cell>{formatDate(row.predicted_on)}</Cell>
            <Cell><StateBadge state={row.state} /></Cell>
            <Cell align="right">
              <div className="flex justify-end gap-2">
                {row.state === 'predicted' && (
                  <button type="button" className="btn-ghost" onClick={() => approve(row.id)}>
                    Aprovar
                  </button>
                )}
                {row.state !== 'paid' && row.state !== 'cancelled' && (
                  <>
                    <button type="button" className="btn-primary" onClick={() => pay(row.id)}>
                      <CheckCheck className="h-3.5 w-3.5" /> Marcar pago
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => cancel(row.id)}>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </Cell>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function GoalsTable({
  items,
  names,
  onEdit,
}: {
  items: MonthlyGoalRow[];
  names: ReturnType<typeof createNameMaps>;
  onEdit: (goal: MonthlyGoalRow) => void;
}) {
  return (
    <Table>
      <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
        <tr>
          <Header>Vendedor</Header>
          <Header>Produto</Header>
          <Header align="right">Quantidade</Header>
          <Header align="right">Prêmio líquido</Header>
          <Header>Observações</Header>
          <Header align="right">Ação</Header>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && <EmptyRow columns={6}>Nenhuma meta cadastrada.</EmptyRow>}
        {items.map((goal) => (
          <tr key={goal.id} className="border-t border-border">
            <Cell>{names.users.get(goal.user_id) ?? 'Vendedor indisponível'}</Cell>
            <Cell>{goal.product_id ? names.products.get(goal.product_id) ?? 'Produto indisponível' : 'Meta geral'}</Cell>
            <Cell align="right">{goal.target_count}</Cell>
            <Cell align="right">{money(goal.target_net_premium)}</Cell>
            <Cell>{goal.notes || '—'}</Cell>
            <Cell align="right">
              <button type="button" className="btn-ghost" onClick={() => onEdit(goal)}>Editar</button>
            </Cell>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function RulesTable({
  items,
  productNames,
  onEnd,
  ending,
}: {
  items: BonusRuleRow[];
  productNames: Map<string, string>;
  onEnd: (id: string) => void;
  ending: boolean;
}) {
  return (
    <Table>
      <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-muted">
        <tr>
          <Header>Produto</Header>
          <Header>Faixa</Header>
          <Header>Base</Header>
          <Header>Intervalo</Header>
          <Header>Bônus</Header>
          <Header>Vigência</Header>
          <Header align="right">Ação</Header>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && <EmptyRow columns={7}>Nenhuma faixa cadastrada.</EmptyRow>}
        {items.map((rule) => (
          <tr key={rule.id} className="border-t border-border">
            <Cell>{productNames.get(rule.product_id) ?? 'Produto indisponível'}</Cell>
            <Cell strong>{rule.name}</Cell>
            <Cell>{rule.base === 'net_premium' ? 'Prêmio líquido' : 'Quantidade'}</Cell>
            <Cell>{formatBracket(rule)}</Cell>
            <Cell>{rule.bonus_kind === 'fixed' ? money(rule.value) : `${Number(rule.value) * 100}%`}</Cell>
            <Cell>{formatDate(rule.effective_from)} até {rule.effective_to ? formatDate(rule.effective_to) : 'sem término'}</Cell>
            <Cell align="right">
              {rule.effective_to ? (
                <span className="text-text-muted">Encerrada</span>
              ) : (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={ending || rule.effective_from > `${currentMonthValue()}-01`}
                  onClick={() => onEnd(rule.id)}
                >
                  Encerrar no fim do mês
                </button>
              )}
            </Cell>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function PeriodFields({
  year,
  month,
  onYear,
  onMonth,
}: {
  year: number;
  month: number;
  onYear: (value: number) => void;
  onMonth: (value: number) => void;
}) {
  return (
    <section className="card grid gap-4 p-4 sm:grid-cols-2">
      <label className="label">
        Ano
        <input className="input mt-1" type="number" min={2020} max={2100} value={year} onChange={(event) => onYear(Number(event.target.value))} />
      </label>
      <label className="label">
        Mês
        <select className="input mt-1" value={month} onChange={(event) => onMonth(Number(event.target.value))}>
          {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
        </select>
      </label>
    </section>
  );
}

function SectionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button type="button" className="nav-pill-item" data-active={active} onClick={onClick}>{children}</button>;
}

function SelectField({ label, value, onChange, children, required = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; required?: boolean }) {
  return <label className="label">{label}<select className="input mt-1" value={value} required={required} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function TextField({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="label">{label}<input className="input mt-1" type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberField({ label, value, onChange, min, step, required = false }: { label: string; value: string; onChange: (value: string) => void; min: string; step: string; required?: boolean }) {
  return <label className="label">{label}<input className="input mt-1" type="number" value={value} min={min} step={step} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Table({ children }: { children: ReactNode }) {
  return <div className="card overflow-hidden"><div className="overflow-auto"><table className="w-full min-w-[760px] text-sm">{children}</table></div></div>;
}

function Header({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function Cell({ children, align = 'left', strong = false }: { children: ReactNode; align?: 'left' | 'right'; strong?: boolean }) {
  return <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'} ${strong ? 'font-semibold' : ''}`}>{children}</td>;
}

function EmptyRow({ columns, children }: { columns: number; children: ReactNode }) {
  return <tr><td colSpan={columns} className="px-4 py-10 text-center text-text-secondary">{children}</td></tr>;
}

function LoadingMessage() {
  return <div className="card p-8 text-center text-text-secondary">Carregando…</div>;
}

function ErrorMessage({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-xl border border-state-danger/30 bg-state-danger/10 p-4 text-sm text-state-danger">{children}</div>;
}

function StateBadge({ state }: { state: AdminBonusRow['state'] }) {
  const styles = {
    predicted: 'bg-brand-blue/20 text-brand-cyan',
    approved: 'bg-brand-cyan/20 text-brand-cyan',
    paid: 'bg-state-success/20 text-state-success',
    cancelled: 'bg-state-danger/20 text-state-danger',
  };
  const labels = { predicted: 'Previsto', approved: 'Aprovado', paid: 'Pago', cancelled: 'Cancelado' };
  return <span className={`badge ${styles[state]}`}>{labels[state]}</span>;
}

function createNameMaps(users: AdminUser[], products: Array<{ id: string; name: string }>) {
  return {
    users: new Map(users.map((user) => [user.id, user.name])),
    products: new Map(products.map((product) => [product.id, product.name])),
  };
}

function money(value: string) {
  return moneyFormatter.format(Number(value));
}

function formatMetric(value: string, base: string) {
  return base === 'net_premium' ? money(value) : Number(value).toLocaleString('pt-BR');
}

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
}

function formatBracket(rule: BonusRuleRow) {
  const format = rule.base === 'net_premium' ? money : (value: string) => Number(value).toLocaleString('pt-BR');
  return `${format(rule.bracket_min)} até ${rule.bracket_max ? format(rule.bracket_max) : 'sem limite'}`;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function lastDayOfMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return `${value}-${new Date(year, month, 0).getDate()}`;
}

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}
