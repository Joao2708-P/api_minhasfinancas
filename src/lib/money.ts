// Reais → centavos. `Math.round(v * 100)` sozinho erra em valores que o float não
// representa exatamente (1.005 * 100 = 100.49999… → 100). Arredondamos antes em 6
// casas para limpar o ruído do float e depois aplicamos meio-centavo "para longe do
// zero" (o `Math.round` puro arredonda −0.5 para cima, o que distorce estornos).
export const toCents = (v: number) => {
  const raw = Number((v * 100).toFixed(6))
  return Math.sign(raw) * Math.round(Math.abs(raw))
}
export const fromCents = (c: number) => c / 100
export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
