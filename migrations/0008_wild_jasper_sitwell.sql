CREATE TABLE `conta_programada` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`direcao` text NOT NULL,
	`descricao` text NOT NULL,
	`valor` integer NOT NULL,
	`vencimento` integer NOT NULL,
	`parceiro_id` text,
	`categoria_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`transacao_id` text,
	`recorrencia` text DEFAULT 'once' NOT NULL,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`atualizado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organizacao_id`) REFERENCES `organizacao`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parceiro_id`) REFERENCES `parceiro`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`categoria_id`) REFERENCES `categoria`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transacao_id`) REFERENCES `transacao`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `conta_programada_scope_idx` ON `conta_programada` (`organizacao_id`,`cliente_id`,`direcao`);--> statement-breakpoint
CREATE INDEX `conta_programada_venc_idx` ON `conta_programada` (`organizacao_id`,`cliente_id`,`vencimento`);