CREATE TABLE `log_auditoria` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text,
	`usuario_id` text NOT NULL,
	`acao` text NOT NULL,
	`entidade` text NOT NULL,
	`entidade_id` text NOT NULL,
	`dados_antes` text,
	`dados_depois` text,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `papel` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`nome` text NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `papel_org_nome_unico` ON `papel` (`organizacao_id`,`nome`);--> statement-breakpoint
CREATE TABLE `papel_permissao` (
	`papel_id` text NOT NULL,
	`chave_permissao` text NOT NULL,
	PRIMARY KEY(`papel_id`, `chave_permissao`),
	FOREIGN KEY (`papel_id`) REFERENCES `papel`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `membro` ADD `papel_customizado_id` text REFERENCES papel(id);