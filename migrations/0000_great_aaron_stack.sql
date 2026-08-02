CREATE TABLE `conta` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text,
	`tipo_de_conta_id` text,
	`nome` text NOT NULL,
	`banco` text,
	`saldo` integer,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tipo_de_conta_id`) REFERENCES `tipo_conta`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `tipo_conta` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`descricao` text NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tipo_conta_nome_unique` ON `tipo_conta` (`nome`);--> statement-breakpoint
CREATE TABLE `catgoria` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text,
	`nome` text NOT NULL,
	`tipo` text NOT NULL,
	`icone` text,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `extrato` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text,
	`extrato` text NOT NULL,
	`enviado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`id` text PRIMARY KEY NOT NULL,
	`usario_id` text,
	`nome` text NOT NULL,
	`valor_alvo` integer NOT NULL,
	`valor_atual` integer NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`usario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transacao` (
	`id` text PRIMARY KEY NOT NULL,
	`conta_id` text,
	`categoria_id` text,
	`descricao` text,
	`valor` integer NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`conta_id`) REFERENCES `conta`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`categoria_id`) REFERENCES `catgoria`(`id`) ON UPDATE no action ON DELETE set default
);
--> statement-breakpoint
CREATE TABLE `usuario` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`senha` text NOT NULL,
	`cpf` text NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_email_unique` ON `usuario` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_cpf_unique` ON `usuario` (`cpf`);