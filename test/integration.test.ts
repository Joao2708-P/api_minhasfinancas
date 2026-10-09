/// <reference types="node" />
// Teste de INTEGRAÇÃO dos services reais contra um SQLite em memória (node:sqlite, Node
// 22.5+, via drizzle sqlite-proxy), com o schema aplicado a partir de migrations/*.sql.
// Cobre os fluxos que dependem de banco: baixa/recorrência/conciliação (Fase 4),
// projeção, ingestão, patrimônio, chaves de ingestão e isolamento entre clientes.
//
// DELTA_0009 = colunas/tabelas do schema.ts que ainda não têm migration gerada. Depois
// do `pnpm db:generate`, as instruções viram no-op (coluna/tabela já existe) — pode
// apagar a lista.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/database/schema";
import type { Database } from "../src/database";
import { contaProgramadaService } from "../src/services/contaProgramada.service";
import { transactionService } from "../src/services/transaction.service";
import { reportService } from "../src/services/report.service";
import { ingestService } from "../src/services/ingest.service";
import { bemService } from "../src/services/bem.service";
import { ingestKeyService } from "../src/services/ingestKey.service";
import { accountService } from "../src/services/account.service";
import { hashIngestKey } from "../src/lib/ingestKey";

const sqlite = new DatabaseSync(":memory:");
const DELTA_0009 = [
    "ALTER TABLE `conta` ADD `external_id` text",
    "ALTER TABLE `transacao` ADD `external_id` text",
    "ALTER TABLE `conta_programada` ADD `pago_em` integer",
    "ALTER TABLE `conta_programada` ADD `dia_vencimento` integer",
    `CREATE TABLE chave_ingestao (id text PRIMARY KEY NOT NULL, organizacao_id text NOT NULL, cliente_id text NOT NULL,
        nome text NOT NULL, token_hash text NOT NULL, ultimos4 text NOT NULL, revogada integer DEFAULT false NOT NULL,
        usada_em integer, criado_em integer DEFAULT (strftime('%s','now')) NOT NULL)`,
    `CREATE TABLE bem (id text PRIMARY KEY NOT NULL, organizacao_id text NOT NULL, cliente_id text NOT NULL,
        tipo text NOT NULL, classe_investimento text, nome text NOT NULL, instituicao text,
        valor_aquisicao integer NOT NULL, data_aquisicao integer, valor_atual integer NOT NULL, avaliado_em integer,
        observacoes text, criado_em integer DEFAULT (strftime('%s','now')) NOT NULL,
        atualizado_em integer DEFAULT (strftime('%s','now')) NOT NULL)`,
];

const norm = (p: unknown): SQLInputValue => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : (p as SQLInputValue));
const db = drizzle(
    async (sql, params, method) => {
        const stmt = sqlite.prepare(sql);
        stmt.setReturnArrays?.(true);
        const args = params.map(norm);
        if (method === "run") {
            stmt.run(...args);
            return { rows: [] };
        }
        if (method === "get") {
            const row = stmt.get(...args);
            return { rows: row ? (Array.isArray(row) ? row : Object.values(row)) : undefined } as any;
        }
        const rows = stmt.all(...args);
        return { rows: rows.map((r: any) => (Array.isArray(r) ? r : Object.values(r))) };
    },
    { schema },
) as unknown as Database;

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const ids = { user: "u1", org: "o1", cli: "c1", cli2: "c2", acc: "a1", cat: "k1" };
const s = { orgId: ids.org, clienteId: ids.cli };
const s2 = { orgId: ids.org, clienteId: ids.cli2 };

