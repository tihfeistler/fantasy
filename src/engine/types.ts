/**
 * Formato de jogador clássico. É o mesmo formato de data/jogadores.json
 * (definido junto com a frente da base de dados). Mudanças aqui precisam
 * ser combinadas com data/jogador.schema.json.
 */
export type Posicao = "GOL" | "ZAG" | "LAT" | "VOL" | "MEI" | "ATA";
export const POSICOES: Posicao[] = ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"];

export type Pe = "D" | "E" | "A"; // direito, esquerdo, ambidestro

/** Oito atributos de 1 a 100. O geral é a média ponderada pela posição. */
export interface Atributos {
  finalizacao: number; // chute, cabeceio, frieza na área
  passe: number; // passe curto e longo, cruzamento, visão
  drible: number; // condução, controle, um contra um
  velocidade: number; // arranque e velocidade final
  defesa: number; // marcação, desarme, posicionamento
  fisico: number; // força, resistência, jogo aéreo
  mentalidade: number; // liderança, decisão, frieza em jogo grande
  goleiro: number; // reflexo, colocação, saída do gol
}

export const ATRIBUTOS: (keyof Atributos)[] = [
  "finalizacao", "passe", "drible", "velocidade", "defesa", "fisico", "mentalidade", "goleiro",
];

/** Siglas curtas para cartas e tabelas. */
export const SIGLA_ATRIBUTO: Record<keyof Atributos, string> = {
  finalizacao: "FIN", passe: "PAS", drible: "DRI", velocidade: "VEL",
  defesa: "DEF", fisico: "FIS", mentalidade: "MEN", goleiro: "GOL",
};

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
  /** Máximo de lendas (jogadores clássicos) entre os titulares; sem valor, não há limite. */
  maxLendas?: number;
  /** ids do banco de reservas (até VAGAS_BANCO); sem valor, o jogo escolhe. */
  banco?: string[];
}

export type TipoEvento = "gol" | "chance" | "defesa" | "cartao" | "inicio" | "intervalo" | "fim" | "sub" | "tatica";

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

/** Jogador clássico (carta de lenda)? Sem `tipo`, o jogador é clássico. */
export const ehLenda = (j: Jogador) => (j.tipo ?? "classico") === "classico";
