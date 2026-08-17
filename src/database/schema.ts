import { sql, relations } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
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
        // Papel customizado da org (permissões configuráveis). NULLABLE por design:
        // null = usa o conjunto fixo do papel-base `role` (comportamento legado, 100%
        // retrocompatível). Preenchido = as permissões vêm de `papel_permissao`.
        // O `role` continua governando ESCOPO (planner→só seus clientes) e a invariante
        // de ≥1 owner, independente do papel customizado. `set null`: apagar o papel não
        // apaga o membro, só o devolve ao conjunto fixo do role.
        papel_id: text('papel_customizado_id').references(() => papel.id, { onDelete: 'set null' }),
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

/* ------------------------------------------------------------------ */
/* Papéis customizados (permissões configuráveis por organização)      */
/* ------------------------------------------------------------------ */

// Papel customizado criado pela própria org (ex.: "Contador Sênior", "Estagiário").
// Os 4 papéis de SISTEMA (owner/admin/planner/viewer) NÃO ficam aqui — continuam
// fixos no código (lib/permissions.ts) e não são editáveis. Esta tabela guarda só
// os papéis ADICIONAIS. Um membro com `papel_id` apontando pra cá usa as permissões
// de `papel_permissao`; sem `papel_id`, usa o conjunto fixo do seu `role`.
export const papel = sqliteTable(
    "papel", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        name: text('nome').notNull(),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    },
    (table) => ({
        // Nome de papel único DENTRO da org (orgs diferentes podem ter nomes iguais).
        orgNomeUnico: uniqueIndex('papel_org_nome_unico').on(table.organizacao_id, table.name),
    })
);

// Quais chaves de permissão um papel concede. O CATÁLOGO de chaves válidas é fixo
// no código (lib/permissions.ts `ALL`) — isto só amarra papel→chave. PK composta
// evita duplicar a mesma permissão no mesmo papel.
export const papelPermissao = sqliteTable(
    "papel_permissao", {
        papel_id: text('papel_id').notNull().references(() => papel.id, { onDelete: 'cascade' }),
        permission_key: text('chave_permissao').notNull(),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.papel_id, table.permission_key] }),
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
    },
    (table) => ({
        // Listagem de clientes é sempre por organização (filtro de tenant).
        orgIdx: index('cliente_org_idx').on(table.organizacao_id),
    })
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
    },
    (table) => ({
        // Todo acesso é filtrado por tenant (organizacao_id + cliente_id).
        scopeIdx: index('conta_scope_idx').on(table.organizacao_id, table.cliente_id),
    })
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
    },
    (table) => ({
        scopeIdx: index('categoria_scope_idx').on(table.organizacao_id, table.cliente_id),
    })
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
    },
    (table) => ({
        scopeIdx: index('meta_scope_idx').on(table.organizacao_id, table.cliente_id),
    })
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
    },
    (table) => ({
        // Filtro por tenant + ordenação por data (listByScope ordena por data desc).
        scopeDateIdx: index('transacao_scope_data_idx').on(table.organizacao_id, table.cliente_id, table.date),
    })
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
    },
    (table) => ({
        scopeIdx: index('extrato_scope_idx').on(table.organizacao_id, table.cliente_id),
    })
);

/* ------------------------------------------------------------------ */
/* Auditoria                                                           */
/* ------------------------------------------------------------------ */

// Trilha de auditoria: uma linha por escrita relevante (criação/edição/exclusão).
// Gravada pelos services logo após a operação bem-sucedida (ver services/audit.service.ts).
//   - usuario_id → users.id (NÃO membro.id): cobre também o admin da plataforma e
//     eventos sem membro de org (ex.: provisionamento). Quem consulta cruza depois.
//   - cliente_id é NULLABLE: eventos no nível da organização (branding, membros) não
//     têm cliente. Em exclusão de cliente, o vínculo cai para null (set null) mas a
//     linha de log permanece — auditoria não some quando o dado some.
//   - dados_antes/dados_depois são JSON (string), já redigidos (sem senha/hash).
export const logAuditoria = sqliteTable(
    "log_auditoria", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        cliente_id: text('cliente_id').references(() => cliente.id, { onDelete: 'set null' }),
        user_id: text('usuario_id').notNull().references(() => users.id),
        action: text('acao', { enum: ['criado', 'atualizado', 'excluido'] }).notNull(),
        entity: text('entidade').notNull(),        // nome lógico da tabela afetada, ex.: 'transacao'
        entity_id: text('entidade_id').notNull(),
        before: text('dados_antes'),               // JSON; null em criação
        after: text('dados_depois'),               // JSON; null em exclusão
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    },
    (table) => ({
        // Leitura da trilha: por org, ordenada por data desc (listAuditByOrg).
        orgDateIdx: index('log_auditoria_org_data_idx').on(table.organizacao_id, table.createdAt),
        // Filtro opcional por entidade/registro.
        entityIdx: index('log_auditoria_entidade_idx').on(table.organizacao_id, table.entity, table.entity_id),
    })
);

