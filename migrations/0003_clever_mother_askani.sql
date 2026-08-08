CREATE TABLE `codigo_acesso` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`codigo_hash` text NOT NULL,
	`proposito` text NOT NULL,
	`expira_em` integer NOT NULL,
	`usado_em` integer,
	`criado_em` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `organizacao` ADD `status_pagamento` text DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizacao` ADD `pago_ate` integer;--> statement-breakpoint
ALTER TABLE `usuario` ADD `deve_redefinir` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `usuario` ADD `admin_plataforma` integer DEFAULT false NOT NULL;