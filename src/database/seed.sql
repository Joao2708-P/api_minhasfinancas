-- Dados de amostra para a API Minhas Finanças.
-- Aplique com:
--   wrangler d1 execute minhas_financas --local --file=./src/database/seed.sql
-- (troque --local por --remote para o banco de produção)
--
-- Usuário de teste:  email = joao.teste@minhasfinancas.dev  |  senha = senha12345
-- O hash abaixo é PBKDF2-SHA256 (100k iterações), compatível com src/lib/password.ts.
-- É idempotente: limpa os registros deste usuário antes de reinserir.

DELETE FROM transacao WHERE usuario_id = 'yf5x9iwioqdr3vktrbrg53o6';
DELETE FROM meta      WHERE usuario_id = 'yf5x9iwioqdr3vktrbrg53o6';
DELETE FROM extrato   WHERE usuario_id = 'yf5x9iwioqdr3vktrbrg53o6';
DELETE FROM conta     WHERE usuario_id = 'yf5x9iwioqdr3vktrbrg53o6';
DELETE FROM categoria WHERE usuario_id = 'yf5x9iwioqdr3vktrbrg53o6';
DELETE FROM tipo_conta WHERE id IN ('qv0wx0xnmgl19d9vvg5ttvyn', 'h8knrz7h6susdduz09qiig6b');
DELETE FROM usuario   WHERE id = 'yf5x9iwioqdr3vktrbrg53o6';

-- Usuário -------------------------------------------------------------------
INSERT INTO usuario (id, nome, email, senha, cpf) VALUES
('yf5x9iwioqdr3vktrbrg53o6', 'João Teste', 'joao.teste@minhasfinancas.dev',
 'afc7040c92ab289fa22e2039370db1ef:84881cfe7dcf886eb562ba4104a3d5f77f4a2ff17761d57abe4631cfee655ed8',
 '12345678901');

-- Tipos de conta ------------------------------------------------------------
INSERT INTO tipo_conta (id, nome, descricao) VALUES
('qv0wx0xnmgl19d9vvg5ttvyn', 'Conta Corrente', 'Conta corrente para o dia a dia'),
('h8knrz7h6susdduz09qiig6b', 'Poupança', 'Conta poupança para reservas');

-- Contas (saldo = saldo de abertura, em centavos) ---------------------------
INSERT INTO conta (id, usuario_id, tipo_de_conta_id, nome, banco, saldo) VALUES
('sx2hjj7gc7pfx53ee7k4kmj1', 'yf5x9iwioqdr3vktrbrg53o6', 'qv0wx0xnmgl19d9vvg5ttvyn', 'Conta Nubank', 'Nubank', 100000),
('gvkr2f3v69ffr5oe98su4xch', 'yf5x9iwioqdr3vktrbrg53o6', 'h8knrz7h6susdduz09qiig6b', 'Poupança CEF', 'Caixa', 500000);

-- Categorias (tipo: in = entrada, out = saída) ------------------------------
INSERT INTO categoria (id, usuario_id, nome, tipo, icone, cor) VALUES
('hlmywk1fsbx4pxwx8tndwj1f', 'yf5x9iwioqdr3vktrbrg53o6', 'Salário',    'in',  'wallet', '#22c55e'),
('g46j7b8xmu1y7jzs9qafnchi', 'yf5x9iwioqdr3vktrbrg53o6', 'Mercado',    'out', 'cart',   '#ef4444'),
('n3rkb4la3ihehtfyorvk05z4', 'yf5x9iwioqdr3vktrbrg53o6', 'Transporte', 'out', 'car',    '#f59e0b'),
('gxkdd649dmaqgo9mnwrnkrv4', 'yf5x9iwioqdr3vktrbrg53o6', 'Lazer',      'out', 'movie',  '#8b5cf6'),
('pb92lnu8jog1p5wm7f97364f', 'yf5x9iwioqdr3vktrbrg53o6', 'Moradia',    'out', 'home',   '#3b82f6');

-- Transações (valor sempre positivo; o sinal vem de `tipo`) -----------------
INSERT INTO transacao (id, usuario_id, conta_id, categoria_id, tipo, descricao, valor, data) VALUES
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'hlmywk1fsbx4pxwx8tndwj1f', 'in',  'Salário de maio',    500000, strftime('%s','2026-05-05')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'pb92lnu8jog1p5wm7f97364f', 'out', 'Aluguel maio',       150000, strftime('%s','2026-05-06')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'g46j7b8xmu1y7jzs9qafnchi', 'out', 'Compras no mercado',  35050, strftime('%s','2026-05-10')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'n3rkb4la3ihehtfyorvk05z4', 'out', 'Combustível',         12000, strftime('%s','2026-05-12')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'gxkdd649dmaqgo9mnwrnkrv4', 'out', 'Cinema',               8000, strftime('%s','2026-05-20')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'gvkr2f3v69ffr5oe98su4xch', 'hlmywk1fsbx4pxwx8tndwj1f', 'in',  'Depósito poupança',  100000, strftime('%s','2026-05-25')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'hlmywk1fsbx4pxwx8tndwj1f', 'in',  'Salário de junho',   500000, strftime('%s','2026-06-05')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'pb92lnu8jog1p5wm7f97364f', 'out', 'Aluguel junho',      150000, strftime('%s','2026-06-06')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'g46j7b8xmu1y7jzs9qafnchi', 'out', 'Compras no mercado',  42030, strftime('%s','2026-06-08')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'n3rkb4la3ihehtfyorvk05z4', 'out', 'Uber',                 9500, strftime('%s','2026-06-11')),
(lower(hex(randomblob(12))), 'yf5x9iwioqdr3vktrbrg53o6', 'sx2hjj7gc7pfx53ee7k4kmj1', 'gxkdd649dmaqgo9mnwrnkrv4', 'out', 'Show',                15000, strftime('%s','2026-06-18'));

-- Meta ----------------------------------------------------------------------
INSERT INTO meta (id, usuario_id, nome, valor_alvo, valor_atual, prazo, cor) VALUES
('ld6y4jls3mavcjgdgkxfk4nv', 'yf5x9iwioqdr3vktrbrg53o6', 'Viagem de férias', 1000000, 250000, strftime('%s','2026-12-31'), '#06b6d4');
