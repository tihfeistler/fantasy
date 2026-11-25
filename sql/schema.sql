-- Fantasy: schema MySQL/MariaDB (testado em MariaDB 10.11, o mesmo do XAMPP)
CREATE DATABASE IF NOT EXISTS fantasy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fantasy;

CREATE TABLE IF NOT EXISTS clubes (
  id              VARCHAR(64)  PRIMARY KEY,
  nome            VARCHAR(100) NOT NULL,
  sigla           VARCHAR(5)   NOT NULL,
  cor             CHAR(7)      NOT NULL DEFAULT '#888888',
  cor_secundaria  CHAR(7)      NULL,
  liga            VARCHAR(64)  NULL,
  nivel           TINYINT UNSIGNED NULL
) ENGINE=InnoDB;

-- Jogadores atuais e clássicos no mesmo formato (docs/FORMATO-JOGADOR.md)
CREATE TABLE IF NOT EXISTS jogadores (
  id              VARCHAR(64)  PRIMARY KEY,
  tipo            ENUM('classico','atual') NOT NULL DEFAULT 'classico',
  nome            VARCHAR(100) NOT NULL,
  nome_completo   VARCHAR(200) NULL,
  nacionalidade   CHAR(3)      NOT NULL,
  posicao         ENUM('GOL','ZAG','LAT','VOL','MEI','ATA') NOT NULL,
  pe              ENUM('D','E','A') NOT NULL DEFAULT 'D',
  epoca_inicio    SMALLINT     NULL,
  epoca_fim       SMALLINT     NULL,
  auge            SMALLINT     NULL,
  clube_marcante  VARCHAR(100) NULL,
  clube_id        VARCHAR(64)  NULL,
  nascimento      DATE         NULL,
  potencial       TINYINT UNSIGNED NULL,
  finalizacao     TINYINT UNSIGNED NOT NULL,
  passe           TINYINT UNSIGNED NOT NULL,
  drible          TINYINT UNSIGNED NOT NULL,
  velocidade      TINYINT UNSIGNED NOT NULL,
  defesa          TINYINT UNSIGNED NOT NULL,
  fisico          TINYINT UNSIGNED NOT NULL,
  mentalidade     TINYINT UNSIGNED NOT NULL,
  goleiro         TINYINT UNSIGNED NOT NULL,
  geral           TINYINT UNSIGNED NOT NULL,
  INDEX idx_tipo_pos (tipo, posicao),
  INDEX idx_clube (clube_id),
  CONSTRAINT fk_jogador_clube FOREIGN KEY (clube_id) REFERENCES clubes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Contas (modo online; senha com password_hash do PHP)
CREATE TABLE IF NOT EXISTS usuarios (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(50)  NOT NULL UNIQUE,
  senha_hash      VARCHAR(255) NOT NULL,
  moedas          INT UNSIGNED NOT NULL DEFAULT 0,
  limite_cartas   SMALLINT UNSIGNED NOT NULL DEFAULT 300, -- lendas que cabem na coleção (até 500)
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Coleção de cartas de lendas de cada usuário
CREATE TABLE IF NOT EXISTS cartas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNSIGNED NOT NULL,
  jogador_id      VARCHAR(64)  NOT NULL,
  obtida_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  origem          ENUM('pacote','objetivo','troca','mercado') NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (jogador_id) REFERENCES jogadores(id)
) ENGINE=InnoDB;

-- Saves da carreira (estado do jogo em JSON)
CREATE TABLE IF NOT EXISTS saves (
  usuario_id      INT UNSIGNED NOT NULL,
  slot            TINYINT UNSIGNED NOT NULL,
  dados           LONGTEXT     NOT NULL,
  atualizado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, slot),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Mercado de cartas entre técnicos (modo online)
-- Regras (docs/DESIGN.md, seção 4): lendas só saem de pacotes ou de
-- outros técnicos; qualquer carta pode ser vendida ao sistema pelo preço
-- básico. Venda entre técnicos paga taxa de 5% (sai do vendedor).
-- ---------------------------------------------------------------------

-- Carta à venda por preço fixo. Uma carta só pode ter um anúncio.
CREATE TABLE IF NOT EXISTS anuncios (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  carta_id        INT UNSIGNED NOT NULL UNIQUE,
  vendedor_id     INT UNSIGNED NOT NULL,
  preco           INT UNSIGNED NOT NULL,
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (carta_id) REFERENCES cartas(id) ON DELETE CASCADE,
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX (preco)
) ENGINE=InnoDB;

-- Proposta de compra por uma carta de outro técnico (anunciada ou não).
-- O dono aceita, recusa ou faz contraproposta (contra_valor); aí quem
-- responde é o comprador.
CREATE TABLE IF NOT EXISTS propostas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  carta_id        INT UNSIGNED NOT NULL,
  comprador_id    INT UNSIGNED NOT NULL,
  valor           INT UNSIGNED NOT NULL,
  contra_valor    INT UNSIGNED NULL,
  status          ENUM('aberta','contraproposta','aceita','recusada','cancelada','expirada') NOT NULL DEFAULT 'aberta',
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  respondida_em   DATETIME     NULL,
  FOREIGN KEY (carta_id) REFERENCES cartas(id) ON DELETE CASCADE,
  FOREIGN KEY (comprador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX (carta_id, status),
  INDEX (comprador_id, status)
) ENGINE=InnoDB;

-- Histórico de vendas (entre técnicos e ao sistema), para preço médio e auditoria.
CREATE TABLE IF NOT EXISTS vendas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jogador_id      VARCHAR(64)  NOT NULL,
  vendedor_id     INT UNSIGNED NOT NULL,
  comprador_id    INT UNSIGNED NULL,          -- NULL = vendida ao sistema
  valor           INT UNSIGNED NOT NULL,
  taxa            INT UNSIGNED NOT NULL DEFAULT 0,
  vendida_em      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (jogador_id, vendida_em)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Ranqueado online (docs/DESIGN.md, seção 7)
-- ---------------------------------------------------------------------

-- Cartas base (jogadores atuais) também ficam em `cartas`: 'kit' é o kit
-- inicial e 'sistema' é compra direta com moedas.
ALTER TABLE cartas MODIFY origem ENUM('pacote','objetivo','troca','mercado','sistema','kit') NOT NULL;

-- Time de cartas online: caixa (R$ mil) e escalação (ids em JSON).
CREATE TABLE IF NOT EXISTS times_online (
  usuario_id      INT UNSIGNED PRIMARY KEY,
  caixa           INT          NOT NULL DEFAULT 2000,
  formacao        VARCHAR(10)  NOT NULL DEFAULT '4-4-2',
  titulares       TEXT         NOT NULL,
  banco           TEXT         NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Perfil de cada temporada: divisão (tier 0 = Bronze IV ... 19 = Diamante I, 20 = Elite),
-- pontos de liga (pdl) e MMR escondido.
CREATE TABLE IF NOT EXISTS ranqueado (
  usuario_id      INT UNSIGNED NOT NULL,
  temporada       INT UNSIGNED NOT NULL,
  tier            TINYINT UNSIGNED NOT NULL DEFAULT 0,
  pdl             INT          NOT NULL DEFAULT 0,
  mmr             INT          NOT NULL DEFAULT 1000,
  vitorias        INT UNSIGNED NOT NULL DEFAULT 0,
  empates         INT UNSIGNED NOT NULL DEFAULT 0,
  derrotas        INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, temporada),
  INDEX (temporada, tier, pdl),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Fila de procura de partida. visto_em é atualizado a cada consulta do cliente.
CREATE TABLE IF NOT EXISTS fila (
  usuario_id      INT UNSIGNED PRIMARY KEY,
  mmr             INT          NOT NULL,
  entrou_em       DATETIME(3)  NOT NULL,
  visto_em        DATETIME(3)  NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Partida ao vivo: o servidor guarda seed, times e decisões e marca o relógio;
-- os dois clientes rodam o mesmo motor determinístico e relatam o placar.
CREATE TABLE IF NOT EXISTS partidas_online (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  temporada       INT UNSIGNED NOT NULL,
  mandante_id     INT UNSIGNED NOT NULL,
  visitante_id    INT UNSIGNED NOT NULL,
  seed            INT UNSIGNED NOT NULL,
  time_mandante   MEDIUMTEXT   NOT NULL,
  time_visitante  MEDIUMTEXT   NOT NULL,
  custo_mandante  INT UNSIGNED NOT NULL,
  custo_visitante INT UNSIGNED NOT NULL,
  inicio          DATETIME(3)  NOT NULL,
  status          ENUM('ao_vivo','encerrada','anulada') NOT NULL DEFAULT 'ao_vivo',
  relato_mandante  VARCHAR(10) NULL,
  relato_visitante VARCHAR(10) NULL,
  gols_mandante   TINYINT UNSIGNED NULL,
  gols_visitante  TINYINT UNSIGNED NULL,
  pdl_mandante    INT          NULL,
  pdl_visitante   INT          NULL,
  finalizada_em   DATETIME     NULL,
  INDEX (mandante_id, status),
  INDEX (visitante_id, status),
  FOREIGN KEY (mandante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (visitante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Tática e substituições enviadas durante o jogo, já com o minuto em que valem.
CREATE TABLE IF NOT EXISTS decisoes_online (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  partida_id      INT UNSIGNED NOT NULL,
  usuario_id      INT UNSIGNED NOT NULL,
  minuto          TINYINT UNSIGNED NOT NULL,
  dados           TEXT         NOT NULL,
  FOREIGN KEY (partida_id) REFERENCES partidas_online(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Amistosos entre amigos e prêmio de fim de temporada (MariaDB: ADD COLUMN IF NOT EXISTS)
ALTER TABLE partidas_online ADD COLUMN IF NOT EXISTS tipo ENUM('ranqueado','amistoso') NOT NULL DEFAULT 'ranqueado' AFTER temporada;
ALTER TABLE ranqueado ADD COLUMN IF NOT EXISTS tier_max TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER tier;
ALTER TABLE ranqueado ADD COLUMN IF NOT EXISTS premio_moedas INT UNSIGNED NULL;

-- Convite de amistoso: vale por 5 minutos.
CREATE TABLE IF NOT EXISTS convites (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  de_id           INT UNSIGNED NOT NULL,
  para_id         INT UNSIGNED NOT NULL,
  status          ENUM('pendente','aceito','recusado','cancelado') NOT NULL DEFAULT 'pendente',
  partida_id      INT UNSIGNED NULL,
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (para_id, status),
  INDEX (de_id, status),
  FOREIGN KEY (de_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (para_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Aparelhos usados por cada conta (id aleatório guardado no navegador). Contas que
-- dividem um aparelho são tratadas como ligadas: o ranqueado não as coloca uma contra
-- a outra (evita alguém subir de divisão jogando contra a própria conta).
CREATE TABLE IF NOT EXISTS dispositivos (
  usuario_id      INT UNSIGNED NOT NULL,
  dispositivo     VARCHAR(64)  NOT NULL,
  ip              VARCHAR(45)  NULL,
  ultimo_uso      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, dispositivo),
  INDEX (dispositivo, ultimo_uso),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Carreira na conta e caixa único (decidido em 25/11/2026)
-- O caixa é o de times_online: um só para carreira, desafios e online.
-- A carreira (estado do jogo em JSON) fica aqui quando o técnico está logado;
-- o servidor confere cada lançamento de dinheiro antes de mexer no caixa.
CREATE TABLE IF NOT EXISTS carreiras (
  usuario_id      INT UNSIGNED PRIMARY KEY,
  dados           MEDIUMTEXT   NULL,               -- NULL: sem carreira (apagada)
  clube_id        VARCHAR(64)  NULL,
  divisao         VARCHAR(8)   NOT NULL DEFAULT 'A', -- A/B (Brasil) ou a liga estrangeira (ING, ESP...)
  ano             SMALLINT     NOT NULL DEFAULT 0,
  receita         INT          NOT NULL DEFAULT 0, -- TV e patrocínio por rodada (R$ mil)
  bilheteria      INT          NOT NULL DEFAULT 0,
  posse           MEDIUMTEXT   NOT NULL,           -- JSON jogadorId -> 1 comprado, 0 saiu
  ultima_rodada   INT          NOT NULL DEFAULT 0, -- ano*100 + rodada já paga
  ultima_bilheteria INT        NOT NULL DEFAULT 0,
  ultimo_salario  INT          NOT NULL DEFAULT 0,
  ultima_premiacao SMALLINT    NOT NULL DEFAULT 0,
  ultima_partida  INT          NOT NULL DEFAULT 0, -- ano*100 + rodada com moedas da partida já pagas
  seq             INT          NOT NULL DEFAULT 0, -- último lançamento aceito
  desafio_pendente VARCHAR(40) NULL,
  treinos_dia     DATE         NULL,
  treinos_hoje    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bonus_inicial   TINYINT(1)   NOT NULL DEFAULT 0, -- caixa inicial do clube já foi dado
  atualizado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Todos os lançamentos aceitos no caixa único, para auditoria.
CREATE TABLE IF NOT EXISTS lancamentos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNSIGNED NOT NULL,
  tipo            VARCHAR(20)  NOT NULL,
  descricao       VARCHAR(120) NOT NULL,
  valor           INT          NOT NULL,
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (usuario_id, criado_em),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bancos criados antes de 25/11/2026 (MariaDB/XAMPP).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS limite_cartas SMALLINT UNSIGNED NOT NULL DEFAULT 300 AFTER moedas;
ALTER TABLE carreiras ADD COLUMN IF NOT EXISTS ultima_partida INT NOT NULL DEFAULT 0 AFTER ultima_premiacao;

-- Dono da carta quando a proposta foi feita (para mostrar a quem foi a proposta depois da venda).
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS vendedor_id INT UNSIGNED NULL AFTER comprador_id;
