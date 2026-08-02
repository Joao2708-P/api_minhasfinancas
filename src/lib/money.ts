export const toCents = (v: number) => Math.round(v * 100)
export const fromCents = (c: number) => c / 100
export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })