# CLAUDE.md

Orientações para o Claude Code ao trabalhar neste repositório.

## O que é

API de finanças pessoais ("Minhas Finanças") construída com **Hono** (framework web), **Drizzle ORM** sobre **Cloudflare D1** (SQLite), rodando em **Cloudflare Workers** (Wrangler). Arquivos de extrato são armazenados no **Cloudflare R2**. Autenticação via **JWT** (`hono/jwt`). Validação de entrada com **Zod v4**. IDs gerados com **cuid2**. Testes com **Vitest**.

## ⚠️ Regra importante

**Nunca rode comandos de geração/migração/deploy/infra.** O usuário executa esses comandos manualmente. Isso inclui: `db:generate`, `db:migrate:local`, `db:seed`, `db:studio`, `deploy`, `wrangler r2 bucket create` e `wrangler secret put`. Após alterar o schema, apenas avise que a regeneração da migration é necessária.

> Comandos **read-only** de verificação são permitidos e recomendados: `pnpm test` (Vitest) e um type-check pontual (`npx -y -p typescript tsc --noEmit`, já que o TypeScript não é dependência do projeto).

## Estrutura

```
src/
  index.ts                # entrypoint Hono: middlewares globais (logger, secureHeaders, cors), db por request, rotas
  types.ts                # AppEnv: Bindings do Cloudflare + Variables { db, userId }
  env.d.ts                # declaration merging: acrescenta JWT_SECRET e BUCKET (R2) aos CloudflareBindings
  routes/                 # um arquivo por recurso + index.ts (grupo público /auth + grupo protegido por authGuard)
  controllers/            # controllers (um por recurso); leem/validam a request e chamam o service
  services/               # regras de negócio e acesso ao banco (um por recurso)
  middlewares/
    auth.ts               # authGuard: valida o Bearer JWT e injeta userId no contexto
  schemas/                # schemas de validação Zod, um arquivo por tabela + auth.schema.ts + index.ts
  database/
    index.ts              # createDb(d1): instância do Drizzle sobre D1
    schema.ts             # definição das tabelas Drizzle (FONTE DA VERDADE do banco)
    seed.sql              # dados de amostra (aplicar com wrangler d1 execute)
  lib/
    money.ts              # toCents / fromCents / formatBRL (valores em centavos)
    password.ts           # hash/verify de senha com PBKDF2 (Web Crypto), formato "saltHex:hashHex"
    jwt.ts                # signToken / verifyToken (HS256, TTL 7 dias)
    statementParser.ts    # parser de extratos CSV e OFX -> lançamentos normalizados
    categoryRules.ts      # sugestão de categoria por palavra-chave na descrição
test/                     # testes de unidade (Vitest) da lógica pura
migrations/               # migrations geradas pelo drizzle-kit
```

## Camadas e convenção de fluxo

`route → (authGuard) → controller → service → drizzle`. O controller valida com Zod e lê o `userId` do contexto; o service concentra a regra de negócio e o acesso ao banco. Adicione um recurso novo replicando esse conjunto (schema + service + controller + route) e registrando a rota em `src/routes/index.ts`.

