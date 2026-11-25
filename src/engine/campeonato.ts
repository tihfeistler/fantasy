import { simularPartida } from "./match";
import { criarRng } from "./rng";
import type { ResultadoPartida, Time } from "./types";
import { ligaDe, nomeCurto, zonaDaLiga, type ClasseZona, type Divisao } from "./ligas";

export type { Divisao } from "./ligas";
/** Um jogo do calendário: ids de mandante e visitante. */
export type Jogo = [mandante: string, visitante: string];
export type Placar = [golsMandante: number, golsVisitante: number];

/**
 * Divisão = liga do clube (ver ligas.ts): "A" e "B" no Brasil, sigla do país nas
 * estrangeiras. A Série C não existe no jogo: quem cai da B fica na B.
 */
/** Quantos sobem da B e caem da A no fim da temporada. */
export const VAGAS_ACESSO = 4;

export interface Temporada {
  ano: number;
  /** Sem valor (saves antigos): Série A. */
  divisao?: Divisao;
  seed: number;
  /** Rodadas (38 de 10 jogos na Série A; turno único na Argentina). */
  rodadas: Jogo[][];
  /** Índice da próxima rodada a jogar (rodadas.length = temporada encerrada). */
  rodadaAtual: number;
  /** Placar de cada jogo já disputado, chave "rodada-jogo". */
  placares: Record<string, Placar>;
  /** Pontos perdidos por punição (ex.: caixa negativo), por clube. */
  punicoes?: Record<string, number>;
}

export const chaveJogo = (rodada: number, jogo: number) => `${rodada}-${jogo}`;

