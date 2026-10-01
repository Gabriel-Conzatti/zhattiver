import { describe, expect, it } from 'vitest';

import { formatPhone } from './format';

describe('formatPhone', () => {
  it('formata celular (9 dígitos) com DDD', () => {
    expect(formatPhone('+5551999999999')).toBe('(51) 99999-9999');
  });

  it('formata fixo (8 dígitos) com DDD', () => {
    expect(formatPhone('+555133334444')).toBe('(51) 3333-4444');
  });

  it('retorna o valor original quando não reconhece o formato', () => {
    expect(formatPhone('123')).toBe('123');
  });
});