## Autenticação e segurança

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`. Registro e login retornam `{ user, token }`.
- Rotas protegidas ficam sob o grupo com `authGuard` em `src/routes/index.ts`. O middleware injeta `userId` no contexto.
- **O `user_id` SEMPRE vem do token, nunca do corpo/query.** Não reintroduza `user_id` nos schemas de criação. Todo service filtra por dono (`and(eq(id), eq(user_id))`).
- Senha nunca é retornada nas respostas (removida antes) e é sempre re-hasheada quando atualizada.

## Banco de dados

- Schema em `src/database/schema.ts` (fonte da verdade). Convenção: **propriedades em inglês** (`name`, `email`, `createdAt`, `user_id`) mapeadas para **colunas em português** (`nome`, `email`, `criado_em`, `usuario_id`).
- Toda tabela tem: `id` (cuid2, PK), `criado_em` e `atualizado_em` (timestamps, default `strftime('%s','now')`).
- Tabelas: `usuario`, `tipo_conta`, `conta`, `categoria`, `meta`, `transacao`, `extrato`.
- Valores monetários são armazenados como **inteiros em centavos** (`integer`). Use `lib/money.ts`.
- **Saldo da conta é derivado**, não persistido como "verdade": `conta.saldo` é o saldo de abertura; o saldo atual = abertura + Σ(entradas) − Σ(saídas). Ver `accountService.currentBalance`.
- Transações: `valor` sempre positivo; o sinal vem de `tipo` (`in`/`out`). O service valida que a conta e a categoria pertencem ao usuário antes de inserir.

## Extratos (upload + importação)

- `POST /extracts` (multipart `file`, `account_id?`): grava o arquivo no R2 (`fileKey`), registra o extrato e, para **CSV/OFX**, devolve os lançamentos parseados já com sugestão de categoria.
- `POST /extracts/:id/import` (JSON `{ account_id, entries }`): efetiva as transações (o cliente pode revisar/ajustar categorias antes). Marca o extrato como `imported`.
- **PDF não é parseado** (inviável de forma confiável em um Worker): é apenas armazenado com `status: 'pending'`. Não escreva um parser de PDF "de fachada".

## Relatórios

`GET /reports/{summary,by-category,by-account,cashflow,goals}`, todos aceitam `?from=&to=` (datas ISO). Cálculos em centavos; formate só na borda com `formatBRL`.

## Validação (Zod)

- Um arquivo por tabela em `src/schemas/` (`<tabela>.schema.ts`), reexportados por `src/schemas/index.ts`.
- Cada arquivo expõe `create<Entidade>Schema`, `update<Entidade>Schema` (parcial via `.partial()`) e os tipos inferidos (`z.infer`).
- Campos auto-gerados (`id`, `criado_em`, `atualizado_em`) e o `user_id` **não** entram nos schemas de criação.
- Use a API top-level do Zod v4: `z.email()`, `z.cuid2()`, `z.coerce.date()` (e não os métodos encadeados depreciados de string).
- Mensagens de erro em **português**.

## Erros

Lance as classes de `src/errors/errors.ts` (`AppError`, `NotFoundError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `BadRequestError`). O `errorHandler` global formata `ZodError` e `AppError` como `{ error: { code, message } }`.

## Testes

- `pnpm test` (Vitest, `test/*.test.ts`). Cobrem a lógica pura: `money`, `statementParser`, `categoryRules`, `password`, `jwt`, `goalProgress`.
- Regras de negócio que dependem de D1/R2 não são cobertas por testes de unidade aqui; ao adicionar cobertura de rotas, considere `@cloudflare/vitest-pool-workers`.

## Convenções

- Módulos ESM, TypeScript `strict`, JSX via `hono/jsx`.
- Indentação de 4 espaços nos arquivos existentes.
- Rotas e controllers novos usam o tipo `AppEnv` de `src/types.ts`.

## Configuração de ambiente

- `wrangler.json`: binding D1 `DB`, binding R2 `BUCKET`, e `vars.JWT_SECRET` (valor **apenas de dev** — em produção use `wrangler secret put JWT_SECRET`).
- Antes de rodar localmente é preciso (comandos que o USUÁRIO executa): gerar/aplicar a migration, criar o bucket R2 (`minhas-financas-extratos`) e opcionalmente aplicar o `seed.sql`.

## Pontos de atenção conhecidos

- A migration em `migrations/` está **desatualizada** em relação a `schema.ts` (nomes/colunas de `categoria`, `extrato`, `meta`, `transacao`). É preciso regerar (`db:generate`) e aplicar antes de usar.
- `cors()` está aberto a qualquer origem — adequado a dev; restrinja em produção.
- `better-sqlite3` ainda consta nas dependências, mas não é usado (o acesso é 100% via D1). Pode ser removido em uma limpeza futura.
