# Changelog — Metria Finanças (API)

Registro de cada alteração de schema/comportamento, mais recente no topo.
Convenção: cada migration = uma preocupação isolada (facilita reverter e reconciliar remoto).

---

## Rebrand → "Metria Finanças"
- Strings visíveis trocadas de "Minhas Finanças" para "Metria Finanças": `<title>` do front,
  wordmarks (Menu/Login/ContextBar/Logo alt), `EMAIL_FROM` (`wrangler.json` + default em `lib/email.ts`),
  root da API (`GET /` name).
- **NÃO** alterados (identificadores de infra — trocá-los quebraria deploy): worker `minhas-financas-api`,
  D1 `minhas_financas`, bucket `minhas-financas-extratos`, projeto Pages `minhas-financas-app`.
- Pendente (asset de imagem, não editável por código): `public/logo-light.png` / `logo-dark.png`.

## Fase 4 — Contas a pagar/receber + conciliação (migration `0008`, branch `feature/fase-4-contas-pagar-receber`)
- Tabela ÚNICA `conta_programada` com `direcao` (payable/receivable) em vez de duas tabelas espelho
  (metade do código). Campos: valor (centavos), vencimento, parceiro_id/categoria_id (set null),
  status (pending/paid/overdue/canceled, **EN**), transacao_id (baixa), recorrencia (once/monthly/weekly).
  Índices de escopo + vencimento. `conta_contabil_id` omitido (plano de contas é Fase 1).
- CRUD (`/scheduled`, filtros `?direction/status/from/to`) + **baixa/conciliação** `POST /scheduled/:id/settle`
  (marca paga, vincula a transação — validada no mesmo tenant). `overdue` é DERIVADO na leitura
  (pendente + vencido), sem cron. Tudo auditado (`recordAudit`).
- Verificado e2e: criar vencida → overdue=true; settle com transação de outro tenant → 403; settle
  com transação real → paid + vínculo; /audit registra.
- **Falta na Fase 4 (próximos commits/chunks):** fluxo de caixa projetado (somar pendentes às datas
  futuras no /reports/cashflow), sugestão de conciliação automática (casar valor+janela de data), e o front.

## Deploy de HOMOLOGAÇÃO (feito)
- D1 remoto reconciliado (marcada a 0004 no tracker) e migrations 0004–0007 aplicadas.
- Worker: https://minhas-financas-api.minhasfinancasapi.workers.dev (`wrangler deploy --minify`; segredos já existiam; `COOKIE_SAMESITE=None` adicionado ao wrangler.json).
- Front (Pages, produção): https://minhas-financas-app.pages.dev (build com `.env.production` → `VITE_API_URL` do worker; `pages deploy --branch main`).
- Verificado: Pages 200 + title "Metria Finanças"; CORS libera o front com credenciais; login remoto responde.
- Cookie `SameSite=None` é paliativo (Safari/terceiros) até subir domínio próprio.

## Gestão de Equipe (membros da org) — sem migration
Endpoint novo **`POST /membros/invite`** (gated `org:manage_members`) para o dono montar a equipe:
- E-mail JÁ existente → só cria o vínculo (membro). E-mail NOVO → cria a conta (name+cpf obrigatórios)
  + o vínculo num `db.batch` atômico e envia convite. A conta nasce com `mustReset=false` → a senha
  devolvida **já loga** (mesmo padrão do `clienteService.createAccess`; verificado: invite-new → login retorna token).
- Reativa membro `revoked` em vez de dar 500. Papel 'owner' não é criável por aqui.
- **Blindagem de privilégio** no `PATCH /membros/:id`: só um `owner` pode conceder o papel de owner ou
  alterar/revogar um owner (admin, que também tem `org:manage_members`, não consegue se auto-promover).
  `membroService.update` recebe `actorRole` do contexto.
- `addByEmail`/`POST /membros` antigos mantidos intactos (nada os usava; não repurposei).

## Fase 3 — Cadastros: parceiro, funcionário, sócio (migration `0007`)
Três tabelas novas, escopadas por `organizacao_id + cliente_id` (mesmo padrão dos dados financeiros),
cada uma com índice de escopo:
- `parceiro` (fornecedor/cliente do NEGÓCIO do cliente; `tipo` cliente/fornecedor/ambos em PT = domínio).
- `funcionario` (`status` active/terminated em **EN** — decisão de padronização; `salario_base` em centavos).
- `socio` (`percentual_participacao` real, 0.5 = 50%).

CRUD completo para os três: `schemas/`, `services/` (com `recordAudit` em create/update/delete desde o início),
`controllers/`, `routes/`. Rotas sob o grupo `scoped` (X-Org-Id + X-Cliente-Id), gated por `finance:read`/`finance:write`:
- `/partners` (parceiro), `/employees` (funcionário), `/shareholders` (sócio).
NÃO inclui contas a pagar/receber (isso é **Fase 4** — carrega conciliação/`transaction_id`, fatia própria).
NÃO inclui `conta_contabil_id` (plano de contas é Fase 1, ainda não existe).

**Verificado end-to-end (curl no servidor dev):** login → org → cliente → POST /partners (201) →
GET /partners (lê de volta) → GET /audit (trilha registrada, com timestamp preservado no snapshot).

## Hardening de índices (migration `0006`)
Índices adicionados (aditivo, não-destrutivo) para as queries reais de tenant:
- `conta`/`categoria`/`meta`/`extrato`: `(organizacao_id, cliente_id)` — filtro de escopo de todo list/get.
- `transacao`: `(organizacao_id, cliente_id, data)` — cobre filtro + ordenação por data desc de `listByScope`.
- `cliente`: `(organizacao_id)` — listagem por org.
- `log_auditoria`: `(organizacao_id, criado_em)` (leitura ordenada) e `(organizacao_id, entidade, entidade_id)` (filtro).

Não mexi em: `account.balance` nullable (código já trata `?? 0`; deixar assim evita migração de dado),
`transaction.account_id` nullable (import sem conta), `category.type` texto livre (não virou enum p/ não
quebrar dados). Documentado para revisão futura.

## Fase 2 — Log de auditoria + permissões configuráveis (migration `0005`)
- Tabelas `log_auditoria`, `papel`, `papel_permissao`; coluna `membro.papel_customizado_id` (nullable).
- Ver detalhes em `task-modulo-contabil-completo.md` e nos comentários do `schema.ts`.

---

## Convenção de valores de status (DECISÃO PENDENTE DE RATIFICAÇÃO)

O sistema tem **valores de status em idiomas misturados**:
- **EN**: `membro.status` (active/invited/revoked), `organizacao.status` (active/suspended),
  `organizacao.billing_status` (trial/active/past_due), `extract.status` (pending/parsed/imported/error).
- **PT**: `cliente.status` (ativo/arquivado), `log_auditoria.acao` (criado/atualizado/excluido).

**Direção escolhida para NÃO gerar mais drift: EN para status de ciclo de vida.**
Enums de *domínio* (não-status) podem ficar em PT como vocabulário de negócio
(ex.: `transaction.type` in/out é EN; `parceiro.tipo` cliente/fornecedor/ambos fica PT).

Padronizar os outliers PT existentes (`cliente.status`, `log_auditoria.acao`) é **migração de dado
destrutiva** (renomeia valores em linhas existentes) — **fica pendente do seu OK**, não foi feito.