beforeAll(() => {
    const dir = join(__dirname, "..", "migrations");
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
        for (const stmt of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint")) {
            if (!stmt.trim()) continue;
            try {
                sqlite.exec(stmt);
            } catch (e) {
                // Cópias de dados de rebuild de tabela (banco vazio) — irrelevantes aqui.
                if (!/^\s*INSERT/i.test(stmt)) throw new Error(`${f}: ${(e as Error).message}`);
            }
        }
    }
    for (const d of DELTA_0009) {
        try {
            sqlite.exec(d);
        } catch (e) {
            if (!/duplicate column|already exists/i.test((e as Error).message)) throw e;
        }
    }
    sqlite.exec(`
        INSERT INTO usuario (id, nome, email, senha, cpf, admin_plataforma) VALUES ('u1','Admin','a@a.com','x','00000000000',1);
        INSERT INTO organizacao (id, nome, dono_id) VALUES ('o1','Escritório','u1');
        INSERT INTO cliente (id, organizacao_id, nome) VALUES ('c1','o1','Cliente 1'), ('c2','o1','Cliente 2');
        INSERT INTO conta (id, organizacao_id, cliente_id, nome, saldo) VALUES ('a1','o1','c1','Corrente',100000);
        INSERT INTO categoria (id, organizacao_id, cliente_id, nome, tipo) VALUES ('k1','o1','c1','Moradia','out');
    `);
});

