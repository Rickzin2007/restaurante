-- Sabor & Cia - Modelo Lógico (PostgreSQL). Todas as tabelas em 3FN.
CREATE TABLE cliente(
  id SERIAL PRIMARY KEY, nome VARCHAR(100) NOT NULL, telefone VARCHAR(20) NOT NULL,
  email VARCHAR(120) UNIQUE);
-- atributo composto "endereço" + multivalorado => entidade fraca (1:N)
CREATE TABLE endereco_cliente(
  id SERIAL PRIMARY KEY, cliente_id INT NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
  logradouro VARCHAR(120) NOT NULL, numero VARCHAR(10) NOT NULL, bairro VARCHAR(60) NOT NULL,
  cidade VARCHAR(60) NOT NULL, cep VARCHAR(9));
CREATE TABLE mesa(id SERIAL PRIMARY KEY, numero INT NOT NULL UNIQUE CHECK(numero>0));
CREATE TABLE cargo(id SERIAL PRIMARY KEY, nome VARCHAR(40) NOT NULL UNIQUE);
CREATE TABLE funcionario(
  id SERIAL PRIMARY KEY, nome VARCHAR(100) NOT NULL, cpf CHAR(11) NOT NULL UNIQUE,
  telefone VARCHAR(20));
-- entidade associativa: cargo exercido por período
CREATE TABLE funcionario_cargo(
  id SERIAL PRIMARY KEY, funcionario_id INT NOT NULL REFERENCES funcionario(id),
  cargo_id INT NOT NULL REFERENCES cargo(id), data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE, CHECK(data_fim IS NULL OR data_fim>=data_inicio));
