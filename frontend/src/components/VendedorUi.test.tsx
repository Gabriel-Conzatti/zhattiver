import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge, GoalBar, GoalGauge, idleLabel, relativeDays, toneForName } from './VendedorUi';

describe('VendedorUi', () => {
  it('aplica tom consistente por nome de origem', () => {
    expect(toneForName('Indicação')).toBe('blue');
    expect(toneForName('Renovação')).toBe('green');
    expect(toneForName('Prospecção ativa')).toBe('orange');
    expect(toneForName('Origem personalizada')).toBe(toneForName('Origem personalizada'));
  });

  it('renderiza badge com o rótulo recebido', () => {
    render(<Badge>Indicação</Badge>);
    expect(screen.getByText('Indicação')).toBeVisible();
  });

  it('expõe progresso acessível na barra de meta', () => {
    render(<GoalBar label="Prospecção" done={16} target={20} />);
    const bar = screen.getByRole('progressbar', { name: 'Prospecção' });
    expect(bar).toHaveAttribute('aria-valuenow', '80');
    expect(screen.getByText('16/20')).toBeVisible();
  });

  it('informa meta não configurada quando o alvo é zero', () => {
    render(<GoalBar label="Follow-ups" done={3} target={0} />);
    expect(screen.getByText('Meta não configurada')).toBeVisible();
  });

  it('descreve o medidor de meta mensal', () => {
    render(<GoalGauge current={10} target={20} caption="Vendas no mês" />);
    expect(screen.getByRole('img', { name: 'Vendas no mês: 10 de 20' })).toBeInTheDocument();
  });

  it('calcula ociosidade e dias relativos', () => {
    const tenHoursAgo = new Date(Date.now() - 10 * 3_600_000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

    expect(idleLabel(tenHoursAgo)).toEqual({ text: '10h', tone: 'green' });
    expect(idleLabel(threeDaysAgo).tone).toBe('orange');
    expect(relativeDays(threeDaysAgo)).toBe('Há 3 dias');
    expect(relativeDays(null)).toBe('—');
  });
});
