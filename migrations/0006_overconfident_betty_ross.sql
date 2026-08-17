CREATE INDEX `conta_scope_idx` ON `conta` (`organizacao_id`,`cliente_id`);--> statement-breakpoint
CREATE INDEX `categoria_scope_idx` ON `categoria` (`organizacao_id`,`cliente_id`);--> statement-breakpoint
CREATE INDEX `cliente_org_idx` ON `cliente` (`organizacao_id`);--> statement-breakpoint
CREATE INDEX `extrato_scope_idx` ON `extrato` (`organizacao_id`,`cliente_id`);--> statement-breakpoint
CREATE INDEX `meta_scope_idx` ON `meta` (`organizacao_id`,`cliente_id`);--> statement-breakpoint
CREATE INDEX `log_auditoria_org_data_idx` ON `log_auditoria` (`organizacao_id`,`criado_em`);--> statement-breakpoint
CREATE INDEX `log_auditoria_entidade_idx` ON `log_auditoria` (`organizacao_id`,`entidade`,`entidade_id`);--> statement-breakpoint
CREATE INDEX `transacao_scope_data_idx` ON `transacao` (`organizacao_id`,`cliente_id`,`data`);