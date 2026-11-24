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
CREATE TABLE IF NOT EXISTS propostas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  carta_id        INT UNSIGNED NOT NULL,
  comprador_id    INT UNSIGNED NOT NULL,
  valor           INT UNSIGNED NOT NULL,
  status          ENUM('aberta','aceita','recusada','cancelada','expirada') NOT NULL DEFAULT 'aberta',
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
