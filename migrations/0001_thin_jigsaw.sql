CREATE TABLE `categoria` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text,
	`nome` text NOT NULL,
	`tipo` text NOT NULL,
	`icone` text,
	`cor` text,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
DROP TABLE `catgoria`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_meta` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text,
	`nome` text NOT NULL,
	`valor_alvo` integer NOT NULL,
	`valor_atual` integer NOT NULL,
	`prazo` integer NOT NULL,
	`cor` text,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_meta`("id", "usuario_id", "nome", "valor_alvo", "valor_atual", "prazo", "cor", "criado_em", "atualizado_em") SELECT "id", "usuario_id", "nome", "valor_alvo", "valor_atual", "prazo", "cor", "criado_em", "atualizado_em" FROM `meta`;--> statement-breakpoint
DROP TABLE `meta`;--> statement-breakpoint
ALTER TABLE `__new_meta` RENAME TO `meta`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_transacao` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text,
	`conta_id` text,
	`categoria_id` text,
	`tipo` text NOT NULL,
	`descricao` text,
	`valor` integer NOT NULL,
	`data` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conta_id`) REFERENCES `conta`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`categoria_id`) REFERENCES `categoria`(`id`) ON UPDATE no action ON DELETE set default
);
--> statement-breakpoint
INSERT INTO `__new_transacao`("id", "usuario_id", "conta_id", "categoria_id", "tipo", "descricao", "valor", "data", "criado_em", "atualizado_em") SELECT "id", "usuario_id", "conta_id", "categoria_id", "tipo", "descricao", "valor", "data", "criado_em", "atualizado_em" FROM `transacao`;--> statement-breakpoint
DROP TABLE `transacao`;--> statement-breakpoint
ALTER TABLE `__new_transacao` RENAME TO `transacao`;--> statement-breakpoint
CREATE TABLE `__new_extrato` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`conta_id` text,
	`arquivo_key` text NOT NULL,
	`nome_original` text,
	`formato` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`qtd_importada` integer DEFAULT 0 NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conta_id`) REFERENCES `conta`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_extrato`("id", "usuario_id", "conta_id", "arquivo_key", "nome_original", "formato", "status", "qtd_importada", "criado_em", "atualizado_em") SELECT "id", "usuario_id", "conta_id", "arquivo_key", "nome_original", "formato", "status", "qtd_importada", "criado_em", "atualizado_em" FROM `extrato`;--> statement-breakpoint
DROP TABLE `extrato`;--> statement-breakpoint
ALTER TABLE `__new_extrato` RENAME TO `extrato`;