/* ------------------------------------------------------------------ */
/* Cadastros (Fase 3) — escopados por organizacao + cliente            */
/* ------------------------------------------------------------------ */

// Parceiro comercial do NEGÓCIO do cliente (fornecedor/cliente dele). NÃO confundir
// com a tabela `cliente` (que é o cliente do escritório). `tipo` é vocabulário de
// domínio → fica em PT (não é status de ciclo de vida).
export const parceiro = sqliteTable(
    "parceiro", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        cliente_id: text('cliente_id').notNull().references(() => cliente.id, { onDelete: 'cascade' }),
        name: text('nome').notNull(),
        document: text('documento'),   // CPF ou CNPJ
        type: text('tipo', { enum: ['cliente', 'fornecedor', 'ambos'] }).notNull(),
        email: text('email'),
        phone: text('telefone'),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    },
    (table) => ({
        scopeIdx: index('parceiro_scope_idx').on(table.organizacao_id, table.cliente_id),
    })
);

// Funcionário do negócio do cliente. `status` é ciclo de vida → EN (decisão de
// padronização, ver CHANGELOG-metria.md): 'active' | 'terminated'.
export const funcionario = sqliteTable(
    "funcionario", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        cliente_id: text('cliente_id').notNull().references(() => cliente.id, { onDelete: 'cascade' }),
        name: text('nome').notNull(),
        document: text('cpf').notNull(),
        role: text('cargo'),
        baseSalary: integer('salario_base').notNull(),   // centavos
        hiredAt: integer('data_admissao', { mode: 'timestamp' }).notNull(),
        terminatedAt: integer('data_demissao', { mode: 'timestamp' }),
        status: text('status', { enum: ['active', 'terminated'] }).notNull().default('active'),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    },
    (table) => ({
        scopeIdx: index('funcionario_scope_idx').on(table.organizacao_id, table.cliente_id),
    })
);

// Sócio do negócio do cliente. `equityShare` fracionário (0.5 = 50%). Alimenta o
// patrimônio líquido do plano de contas (Fase 1) quando este existir.
export const socio = sqliteTable(
    "socio", {
        id: text('id').primaryKey().$defaultFn(() => createId()),
        organizacao_id: text('organizacao_id').notNull().references(() => organizacao.id, { onDelete: 'cascade' }),
        cliente_id: text('cliente_id').notNull().references(() => cliente.id, { onDelete: 'cascade' }),
        name: text('nome').notNull(),
        document: text('cpf').notNull(),
        equityShare: real('percentual_participacao').notNull(),   // ex.: 0.5 = 50%
        joinedAt: integer('data_entrada', { mode: 'timestamp' }).notNull(),
        createdAt: integer('criado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
        updateAt: integer('atualizado_em', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    },
    (table) => ({
        scopeIdx: index('socio_scope_idx').on(table.organizacao_id, table.cliente_id),
    })
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
    papel: one(papel, { fields: [membro.papel_id], references: [papel.id] }),
    // Clientes sob responsabilidade deste membro.
    clientesResponsavel: many(cliente),
}));

export const papelRelations = relations(papel, ({ one, many }) => ({
    organizacao: one(organizacao, { fields: [papel.organizacao_id], references: [organizacao.id] }),
    permissoes: many(papelPermissao),
    membros: many(membro),
}));

export const papelPermissaoRelations = relations(papelPermissao, ({ one }) => ({
    papel: one(papel, { fields: [papelPermissao.papel_id], references: [papel.id] }),
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

export const logAuditoriaRelations = relations(logAuditoria, ({ one }) => ({
    organizacao: one(organizacao, { fields: [logAuditoria.organizacao_id], references: [organizacao.id] }),
    cliente: one(cliente, { fields: [logAuditoria.cliente_id], references: [cliente.id] }),
    usuario: one(users, { fields: [logAuditoria.user_id], references: [users.id] }),
}));

export const parceiroRelations = relations(parceiro, ({ one }) => ({
    organizacao: one(organizacao, { fields: [parceiro.organizacao_id], references: [organizacao.id] }),
    cliente: one(cliente, { fields: [parceiro.cliente_id], references: [cliente.id] }),
}));

export const funcionarioRelations = relations(funcionario, ({ one }) => ({
    organizacao: one(organizacao, { fields: [funcionario.organizacao_id], references: [organizacao.id] }),
    cliente: one(cliente, { fields: [funcionario.cliente_id], references: [cliente.id] }),
}));

export const socioRelations = relations(socio, ({ one }) => ({
    organizacao: one(organizacao, { fields: [socio.organizacao_id], references: [organizacao.id] }),
    cliente: one(cliente, { fields: [socio.cliente_id], references: [cliente.id] }),
}));
