export function formatPhone(e164: string): string {
  // Formatação simples BR: (DDD) 9NNNN-NNNN
  const digits = e164.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return e164;
}
