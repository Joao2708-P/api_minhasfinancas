CREATE TABLE `funcionario` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`nome` text NOT NULL,
	`cpf` text NOT NULL,
	`cargo` text,
	`salario_base` integer NOT NULL,
	`data_admissao` integer NOT NULL,
	`data_demissao` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `funcionario_scope_idx` ON `funcionario` (`organizacao_id`,`cliente_id`);--> statement-breakpoint
CREATE TABLE `parceiro` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`nome` text NOT NULL,
	`documento` text,
	`tipo` text NOT NULL,
	`email` text,
	`telefone` text,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `parceiro_scope_idx` ON `parceiro` (`organizacao_id`,`cliente_id`);--> statement-breakpoint
CREATE TABLE `socio` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`nome` text NOT NULL,
	`cpf` text NOT NULL,
	`percentual_participacao` real NOT NULL,
	`data_entrada` integer NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `socio_scope_idx` ON `socio` (`organizacao_id`,`cliente_id`);