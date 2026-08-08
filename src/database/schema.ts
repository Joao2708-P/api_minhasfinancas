import { sql, relations } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

/**
 * MODELO MULTI-TENANT (B2B)
 *
 * Hierarquia:  organizacao (tenant) → membro (usuário + papel) → cliente → dados financeiros
 *
 * Isolamento:  toda tabela de dados carrega `organizacao_id` (filtro de tenant direto,
 *              sem JOIN) E `cliente_id` (de quem é o dado). O acesso é decidido por papel
 *              no service. `organizacao_id`/`cliente_id`/`usuario_id` vêm SEMPRE do contexto
 *              autenticado, nunca do corpo da requisição.
 *
 * Decisões aplicadas:
 *   - cliente.usuario_id é NULLABLE  → cliente pode ou não ter login (os dois casos).
 *   - cliente.responsavel_id (1 membro) → um planejador responsável por cliente.
 *
 * Ajustes de robustez (parte do "melhorar as tabelas"):
 *   - FKs de dono agora NOT NULL (antes nullable = risco de registro órfão sem dono).
 *   - Padronizado `.$defaultFn(() => createId())` (antes havia `.$default` em algumas).
 */

/* ------------------------------------------------------------------ */
/* Identidade                                                          */
/* ------------------------------------------------------------------ */

