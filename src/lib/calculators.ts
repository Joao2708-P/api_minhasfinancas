/**
 * Calculadoras financeiras — funções PURAS de simulação.
 *
 * Convenção (igual ao resto do sistema): todo valor monetário entra e sai em
 * CENTAVOS (inteiros). Juros entram como taxa percentual ANUAL (ex.: 12 = 12% a.a.).
 * A conversão pra taxa mensal é feita aqui dentro.
 *
 * São puras (sem I/O, sem banco) de propósito: fáceis de testar e de reusar
 * tanto num endpoint quanto num módulo futuro (§5 do task.md).
 */

// Taxa mensal a partir da taxa anual em %. Ex.: 12% a.a. → 0.01 a.m. (juros
// simples de conversão: aa/12). Usamos a convenção "nominal ao mês" por ser a
// mais comum em simulação de aportes/financiamento no varejo brasileiro.
function monthlyRate(annualRatePct: number): number {
    return annualRatePct / 100 / 12;
}

export type CompoundInput = {
    principal: number;            // aporte inicial, em centavos
    monthlyContribution: number;  // aporte mensal, em centavos
    annualRatePct: number;        // taxa anual, em % (ex.: 10.5)
    months: number;               // horizonte, em meses (inteiro >= 1)
};

export type CompoundResult = {
    futureValue: number;      // montante final, em centavos
    totalContributed: number; // total aportado (inicial + aportes), em centavos
    totalInterest: number;    // juros ganhos, em centavos
};

/**
 * Juros compostos com aportes mensais (aporte no fim de cada mês — anuidade
 * ordinária). O clássico "quanto vira meu dinheiro se eu investir X e aportar Y".
 *
 *   FV = P·(1+i)^n + PMT·((1+i)^n − 1)/i
 */
export function futureValueWithContributions(input: CompoundInput): CompoundResult {
    const { principal, monthlyContribution, annualRatePct } = input;
    const n = Math.max(0, Math.floor(input.months));
    const i = monthlyRate(annualRatePct);

    let futureValue: number;
    if (i === 0) {
        futureValue = principal + monthlyContribution * n;
    } else {
        const growth = Math.pow(1 + i, n);
        futureValue = principal * growth + monthlyContribution * ((growth - 1) / i);
    }

    const totalContributed = principal + monthlyContribution * n;
    const fv = Math.round(futureValue);

    return {
        futureValue: fv,
        totalContributed,
        totalInterest: fv - totalContributed,
    };
}

export type LoanInput = {
    principal: number;       // valor financiado, em centavos
    annualRatePct: number;   // taxa anual, em %
    months: number;          // número de parcelas (inteiro >= 1)
};

export type LoanResult = {
    installment: number;   // valor da parcela (fixa), em centavos
    totalPaid: number;     // total pago ao fim, em centavos
    totalInterest: number; // juros totais, em centavos
};

/**
 * Financiamento pela Tabela Price (parcelas fixas / sistema francês).
 *
 *   PMT = P·i / (1 − (1+i)^−n)
 */
export function loanInstallment(input: LoanInput): LoanResult {
    const { principal, annualRatePct } = input;
    const n = Math.max(1, Math.floor(input.months));
    const i = monthlyRate(annualRatePct);

    const installment =
        i === 0 ? principal / n : (principal * i) / (1 - Math.pow(1 + i, -n));

    const pmt = Math.round(installment);
    const totalPaid = pmt * n;

    return {
        installment: pmt,
        totalPaid,
        totalInterest: totalPaid - principal,
    };
}

export type GoalContributionInput = {
    target: number;          // valor-alvo da meta, em centavos
    current: number;         // valor já acumulado, em centavos
    months: number;          // prazo, em meses (inteiro >= 1)
    annualRatePct?: number;  // rendimento anual esperado, em % (default 0)
};

/**
 * Aporte mensal necessário pra bater uma meta no prazo, considerando o que já
 * está acumulado render juros até lá.
 *
 *   PMT = (alvo − atual·(1+i)^n) / (((1+i)^n − 1)/i)
 *
 * Se o que já está acumulado, rendendo, já alcança a meta, retorna 0.
 */
export function requiredMonthlyForGoal(input: GoalContributionInput): number {
    const { target, current } = input;
    const n = Math.max(1, Math.floor(input.months));
    const i = monthlyRate(input.annualRatePct ?? 0);

    const growth = i === 0 ? 1 : Math.pow(1 + i, n);
    const futureOfCurrent = current * growth;
    const remaining = target - futureOfCurrent;

    if (remaining <= 0) return 0; // o acumulado já chega lá

    const factor = i === 0 ? n : (growth - 1) / i;
    return Math.round(remaining / factor);
}

export type MonthsToGoalInput = {
    target: number;                // valor-alvo, em centavos
    current: number;               // acumulado, em centavos
    monthlyContribution: number;   // aporte mensal, em centavos
    annualRatePct?: number;        // rendimento anual, em % (default 0)
    maxMonths?: number;            // teto da simulação (default 1200 = 100 anos)
};

/**
 * Em quantos meses a meta é atingida, dado um aporte mensal. Simula mês a mês
 * (rende o saldo, depois aporta). Retorna `null` se for inalcançável dentro do
 * teto (ex.: sem aporte e sem juros, ou aporte insuficiente pra vencer o alvo).
 */
export function monthsToReachGoal(input: MonthsToGoalInput): number | null {
    const { target, monthlyContribution } = input;
    const i = monthlyRate(input.annualRatePct ?? 0);
    const maxMonths = Math.max(1, Math.floor(input.maxMonths ?? 1200));

    if (input.current >= target) return 0;

    let balance = input.current;
    for (let month = 1; month <= maxMonths; month++) {
        balance = balance * (1 + i) + monthlyContribution;
        if (balance >= target) return month;
    }

    return null; // não alcança dentro do teto
}