describe("smoke: Fase 4 + patrimônio + integração (services reais)", () => {
    let aluguelId = "";
    let nextId = "";

    it("cria recorrente mensal no dia 31 com âncora", async () => {
        const row = await contaProgramadaService.create(db, s, {
            direction: "payable", description: "Aluguel", value: 50000, dueDate: day("2026-10-31"),
            category_id: ids.cat, recurrence: "monthly",
        }, ids.user);
        aluguelId = row.id;
        expect(row.anchorDay).toBe(31);
        expect(row.status).toBe("pending");
    });

    it("baixa lançando na conta: cria a saída, marca paga e gera a próxima (30/11)", async () => {
        const res = await contaProgramadaService.settle(db, s, aluguelId, {
            account_id: ids.acc, paidAt: day("2026-10-30"), value: 51000,
        }, ids.user);
        expect(res.status).toBe("paid");
        expect(res.transaction_id).toBeTruthy();
        expect(res.paidAt!.toISOString()).toBe("2026-10-30T00:00:00.000Z");
        const tx = await transactionService.findByIdOwned(db, s, res.transaction_id!);
        expect(tx).toMatchObject({ type: "out", value: 51000, category_id: ids.cat });
        expect(res.next!.dueDate.toISOString()).toBe("2026-11-30T00:00:00.000Z");
        expect(res.next!.anchorDay).toBe(31);
        nextId = res.next!.id;
        expect(await accountService.totalCurrentBalance(db, s)).toBe(49000);
    });

    it("baixa idempotente não duplica a próxima", async () => {
        const again = await contaProgramadaService.settle(db, s, aluguelId, {}, ids.user);
        expect(again.next).toBeNull();
        const list = await contaProgramadaService.listByScope(db, s, { direction: "payable" });
        expect(list).toHaveLength(2);
    });

    it("sugere a transação importada e concilia; próxima volta ao dia 31", async () => {
        const tx = await transactionService.create(db, s, {
            account_id: ids.acc, type: "out", value: 50000, date: day("2026-11-29"), description: "TED aluguel",
        }, ids.user);
        const sug = await contaProgramadaService.suggestions(db, s, nextId);
        expect(sug[0]).toMatchObject({ id: tx.id, exact: true, dayDiff: 1 });

        const res = await contaProgramadaService.settle(db, s, nextId, { transaction_id: tx.id }, ids.user);
        expect(res.status).toBe("paid");
        expect(res.next!.dueDate.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    });

    it("rejeita entrada para conta a pagar e transação já usada", async () => {
        const dec = (await contaProgramadaService.listByScope(db, s, { status: "pending" }))[0];
        const entrada = await transactionService.create(db, s, {
            account_id: ids.acc, type: "in", value: 50000, date: day("2026-12-30"),
        }, ids.user);
        await expect(contaProgramadaService.settle(db, s, dec.id, { transaction_id: entrada.id }, ids.user))
            .rejects.toThrow(/saída/);
        const paid = await contaProgramadaService.findByIdOwned(db, s, nextId);
        await expect(contaProgramadaService.settle(db, s, dec.id, { transaction_id: paid!.transaction_id! }, ids.user))
            .rejects.toThrow(/outra conta/);
        await transactionService.delete(db, s, entrada.id, ids.user);
    });

    it("excluir a transação que quitou reabre o compromisso", async () => {
        const paid = await contaProgramadaService.findByIdOwned(db, s, nextId);
        await transactionService.delete(db, s, paid!.transaction_id!, ids.user);
        const reopened = await contaProgramadaService.findByIdOwned(db, s, nextId);
        expect(reopened).toMatchObject({ status: "pending", transaction_id: null, paidAt: null });
    });

    it("projeção não conta em dobro a série reaberta (nov + dez pendentes)", async () => {
        const r = await reportService.projectedCashflow(db, s, 6);
        expect(r.openingBalance).toBe(49000);
        // Mesmo com nov e dez pendentes, cada mês futuro tem UMA parcela de aluguel.
        const byMonth = Object.fromEntries(r.buckets.map((b) => [b.month, b.payables]));
        expect(byMonth["2026-11"]).toBe(50000);
        expect(byMonth["2026-12"]).toBe(50000);
        expect(byMonth["2027-01"]).toBe(50000);
        expect(byMonth["2027-02"]).toBe(50000);
    });

    it("isolamento: outro cliente da mesma org não enxerga nem baixa", async () => {
        expect(await contaProgramadaService.findByIdOwned(db, s2, nextId)).toBeUndefined();
        await expect(contaProgramadaService.settle(db, s2, nextId, {}, ids.user)).rejects.toThrow(/não encontrad/);
        expect(await bemService.listByScope(db, s2)).toEqual([]);
    });

    it("ingestão: cria conta externa, deduplica e auto-concilia par único", async () => {
        const rec = await contaProgramadaService.create(db, s, {
            direction: "receivable", description: "Honorário", value: 80000, dueDate: day("2026-10-15"), recurrence: "once",
        }, ids.user);
        const payload = {
            account: { external_id: "ext-acc", name: "Banco X" },
            transactions: [
                { external_id: "t1", type: "in" as const, value: 80000, date: day("2026-10-16"), description: "PIX" },
                { external_id: "t2", type: "out" as const, value: 1234, date: day("2026-10-16") },
            ],
        };
        const r1 = await ingestService.sync(db, s, payload);
        expect(r1).toMatchObject({ account_created: true, created: 2, reconciled: 1 });
        const r2 = await ingestService.sync(db, s, payload);
        expect(r2).toMatchObject({ account_created: false, created: 0, skipped: 2, reconciled: 0 });
        expect((await contaProgramadaService.findByIdOwned(db, s, rec.id))!.status).toBe("paid");
    });

    it("patrimônio: CRUD + resumo com patrimônio líquido", async () => {
        const inv = await bemService.create(db, s, {
            kind: "investment", investmentClass: "fixed_income", name: "CDB", acquisitionValue: 1000000,
            acquiredAt: day("2024-10-09"), currentValue: 1210000,
        }, ids.user);
        expect(inv.gain).toBe(210000);
        const casa = await bemService.create(db, s, {
            kind: "real_estate", name: "Casa", acquisitionValue: 30000000, currentValue: 30000000,
        }, ids.user);
        expect(casa.investmentClass).toBeNull();
        await bemService.update(db, s, casa.id, { currentValue: 35000000, valuedAt: day("2026-10-01") }, ids.user);

        const sum = await bemService.summary(db, s);
        const contas = await accountService.totalCurrentBalance(db, s);
        expect(sum.current).toBe(36210000);
        expect(sum.netWorth).toBe(contas + 36210000);
        expect(sum.byInvestmentClass[0].investmentClass).toBe("fixed_income");

        await expect(bemService.update(db, s, casa.id, { investmentClass: "stocks" }, ids.user)).rejects.toThrow();
    });

    it("chave de ingestão: cria (token cru 1×), autentica por hash e revoga", async () => {
        const k = await ingestKeyService.create(db, s, { name: "Agregador" }, ids.user);
        expect(k.key.startsWith("mfk_")).toBe(true);
        expect("tokenHash" in k).toBe(false);
        const hash = await hashIngestKey(k.key);
        const byHash = await db.query.chaveIngestao.findFirst({ where: (t, { eq }) => eq(t.tokenHash, hash) });
        expect(byHash?.cliente_id).toBe(ids.cli);
        const revoked = await ingestKeyService.revoke(db, s, k.id, ids.user);
        expect(revoked!.revoked).toBe(true);
        expect(await ingestKeyService.revoke(db, s2, k.id, ids.user)).toBeUndefined();
    });
});