export const users = sqliteTable(
    "usuario", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        name: text('nome').notNull(),
        email: text('email').notNull().unique(),
        password: text('senha').notNull(),
        cpf: text('cpf').notNull().unique(),
        // true = senha ainda não definida pelo próprio usuário (provisionado ou reset
        // forçado). Login bloqueia e encaminha ao fluxo de código (primeiro acesso).
        mustReset: integer('deve_redefinir', { mode: 'boolean' }).notNull().default(false),
        // true = dono da PLATAFORMA (você). Vê todas as orgs e o status de pagamento
        // no painel /platform. NÃO é membro de org — é um papel acima do tenant.
        platformAdmin: integer('admin_plataforma', { mode: 'boolean' }).notNull().default(false),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

/* ------------------------------------------------------------------ */
/* Código de acesso (primeiro acesso + recuperação de senha)           */
/* ------------------------------------------------------------------ */

// Um código de uso único, com expiração, emitido para um usuário. Mesmo primitivo
// para "primeiro acesso" (usuário provisionado) e "esqueci minha senha".
// Guarda-se o HASH do código (nunca o valor cru), como a senha.
export const codigoAcesso = sqliteTable(
    "codigo_acesso", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        user_id: text('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        code_hash: text('codigo_hash').notNull(),
        purpose: text('proposito', { enum: ['first_access', 'reset'] }).notNull(),
        expiresAt: integer('expira_em', { mode: 'timestamp' }).notNull(),
        usedAt: integer('usado_em', { mode: 'timestamp' }),  // null = ainda não usado
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

/* ------------------------------------------------------------------ */
/* Tenant + acesso                                                     */
/* ------------------------------------------------------------------ */

// A organização é o tenant: a consultoria / o planejador como negócio.
export const organizacao = sqliteTable(
    "organizacao", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        name: text('nome').notNull(),
        // Ponteiro de conveniência para o dono. O vínculo formal (com papel) é em `membro`.
        owner_id: text('dono_id').notNull().references(() => users.id),
        status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
        // Billing MÍNIMO (§5.1: sem motor de preço-fundador agora) — só o que o painel
        // da plataforma precisa mostrar/alternar: "pagou ou não".
        billing_status: text('status_pagamento', { enum: ['trial', 'active', 'past_due'] }).notNull().default('trial'),
        paid_until: integer('pago_ate', { mode: 'timestamp' }),  // até quando está em dia (opcional)
        // White-label (§1.2): identidade visual da org, exibida ao cliente.
        brand_name: text('nome_marca'),          // nome exibido (fallback: `name`)
        logo_key: text('logo_key'),              // key do R2, não a URL
        primary_color: text('cor_primaria'),     // tema do portal do cliente
        subdomain: text('subdominio').unique(),  // ex.: contabilidadex.seuapp.com
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

// Vínculo usuário ↔ organização, carregando o papel. Um usuário pode pertencer a
// várias organizações (por isso é tabela separada, não uma coluna em `usuario`).
export const membro = sqliteTable(
    "membro", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        user_id: text('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
        role: text('papel', { enum: ['owner', 'admin', 'planner', 'viewer'] }).notNull(),
        // 'invited' = convidado mas ainda não aceitou; 'revoked' = acesso removido sem apagar histórico.
        status: text('status', { enum: ['active', 'invited', 'revoked'] }).notNull().default('active'),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    },
    (table) => ({
        // Um único vínculo por usuário por organização.
        orgUserUnico: uniqueIndex('membro_org_user_unico').on(table.organizacao_id, table.user_id),
    })
);

// O cliente é a pessoa cujas finanças são gerenciadas.
// - usuario_id NULLABLE: cliente pode ser gerenciado sem login, ou ganhar acesso depois.
// - responsavel_id: o planejador (membro) dono da relação. Nullable p/ cliente sem responsável.
export const cliente = sqliteTable(
    "cliente", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        user_id: text('usuario_id').references(() => users.id, { onDelete: 'set null' }),
        responsavel_id: text('responsavel_id').references(() => membro.id, { onDelete: 'set null' }),
        name: text('nome').notNull(),
        // §1.2b: cliente arquivado não conta pra cobrança/métricas (billing §5.1).
        // Incluído já no schema — adicionar depois que há dado é mais custoso.
        status: text('status', { enum: ['ativo', 'arquivado'] }).notNull().default('ativo'),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

/* ------------------------------------------------------------------ */
/* Lookup global                                                       */
/* ------------------------------------------------------------------ */

// Tipos de conta são um lookup genérico (corrente, poupança...). Mantido GLOBAL,
// compartilhado entre organizações. Se um dia precisar de tipos por org, adicionar
// organizacao_id aqui — por ora não é necessário.
export const accountType = sqliteTable(
    "tipo_conta", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        name: text('nome').notNull().unique(),
        description: text('descricao').notNull(),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

/* ------------------------------------------------------------------ */
/* Dados financeiros (escopados por organizacao + cliente)             */
/* ------------------------------------------------------------------ */

export const account = sqliteTable(
    "conta", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        cliente_id: text('cliente_id').notNull().references(() => cliente.id, { onDelete: 'cascade' }),
        type_account_id: text('tipo_de_conta_id').references(() => accountType.id, { onDelete: 'set null' }),
        name: text('nome').notNull(),
        banco: text('banco'),
        balance: integer('saldo'),   // saldo de abertura, em centavos (saldo atual é derivado)
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

export const category = sqliteTable(
    "categoria", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        cliente_id: text('cliente_id').notNull().references(() => cliente.id, { onDelete: 'cascade' }),
        name: text('nome').notNull(),
        type: text('tipo').notNull(),
        icon: text('icone'),
        color: text('cor'),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

export const goal = sqliteTable(
    "meta", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        cliente_id: text('cliente_id').notNull().references(() => cliente.id, { onDelete: 'cascade' }),
        name: text('nome').notNull(),
        target_value: integer('valor_alvo').notNull(),   // centavos
        current_value: integer('valor_atual').notNull(), // centavos
        term: integer('prazo', { mode: 'timestamp' }).notNull(),
        color: text('cor'),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

export const transaction = sqliteTable(
    "transacao", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        cliente_id: text('cliente_id').notNull().references(() => cliente.id, { onDelete: 'cascade' }),
        account_id: text('conta_id').references(() => account.id, { onDelete: 'restrict' }),
        category_id: text('categoria_id').references(() => category.id, { onDelete: 'set null' }),
        type: text('tipo', { enum: ['in', 'out'] }).notNull(),
        description: text('descricao'),
        value: integer('valor').notNull(),  // sempre positivo, em centavos; o sinal vem de `tipo`
        date: integer('data', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

export const extract = sqliteTable(
    "extrato", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        cliente_id: text('cliente_id').notNull().references(() => cliente.id, { onDelete: 'cascade' }),
        account_id: text('conta_id').references(() => account.id, { onDelete: 'set null' }),
        fileKey: text('arquivo_key').notNull(),   // key do R2, não a URL
        fileName: text('nome_original'),
        format: text('formato', { enum: ['ofx', 'csv', 'pdf'] }).notNull(),
        status: text('status', { enum: ['pending', 'parsed', 'imported', 'error'] }).notNull().default('pending'),
        importedCount: integer('qtd_importada').notNull().default(0),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    }
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const userRelations = relations(users, ({ many }) => ({
    membros: many(membro),
    // Um usuário pode estar vinculado a um cliente (quando o cliente tem login).
    clientes: many(cliente),
    codigosAcesso: many(codigoAcesso),
}));

export const codigoAcessoRelations = relations(codigoAcesso, ({ one }) => ({
    usuario: one(users, { fields: [codigoAcesso.user_id], references: [users.id] }),
}));

export const organizacaoRelations = relations(organizacao, ({ one, many }) => ({
    dono: one(users, { fields: [organizacao.owner_id], references: [users.id] }),
    membros: many(membro),
    clientes: many(cliente),
}));

export const membroRelations = relations(membro, ({ one, many }) => ({
    organizacao: one(organizacao, { fields: [membro.organizacao_id], references: [organizacao.id] }),
    usuario: one(users, { fields: [membro.user_id], references: [users.id] }),
    // Clientes sob responsabilidade deste membro.
    clientesResponsavel: many(cliente),
}));

export const clienteRelations = relations(cliente, ({ one, many }) => ({
    organizacao: one(organizacao, { fields: [cliente.organizacao_id], references: [organizacao.id] }),
    usuario: one(users, { fields: [cliente.user_id], references: [users.id] }),
    responsavel: one(membro, { fields: [cliente.responsavel_id], references: [membro.id] }),
    accounts: many(account),
    categories: many(category),
    goals: many(goal),
    transactions: many(transaction),
    extracts: many(extract),
}));

export const accountTypeRelations = relations(accountType, ({ many }) => ({
    accounts: many(account),
}));

export const accountRelations = relations(account, ({ one }) => ({
    organizacao: one(organizacao, { fields: [account.organizacao_id], references: [organizacao.id] }),
    cliente: one(cliente, { fields: [account.cliente_id], references: [cliente.id] }),
    typeaccount: one(accountType, { fields: [account.type_account_id], references: [accountType.id] }),
}));

export const categoryRelations = relations(category, ({ one }) => ({
    organizacao: one(organizacao, { fields: [category.organizacao_id], references: [organizacao.id] }),
    cliente: one(cliente, { fields: [category.cliente_id], references: [cliente.id] }),
}));

export const goalRelations = relations(goal, ({ one }) => ({
    organizacao: one(organizacao, { fields: [goal.organizacao_id], references: [organizacao.id] }),
    cliente: one(cliente, { fields: [goal.cliente_id], references: [cliente.id] }),
}));

export const transactionRelations = relations(transaction, ({ one }) => ({
    organizacao: one(organizacao, { fields: [transaction.organizacao_id], references: [organizacao.id] }),
    cliente: one(cliente, { fields: [transaction.cliente_id], references: [cliente.id] }),
    account: one(account, { fields: [transaction.account_id], references: [account.id] }),
    category: one(category, { fields: [transaction.category_id], references: [category.id] }),
}));

export const extractRelations = relations(extract, ({ one }) => ({
    organizacao: one(organizacao, { fields: [extract.organizacao_id], references: [organizacao.id] }),
    cliente: one(cliente, { fields: [extract.cliente_id], references: [cliente.id] }),
    account: one(account, { fields: [extract.account_id], references: [account.id] }),
}));