CREATE TABLE categoria(id SERIAL PRIMARY KEY, nome VARCHAR(50) NOT NULL UNIQUE);
CREATE TABLE produto(
  id SERIAL PRIMARY KEY, categoria_id INT NOT NULL REFERENCES categoria(id),
  nome VARCHAR(100) NOT NULL UNIQUE, preco_base NUMERIC(10,2) NOT NULL CHECK(preco_base>=0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE variacao(
  id SERIAL PRIMARY KEY, produto_id INT NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
  nome VARCHAR(60) NOT NULL, acrescimo NUMERIC(10,2) NOT NULL DEFAULT 0, UNIQUE(produto_id,nome));
CREATE TABLE adicional(
  id SERIAL PRIMARY KEY, nome VARCHAR(60) NOT NULL UNIQUE, preco NUMERIC(10,2) NOT NULL CHECK(preco>=0));
CREATE TABLE produto_adicional(  -- N:N
  produto_id INT REFERENCES produto(id) ON DELETE CASCADE,
  adicional_id INT REFERENCES adicional(id) ON DELETE CASCADE, PRIMARY KEY(produto_id,adicional_id));
CREATE TABLE combo(
  id SERIAL PRIMARY KEY, nome VARCHAR(100) NOT NULL UNIQUE,
  preco NUMERIC(10,2) NOT NULL CHECK(preco>=0), ativo BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE combo_produto(  -- N:N
  combo_id INT REFERENCES combo(id) ON DELETE CASCADE, produto_id INT REFERENCES produto(id),
  quantidade INT NOT NULL DEFAULT 1 CHECK(quantidade>0), PRIMARY KEY(combo_id,produto_id));
CREATE TABLE fornecedor(
  id SERIAL PRIMARY KEY, nome VARCHAR(100) NOT NULL, telefone VARCHAR(20));
CREATE TABLE ingrediente(
  id SERIAL PRIMARY KEY, fornecedor_id INT NOT NULL REFERENCES fornecedor(id),
  nome VARCHAR(80) NOT NULL UNIQUE, unidade VARCHAR(10) NOT NULL CHECK(unidade IN('kg','l','un')),
  qtd_estoque NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK(qtd_estoque>=0));
CREATE TABLE produto_ingrediente(  -- N:N com atributo (quantidade)
  produto_id INT REFERENCES produto(id) ON DELETE CASCADE,
  ingrediente_id INT REFERENCES ingrediente(id), quantidade NUMERIC(12,3) NOT NULL CHECK(quantidade>0),
  PRIMARY KEY(produto_id,ingrediente_id));
CREATE TABLE promocao(
  id SERIAL PRIMARY KEY, nome VARCHAR(100) NOT NULL, data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL, CHECK(data_fim>=data_inicio));
CREATE TABLE promocao_produto(  -- N:N; histórico preservado (promoções não são apagadas)
  promocao_id INT REFERENCES promocao(id), produto_id INT REFERENCES produto(id),
  preco_promocional NUMERIC(10,2) NOT NULL CHECK(preco_promocional>=0), PRIMARY KEY(promocao_id,produto_id));
CREATE TABLE cupom(
  id SERIAL PRIMARY KEY, codigo VARCHAR(30) NOT NULL UNIQUE, tipo VARCHAR(10) NOT NULL CHECK(tipo IN('valor','percentual')),
  valor NUMERIC(10,2) NOT NULL CHECK(valor>0), validade_inicio DATE NOT NULL, validade_fim DATE NOT NULL,
  CHECK(validade_fim>=validade_inicio));
CREATE TABLE pedido(
  id SERIAL PRIMARY KEY,
  cliente_id INT REFERENCES cliente(id),            -- NULL = balcão anônimo
  atendente_id INT NOT NULL REFERENCES funcionario(id),
  mesa_id INT REFERENCES mesa(id),                   -- NULL = retirada/delivery
  entregador_id INT REFERENCES funcionario(id),
  endereco_id INT REFERENCES endereco_cliente(id),
  cupom_id INT REFERENCES cupom(id),
  canal VARCHAR(10) NOT NULL CHECK(canal IN('balcao','telefone','aplicativo')),
  tipo VARCHAR(10) NOT NULL CHECK(tipo IN('local','retirada','delivery')),
  taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(taxa_entrega>=0),
  desconto NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(desconto>=0),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status_atual VARCHAR(20) NOT NULL DEFAULT 'recebido',
  criado_em TIMESTAMP NOT NULL DEFAULT now(),
  CHECK(tipo<>'local' OR mesa_id IS NOT NULL),
  CHECK(tipo<>'delivery' OR (cliente_id IS NOT NULL AND endereco_id IS NOT NULL AND entregador_id IS NOT NULL)),
  CHECK(canal<>'aplicativo' OR cliente_id IS NOT NULL));
CREATE TABLE cupom_uso(  -- garante "uma vez por cliente"
  cupom_id INT REFERENCES cupom(id), cliente_id INT REFERENCES cliente(id),
  pedido_id INT NOT NULL REFERENCES pedido(id), PRIMARY KEY(cupom_id,cliente_id));
CREATE TABLE item_pedido(
  id SERIAL PRIMARY KEY, pedido_id INT NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
  produto_id INT REFERENCES produto(id), combo_id INT REFERENCES combo(id),
  variacao_id INT REFERENCES variacao(id), quantidade INT NOT NULL CHECK(quantidade>0),
  preco_unitario NUMERIC(10,2) NOT NULL, observacao VARCHAR(200),
  CHECK((produto_id IS NOT NULL)::int + (combo_id IS NOT NULL)::int = 1));
CREATE TABLE item_pedido_adicional(
  item_id INT REFERENCES item_pedido(id) ON DELETE CASCADE, adicional_id INT REFERENCES adicional(id),
  preco NUMERIC(10,2) NOT NULL, PRIMARY KEY(item_id,adicional_id));
CREATE TABLE pagamento(
  id SERIAL PRIMARY KEY, pedido_id INT NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
  forma VARCHAR(15) NOT NULL CHECK(forma IN('dinheiro','credito','debito','pix')),
  valor NUMERIC(10,2) NOT NULL CHECK(valor>0));
CREATE TABLE pedido_status_historico(
  id SERIAL PRIMARY KEY, pedido_id INT NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK(status IN('recebido','em preparo','pronto','saiu para entrega','entregue/retirado','cancelado')),
  alterado_em TIMESTAMP NOT NULL DEFAULT now());
CREATE TABLE avaliacao(
  pedido_id INT PRIMARY KEY REFERENCES pedido(id) ON DELETE CASCADE,  -- 1:1 opcional
  nota SMALLINT NOT NULL CHECK(nota BETWEEN 1 AND 5), comentario VARCHAR(300),
  criada_em TIMESTAMP NOT NULL DEFAULT now());
CREATE INDEX ix_pedido_cliente ON pedido(cliente_id);
CREATE INDEX ix_pedido_criado ON pedido(criado_em);
CREATE INDEX ix_item_pedido ON item_pedido(pedido_id);
CREATE INDEX ix_hist_pedido ON pedido_status_historico(pedido_id,alterado_em);

-- Dados iniciais
INSERT INTO categoria(nome) VALUES('Lanches'),('Bebidas'),('Porções'),('Sobremesas');
INSERT INTO cargo(nome) VALUES('Atendente'),('Cozinheiro'),('Entregador'),('Gerente');
INSERT INTO mesa(numero) SELECT generate_series(1,8);
INSERT INTO fornecedor(nome,telefone) VALUES('Frigorífico Boa Carne','6133330001'),('Distribuidora Bebidas DF','6133330002');
INSERT INTO ingrediente(fornecedor_id,nome,unidade,qtd_estoque) VALUES
 (1,'Pão de hambúrguer','un',100),(1,'Carne bovina 150g','un',80),(1,'Queijo prato','kg',10),(2,'Refrigerante lata','un',120);
INSERT INTO produto(categoria_id,nome,preco_base) VALUES(1,'X-Burger',22.00),(1,'X-Bacon',27.00),(2,'Refrigerante lata',6.00);
INSERT INTO produto_ingrediente VALUES(1,1,1),(1,2,1),(1,3,0.03),(2,1,1),(2,2,1),(2,3,0.03),(3,4,1);
INSERT INTO variacao(produto_id,nome,acrescimo) VALUES(1,'Pequeno',0),(1,'Grande',6),(2,'Grande',6);
INSERT INTO adicional(nome,preco) VALUES('Bacon extra',4),('Queijo extra',3);
INSERT INTO produto_adicional VALUES(1,1),(1,2),(2,2);
INSERT INTO combo(nome,preco) VALUES('Combo X-Burger + Refri',25.00);
INSERT INTO combo_produto VALUES(1,1,1),(1,3,1);
INSERT INTO funcionario(nome,cpf) VALUES('Ana Atendente','11111111111'),('Beto Entregador','22222222222');
INSERT INTO funcionario_cargo(funcionario_id,cargo_id) VALUES(1,1),(2,3);
INSERT INTO cliente(nome,telefone,email) VALUES('Carla Souza','61999990000','carla@email.com');
INSERT INTO endereco_cliente(cliente_id,logradouro,numero,bairro,cidade) VALUES(1,'Rua das Flores','10','Asa Sul','Brasília');
INSERT INTO cupom(codigo,tipo,valor,validade_inicio,validade_fim) VALUES('BEMVINDO10','percentual',10,'2026-01-01','2026-12-31');
