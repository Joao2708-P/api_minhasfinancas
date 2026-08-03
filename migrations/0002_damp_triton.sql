CREATE TABLE `cliente` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`usuario_id` text,
	`responsavel_id` text,
	`nome` text NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`responsavel_id`) REFERENCES `membro`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `membro` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`papel` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membro_org_user_unico` ON `membro` (`organizacao_id`,`usuario_id`);--> statement-breakpoint
CREATE TABLE `organizacao` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`dono_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`nome_marca` text,
	`logo_key` text,
	`cor_primaria` text,
	`subdominio` text,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`dono_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizacao_subdominio_unique` ON `organizacao` (`subdominio`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_conta` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`tipo_de_conta_id` text,
	`nome` text NOT NULL,
	`banco` text,
	`saldo` integer,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tipo_de_conta_id`) REFERENCES `tipo_conta`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_conta`("id", "organizacao_id", "cliente_id", "tipo_de_conta_id", "nome", "banco", "saldo", "criado_em", "atualizado_em") SELECT "id", "organizacao_id", "cliente_id", "tipo_de_conta_id", "nome", "banco", "saldo", "criado_em", "atualizado_em" FROM `conta`;--> statement-breakpoint
DROP TABLE `conta`;--> statement-breakpoint
ALTER TABLE `__new_conta` RENAME TO `conta`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_categoria` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`nome` text NOT NULL,
	`tipo` text NOT NULL,
	`icone` text,
	`cor` text,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_categoria`("id", "organizacao_id", "cliente_id", "nome", "tipo", "icone", "cor", "criado_em", "atualizado_em") SELECT "id", "organizacao_id", "cliente_id", "nome", "tipo", "icone", "cor", "criado_em", "atualizado_em" FROM `categoria`;--> statement-breakpoint
DROP TABLE `categoria`;--> statement-breakpoint
ALTER TABLE `__new_categoria` RENAME TO `categoria`;--> statement-breakpoint
CREATE TABLE `__new_extrato` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`conta_id` text,
	`arquivo_key` text NOT NULL,
	`nome_original` text,
	`formato` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`qtd_importada` integer DEFAULT 0 NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conta_id`) REFERENCES `conta`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_extrato`("id", "organizacao_id", "cliente_id", "conta_id", "arquivo_key", "nome_original", "formato", "status", "qtd_importada", "criado_em", "atualizado_em") SELECT "id", "organizacao_id", "cliente_id", "conta_id", "arquivo_key", "nome_original", "formato", "status", "qtd_importada", "criado_em", "atualizado_em" FROM `extrato`;--> statement-breakpoint
DROP TABLE `extrato`;--> statement-breakpoint
ALTER TABLE `__new_extrato` RENAME TO `extrato`;--> statement-breakpoint
CREATE TABLE `__new_meta` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`nome` text NOT NULL,
	`valor_alvo` integer NOT NULL,
	`valor_atual` integer NOT NULL,
	`prazo` integer NOT NULL,
	`cor` text,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_meta`("id", "organizacao_id", "cliente_id", "nome", "valor_alvo", "valor_atual", "prazo", "cor", "criado_em", "atualizado_em") SELECT "id", "organizacao_id", "cliente_id", "nome", "valor_alvo", "valor_atual", "prazo", "cor", "criado_em", "atualizado_em" FROM `meta`;--> statement-breakpoint
DROP TABLE `meta`;--> statement-breakpoint
ALTER TABLE `__new_meta` RENAME TO `meta`;--> statement-breakpoint
CREATE TABLE `__new_transacao` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`conta_id` text,
	`categoria_id` text,
	`tipo` text NOT NULL,
	`descricao` text,
	`valor` integer NOT NULL,
	`data` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conta_id`) REFERENCES `conta`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`categoria_id`) REFERENCES `categoria`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transacao`("id", "organizacao_id", "cliente_id", "conta_id", "categoria_id", "tipo", "descricao", "valor", "data", "criado_em", "atualizado_em") SELECT "id", "organizacao_id", "cliente_id", "conta_id", "categoria_id", "tipo", "descricao", "valor", "data", "criado_em", "atualizado_em" FROM `transacao`;--> statement-breakpoint
DROP TABLE `transacao`;--> statement-breakpoint
ALTER TABLE `__new_transacao` RENAME TO `transacao`;