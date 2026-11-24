/**
 * Formato de jogador clássico. É o mesmo formato de data/jogadores.json
 * (definido junto com a frente da base de dados). Mudanças aqui precisam
 * ser combinadas com data/jogador.schema.json.
 */
export type Posicao = "GOL" | "ZAG" | "LAT" | "VOL" | "MEI" | "ATA";
export const POSICOES: Posicao[] = ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"];

export type Pe = "D" | "E" | "A"; // direito, esquerdo, ambidestro

export interface Atributos {
  ataque: number; // 1-100
  defesa: number;
  passe: number;
  velocidade: number;
  fisico: number;
  goleiro: number;
}

export interface Jogador {
  /** Slug único e estável. Saves e o modo online referenciam por ele. */
  id: string;
  nome: string;
  nomeCompleto?: string;
  /** Código FIFA de 3 letras, ex.: "BRA". */
  nacionalidade: string;
  posicao: Posicao;
  pe: Pe;
  epoca?: { inicio: number; fim: number };
  /** Ano do auge: a "versão" do jogador usada no jogo (clássicos). */
  auge?: number;
  clubeMarcante?: string;
  atributos: Atributos;
  /** 1-100, calculado pelos pesos da posição. */
  geral: number;
  /** "classico" se ausente. Ver docs/FORMATO-JOGADOR.md. */
  tipo?: "classico" | "atual";
  /** AAAA-MM-DD, só para atuais. */
  nascimento?: string;
  /** Clube na temporada, só para atuais. */
  clubeId?: string;
  /** Teto de evolução 1-100, só para atuais. */
  potencial?: number;
}

/** Formação como quantidade de jogadores de linha por setor. */
export interface Formacao {
  nome: string; // ex.: "4-4-2"
  ZAG: number;
  LAT: number;
  VOL: number;
  MEI: number;
  ATA: number;
}

export interface Time {
  id: string;
  nome: string;
  sigla: string;
  cor: string;
  elenco: Jogador[];
  formacao: Formacao;
  /** ids dos 11 titulares; se vazio, o jogo escala automaticamente. */
  titulares: string[];
}

export type TipoEvento = "gol" | "chance" | "defesa" | "cartao" | "inicio" | "intervalo" | "fim";

export interface EventoPartida {
  minuto: number;
  tipo: TipoEvento;
  timeId?: string;
  jogadorId?: string;
  texto: string;
}

export interface ResultadoPartida {
  mandanteId: string;
  visitanteId: string;
  golsMandante: number;
  golsVisitante: number;
  eventos: EventoPartida[];
  seed: number;
}