function embaralhar<T>(lista: T[], seed: number): T[] {
  const rng = criarRng(seed);
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Turno e returno pelo método do círculo: cada time enfrenta todos uma vez
 * em casa e uma fora, alternando mando de rodada em rodada.
 */
export function gerarCalendario(ids: string[], seed: number, turnos: 1 | 2 = 2): Jogo[][] {
  const ts = embaralhar(ids, seed);
  if (ts.length % 2) ts.push("__folga__");
  const n = ts.length;
  const turno: Jogo[][] = [];
  const roda = [...ts];
  // Sequência atual de cada time: positivo = jogos seguidos em casa, negativo = fora.
  const seq = new Map<string, number>(ts.map((x) => [x, 0]));
  const anota = (m: string, v: string) => {
    seq.set(m, Math.max(0, seq.get(m)!) + 1);
    seq.set(v, Math.min(0, seq.get(v)!) - 1);
  };
  for (let r = 0; r < n - 1; r++) {
    const jogos: Jogo[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = roda[i];
      const b = roda[n - 1 - i];
      if (a === "__folga__" || b === "__folga__") continue;
      // Joga em casa quem vem de mais jogos fora (evita sequências longas no mesmo mando).
      const j: Jogo = seq.get(a)! <= seq.get(b)! ? [a, b] : [b, a];
      anota(...j);
      jogos.push(j);
    }
    turno.push(jogos);
    roda.splice(1, 0, roda.pop()!);
  }
  if (turnos === 1) return turno;
  const returno = turno.map((jogos) => jogos.map(([m, v]) => [v, m] as Jogo));
  return [...turno, ...returno];
}

export function novaTemporada(ids: string[], ano: number, seed: number, divisao: Divisao = "A"): Temporada {
  return { ano, divisao, seed, rodadas: gerarCalendario(ids, seed, ligaDe(divisao).turnos), rodadaAtual: 0, placares: {} };
}

export const divisaoDe = (t: Temporada): Divisao => t.divisao ?? "A";
/** "Série A", "Série B" ou o nome da liga estrangeira. */
export const nomeDaDivisao = (d: Divisao) => nomeCurto(d);
/** Divisão ligada por acesso e rebaixamento (só no Brasil). */
export const divisaoPar = (d: Divisao): Divisao | undefined => ligaDe(d).par;

/** Clubes que disputam a temporada (os do primeiro turno). */
export const idsDaTemporada = (t: Temporada) => t.rodadas[0].flat();

/** Joga a rodada atual (o que faltar) e passa para a próxima. Temporada encerrada fica como está. */
export function jogarRodada(t: Temporada, times: Map<string, Time>): Temporada {
  if (t.rodadaAtual >= t.rodadas.length) return t;
  const feita = simularRodada(t, times);
  return { ...feita, rodadaAtual: feita.rodadaAtual + 1 };
}

/**
 * Acesso e rebaixamento: os 4 últimos da A caem e os 4 primeiros da B sobem.
 * Devolve o mapa clube -> divisão para a próxima temporada.
 */
export function trocarDivisoes(serieA: Temporada, serieB: Temporada): Record<string, Divisao> {
  const a = calcularTabela(serieA, idsDaTemporada(serieA));
  const b = calcularTabela(serieB, idsDaTemporada(serieB));
  const novo: Record<string, Divisao> = {};
  a.forEach((l, i) => (novo[l.id] = i >= a.length - VAGAS_ACESSO ? "B" : "A"));
  b.forEach((l, i) => (novo[l.id] = i < VAGAS_ACESSO ? "A" : "B"));
  return novo;
}

export function seedDoJogo(t: Temporada, rodada: number, jogo: number) {
  return (t.seed ^ (rodada * 7919 + jogo * 104729)) >>> 0;
}

/** Simula os jogos da rodada que ainda não têm placar. */
export function simularRodada(t: Temporada, times: Map<string, Time>, rodada = t.rodadaAtual): Temporada {
  const placares = { ...t.placares };
  t.rodadas[rodada].forEach(([m, v], i) => {
    const k = chaveJogo(rodada, i);
    if (placares[k]) return;
    const r: ResultadoPartida = simularPartida(times.get(m)!, times.get(v)!, seedDoJogo(t, rodada, i));
    placares[k] = [r.golsMandante, r.golsVisitante];
  });
  return { ...t, placares };
}

export interface LinhaTabela {
  id: string;
  pts: number;
  j: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
  sg: number;
  /** Últimos resultados, do mais antigo ao mais recente: "V", "E" ou "D". */
  forma: ("V" | "E" | "D")[];
}

/** Classificação: pontos, vitórias, saldo, gols pró (critérios do Brasileirão), depois nome. */
export function calcularTabela(t: Temporada, ids: string[], nomes?: Map<string, string>): LinhaTabela[] {
  const linhas = new Map<string, LinhaTabela>(
    ids.map((id) => [id, { id, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, forma: [] }]),
  );
  t.rodadas.forEach((jogos, r) =>
    jogos.forEach(([m, v], i) => {
      const p = t.placares[chaveJogo(r, i)];
      if (!p) return;
      const [gm, gv] = p;
      const a = linhas.get(m)!;
      const b = linhas.get(v)!;
      a.j++; b.j++;
      a.gp += gm; a.gc += gv; b.gp += gv; b.gc += gm;
      if (gm > gv) { a.v++; a.pts += 3; b.d++; a.forma.push("V"); b.forma.push("D"); }
      else if (gm < gv) { b.v++; b.pts += 3; a.d++; a.forma.push("D"); b.forma.push("V"); }
      else { a.e++; b.e++; a.pts++; b.pts++; a.forma.push("E"); b.forma.push("E"); }
    }),
  );
  const lista = [...linhas.values()].map((l) => ({
    ...l,
    pts: l.pts - (t.punicoes?.[l.id] ?? 0),
    sg: l.gp - l.gc,
    forma: l.forma.slice(-5),
  }));
  return lista.sort(
    (x, y) =>
      y.pts - x.pts || y.v - x.v || y.sg - x.sg || y.gp - x.gp ||
      (nomes?.get(x.id) ?? x.id).localeCompare(nomes?.get(y.id) ?? y.id),
  );
}

export type Zona = ClasseZona;

/**
 * Zona da tabela (simplificada) pela posição. Na B só há a zona de acesso;
 * nas ligas estrangeiras, as vagas continentais (ninguém cai).
 */
export function zona(posicao: number, divisao: Divisao = "A", total = 20): Zona | null {
  return zonaDaLiga(divisao, posicao, total)?.classe ?? null;
}
/** Nome da zona da posição, para mostrar ao técnico. */
export function nomeDaZona(posicao: number, divisao: Divisao = "A", total = 20): string | null {
  return zonaDaLiga(divisao, posicao, total)?.nome ?? null;
}

/**
 * Moedas de premiação no fim da temporada pela posição. A escala vale para
 * 20 clubes e acompanha o tamanho da liga; o fator da liga multiplica (Série B: metade).
 */
export function premioFinal(posicao: number, divisao: Divisao = "A", total = 20) {
  const p = total === 20 ? posicao : Math.max(1, Math.round((posicao * 20) / total));
  const base = posicao === 1 ? 3000 : p <= 4 ? 1500 : p <= 12 ? 800 : p <= 16 ? 400 : 200;
  return Math.round(ligaDe(divisao).fatorPremio * base);
}
