import { FORMACOES, escalar } from "./ratings";
import { salarioMensal } from "./mercado";
import { MAX_LENDAS_EM_CAMPO } from "./pacotes";
import { criarRng } from "./rng";
import { ehLenda, POSICOES, type Jogador, type Posicao, type Time } from "./types";
import clubesJson from "../../data/clubes.json";

/**
 * Time de cartas e desafios PvE.
 *
 * O time de cartas é o time do modo online/desafios: só com cartas que o
 * técnico tem (cartas base de jogadores atuais, compradas do sistema com
 * moedas, e lendas). Tem caixa próprio (R$ mil) e paga salário por partida:
 * um quarto do salário mensal de cada titular; lendas cobram cachê em dobro.
 * Sem caixa para o custo, não joga (exceto o treino, que é de graça).
 */

export const CAIXA_INICIAL_CARTAS = 2000;
export const CACHE_LENDA = 2;

/** Preço de uma carta base no sistema, em moedas (geral 60 = 20, 75 = 110, 84 = 300). */
export function precoCartaBase(j: Jogador): number {
  return Math.max(20, Math.round((20 * 1.12 ** (j.geral - 60)) / 10) * 10);
}
/** Preço básico ao vender a carta base de volta ao sistema: 40% do preço. */
export const vendaCartaBase = (j: Jogador) => Math.max(5, Math.round((precoCartaBase(j) * 0.4) / 5) * 5);

/** Salário de uma partida de um jogador do time de cartas (R$ mil). */
export const custoPorPartida = (j: Jogador) =>
  Math.round((salarioMensal(j) / 4) * (ehLenda(j) ? CACHE_LENDA : 1));

/** Custo da partida: titulares que vão a campo. */
export function custoDaPartida(t: Time): number {
  return escalar(t).reduce((s, v) => s + custoPorPartida(v.jogador), 0);
}

/** Kit inicial: 16 cartas base fracas cobrindo todas as posições. */
const KIT: Record<Posicao, number> = { GOL: 2, ZAG: 3, LAT: 3, VOL: 2, MEI: 3, ATA: 3 };
export function kitInicial(atuais: Jogador[], seed: number): string[] {
  const rng = criarRng(seed);
  const ids: string[] = [];
  for (const p of POSICOES) {
    const pool = atuais.filter((j) => j.posicao === p && j.geral >= 58 && j.geral <= 68);
    for (let i = 0; i < KIT[p] && pool.length; i++) ids.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  }
  return ids;
}

export interface Desafio {
  id: string;
  nome: string;
  descricao: string;
  /** 1 (fácil) a 5 (muito difícil). */
  dificuldade: number;
  /** Treino: não cobra salário. */
  gratis?: boolean;
  /** Prêmio em R$ mil para o caixa do time de cartas. */
  premio: { vitoria: number; empate: number; derrota: number };
  moedas: { vitoria: number; empate: number; derrota: number };
  /** Primeira vitória dá uma carta sorteada entre as lendas do adversário. */
  cartaNaPrimeiraVitoria?: boolean;
  /** Jogadores do adversário. */
  elenco: (atuais: Jogador[], lendas: Jogador[]) => Jogador[];
  cor: string;
  sigla: string;
}

const PREMIO = [0, 150, 400, 800, 1500, 2500];
const MOEDAS = [0, 20, 60, 120, 200, 300];
function premios(d: number) {
  return {
    premio: { vitoria: PREMIO[d], empate: Math.round(PREMIO[d] * 0.5), derrota: Math.round(PREMIO[d] * 0.2) },
    moedas: { vitoria: MOEDAS[d], empate: Math.round(MOEDAS[d] * 0.4), derrota: Math.round(MOEDAS[d] * 0.1) },
  };
}

const LIGA_DO_CLUBE = new Map((clubesJson as { id: string; liga: string }[]).map((c) => [c.id, c.liga]));
const daLiga = (ligas: string[]) => (j: Jogador) => ligas.includes(LIGA_DO_CLUBE.get(j.clubeId ?? "") ?? "");
const melhoresPorPosicao = (js: Jogador[], n: number) => POSICOES.flatMap((p) => melhoresDe(js.filter((j) => j.posicao === p), n));
const melhoresDe = (js: Jogador[], n: number) => [...js].sort((a, b) => b.geral - a.geral).slice(0, n);

