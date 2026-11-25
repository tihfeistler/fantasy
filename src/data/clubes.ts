import { MAX_LENDAS_EM_CAMPO } from "../engine/pacotes";
import clubesJson from "../../data/clubes.json";
import atuaisJson from "../../data/atuais.json";
import { FORMACOES } from "../engine/ratings";
import { divisaoDaChave, type Divisao } from "../engine/ligas";
import type { Jogador, Time } from "../engine/types";
import { ESTADIOS, uniformesDoTimeProprio, type ClubeProprio, type FormaEmblema, type SimboloEmblema, type Uniforme } from "../engine/timeProprio";
import { fatorCasa, type Estadio } from "../engine/estadios";

/**
 * Clubes das Séries A e B e das ligas estrangeiras com os elencos atuais
 * (data/clubes.json + data/atuais.json),
 * empacotados no front para o modo solo funcionar offline.
 * Os atributos são RASCUNHO: ver scripts/gerar_atuais.py.
 */
export interface Clube {
  id: string;
  nome: string;
  sigla: string;
  cor: string;
  corSecundaria?: string;
  liga: string;
  nivel: number;
  /** Estádio real (data/estadios.txt -> scripts/gerar_estadios.py). */
  estadio: Estadio;
  /** Camisa principal e reserva, estilizadas nas cores do clube. */
  camisas: [Uniforme, Uniforme];
  /** Escudo estilizado (sem arte oficial). */
  emblema: { forma: FormaEmblema; simbolo: SimboloEmblema };
}

export const CLUBES = clubesJson as Clube[];

/** Estádio padrão para quem não está em data/clubes.json (times de cartas). */
const ESTADIO_NEUTRO: Estadio = { nome: "Estádio", capacidade: 15000, atmosfera: 50, qualidade: 50 };
/** Estádio de um clube (o do time próprio, se ele ocupa essa vaga). */
export const estadioDoClube = (id: string): Estadio => CLUBES.find((c) => c.id === id)?.estadio ?? ESTADIO_NEUTRO;
export const ATUAIS = atuaisJson as Jogador[];

export const NIVEL = new Map(CLUBES.map((c) => [c.id, c.nivel]));

/** Divisão (liga) de cada clube no começo da carreira (2026). */
export const DIVISOES_INICIAIS: Record<string, Divisao> = Object.fromEntries(
  CLUBES.map((c) => [c.id, divisaoDaChave(c.liga)]),
);
/** Clubes de uma divisão, na ordem de data/clubes.json. */
export const clubesDaDivisao = (divisoes: Record<string, Divisao>, d: Divisao) =>
  CLUBES.filter((c) => (divisoes[c.id] ?? DIVISOES_INICIAIS[c.id]) === d).map((c) => c.id);

/**
 * Times com os elencos atuais. `transferencias` (jogadorId -> clubeId)
 * aplica as compras e vendas feitas na carreira.
 */
export function montarTimesAtuais(transferencias: Record<string, string> = {}): Time[] {
  // Agrupa uma vez (são milhares de jogadores em centenas de clubes).
  const porClube = new Map<string, Jogador[]>();
  for (const j of ATUAIS) {
    const c = transferencias[j.id] ?? j.clubeId ?? "";
    const l = porClube.get(c);
    if (l) l.push(j);
    else porClube.set(c, [j]);
  }
  return CLUBES.map((c) => ({
    id: c.id,
    nome: c.nome,
    sigla: c.sigla,
    cor: c.cor,
    elenco: porClube.get(c.id) ?? [],
    formacao: FORMACOES[0],
    titulares: [],
    maxLendas: MAX_LENDAS_EM_CAMPO,
    fatorCasa: fatorCasa(c.estadio),
  }));
}

/** Estilo do escudo: fundo na cor do clube e texto legível por cima (preto em cores claras). */
export function estiloEscudo(cor: string) {
  const n = parseInt(cor.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const claro = 0.299 * r + 0.587 * g + 0.114 * b > 160;
  return { background: cor, color: claro ? "#0b1324" : "#ffffff", textShadow: claro ? "none" : undefined };
}

/**
 * Times próprios em jogo (vaga -> identidade). O time próprio usa o id do clube
 * que ele substitui; aqui o nome, a sigla e as cores desse clube viram os do time.
 */
export const CLUBES_PROPRIOS = new Map<string, ClubeProprio>();
type Visual = Pick<Clube, "nome" | "sigla" | "cor" | "corSecundaria" | "estadio" | "camisas" | "emblema">;
const ORIGINAIS = new Map<string, Visual>();

/** Coloca (ou tira, com null) o time próprio da carreira no lugar do clube da vaga. */
export function aplicarClubeProprio(cp: ClubeProprio | null | undefined) {
  for (const [id, o] of ORIGINAIS) Object.assign(CLUBES.find((c) => c.id === id)!, o);
  ORIGINAIS.clear();
  CLUBES_PROPRIOS.clear();
  if (!cp) return;
  const c = CLUBES.find((x) => x.id === cp.vaga);
  if (!c) return;
  const { nome, sigla, cor, corSecundaria, estadio, camisas, emblema } = c;
  ORIGINAIS.set(c.id, { nome, sigla, cor, corSecundaria, estadio, camisas, emblema });
  const carta = ESTADIOS.find((e) => e.id === cp.estadio) ?? ESTADIOS[0];
  const proprio: Visual = {
    nome: cp.nome,
    sigla: cp.sigla,
    cor: cp.cor,
    corSecundaria: cp.corSecundaria,
    estadio: { nome: cp.nomeEstadio, capacidade: carta.capacidade, atmosfera: carta.atmosfera, qualidade: carta.qualidade },
    camisas: uniformesDoTimeProprio(cp),
    emblema: cp.emblema,
  };
  Object.assign(c, proprio);
  CLUBES_PROPRIOS.set(c.id, cp);
}