export const DESAFIOS: Desafio[] = [
  {
    id: "treino",
    nome: "Treino contra os reservas",
    descricao: "Jogo-treino contra os reservas da Chapecoense. Não cobra salário e paga pouco: serve para sair do aperto.",
    dificuldade: 1,
    gratis: true,
    ...premios(1),
    elenco: (a) => [...a.filter((j) => j.clubeId === "chapecoense")].sort((x, y) => x.geral - y.geral).slice(0, 20),
    cor: "#1b6a3f",
    sigla: "TRE",
  },
  {
    id: "nordeste",
    nome: "Seleção do Nordeste",
    descricao: "Os melhores de Bahia e Vitória num time só.",
    dificuldade: 2,
    ...premios(2),
    elenco: (a) => melhoresDe(a.filter((j) => j.clubeId === "bahia" || j.clubeId === "vitoria"), 22),
    cor: "#1e5bb8",
    sigla: "NOR",
  },
  {
    id: "flamengo",
    nome: "Desafie o Flamengo",
    descricao: "O elenco atual do Flamengo, completo.",
    dificuldade: 3,
    ...premios(3),
    elenco: (a) => a.filter((j) => j.clubeId === "flamengo"),
    cor: "#c8102e",
    sigla: "FLA",
  },
  {
    id: "brasileirao",
    nome: "Seleção do Brasileirão",
    descricao: "Os melhores jogadores atuais da Série A em cada posição.",
    dificuldade: 4,
    ...premios(4),
    elenco: (a) => melhoresPorPosicao(a.filter(daLiga(["brasileirao-a"])), 4),
    cor: "#0b7a5a",
    sigla: "BRA",
  },
  {
    id: "superclassico",
    nome: "Superclássico argentino",
    descricao: "Os melhores de River Plate e Boca Juniors num time só.",
    dificuldade: 3,
    ...premios(3),
    elenco: (a) => melhoresDe(a.filter((j) => j.clubeId === "river-plate" || j.clubeId === "boca-juniors"), 22),
    cor: "#103f79",
    sigla: "SUP",
  },
  {
    id: "europa",
    nome: "Seleção da Europa",
    descricao: "Os melhores jogadores atuais das cinco grandes ligas europeias em cada posição.",
    dificuldade: 5,
    ...premios(5),
    elenco: (a) =>
      melhoresPorPosicao(a.filter(daLiga(["premier-league", "la-liga", "serie-a-italia", "bundesliga", "ligue-1"])), 4),
    cor: "#1d3f9b",
    sigla: "EUR",
  },
  {
    id: "brasil-1970",
    nome: "Brasil de 1970",
    descricao: "Pelé, Tostão, Rivellino, Gérson, Jairzinho e companhia. Na primeira vitória, um deles vira seu.",
    dificuldade: 4,
    ...premios(4),
    cartaNaPrimeiraVitoria: true,
    elenco: (_, l) => l.filter((j) => j.nacionalidade === "BRA" && (j.auge ?? 0) >= 1966 && (j.auge ?? 0) <= 1974),
    cor: "#f2c230",
    sigla: "70",
  },
  {
    id: "holanda",
    nome: "Laranja Mecânica",
    descricao: "Lendas da Holanda de várias gerações. Na primeira vitória, uma delas vira sua.",
    dificuldade: 5,
    ...premios(5),
    cartaNaPrimeiraVitoria: true,
    elenco: (_, l) => l.filter((j) => j.nacionalidade === "NED"),
    cor: "#f36c21",
    sigla: "HOL",
  },
  {
    id: "milan",
    nome: "Lendas do Milan",
    descricao: "Os maiores nomes da história do Milan. Na primeira vitória, um deles vira seu.",
    dificuldade: 5,
    ...premios(5),
    cartaNaPrimeiraVitoria: true,
    elenco: (_, l) => l.filter((j) => j.clubeMarcante === "Milan"),
    cor: "#b5121b",
    sigla: "MIL",
  },
];

/** Monta o time adversário de um desafio. */
export function timeDoDesafio(d: Desafio, atuais: Jogador[], lendas: Jogador[]): Time {
  return {
    id: `desafio-${d.id}`,
    nome: d.nome,
    sigla: d.sigla,
    cor: d.cor,
    elenco: d.elenco(atuais, lendas),
    formacao: FORMACOES[0],
    titulares: [],
  };
}

/** Força média dos 11 titulares, para mostrar ao jogador. */
export function forcaMedia(t: Time): number {
  const v = escalar(t);
  return v.length ? Math.round(v.reduce((s, x) => s + x.jogador.geral, 0) / v.length) : 0;
}

export interface TimeCartas {
  caixa: number;
  formacao: string;
  titulares: string[];
  banco?: string[];
  /** Por desafio: jogos e vitórias. */
  desafios: Record<string, { jogos: number; vitorias: number }>;
}

export const TIME_CARTAS_INICIAL: TimeCartas = { caixa: CAIXA_INICIAL_CARTAS, formacao: "4-4-2", titulares: [], desafios: {} };

/** Monta o Time do time de cartas a partir das cartas que o técnico tem. */
export function montarTimeCartas(tc: TimeCartas, cartas: Jogador[]): Time {
  return {
    id: "time-cartas",
    nome: "Meu time de cartas",
    sigla: "EU",
    cor: "#ffc93c",
    elenco: cartas,
    formacao: FORMACOES.find((f) => f.nome === tc.formacao) ?? FORMACOES[0],
    titulares: tc.titulares.filter((id) => cartas.some((j) => j.id === id)),
    banco: tc.banco,
    maxLendas: MAX_LENDAS_EM_CAMPO,
  };
}
