import { simularPartida } from "./match";
import { criarRng } from "./rng";
import type { ResultadoPartida, Time } from "./types";

/** Um jogo do calendário: ids de mandante e visitante. */
export type Jogo = [mandante: string, visitante: string];
export type Placar = [golsMandante: number, golsVisitante: number];

export interface Temporada {
  ano: number;
  seed: number;
  /** 38 rodadas de 10 jogos (turno e returno). */
  rodadas: Jogo[][];
  /** Índice da próxima rodada a jogar (0 a 37; 38 = temporada encerrada). */
  rodadaAtual: number;
  /** Placar de cada jogo já disputado, chave "rodada-jogo". */
  placares: Record<string, Placar>;
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
export function gerarCalendario(ids: string[], seed: number): Jogo[][] {
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
  const returno = turno.map((jogos) => jogos.map(([m, v]) => [v, m] as Jogo));
  return [...turno, ...returno];
}

export function novaTemporada(ids: string[], ano: number, seed: number): Temporada {
  return { ano, seed, rodadas: gerarCalendario(ids, seed), rodadaAtual: 0, placares: {} };
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
  const lista = [...linhas.values()].map((l) => ({ ...l, sg: l.gp - l.gc, forma: l.forma.slice(-5) }));
  return lista.sort(
    (x, y) =>
      y.pts - x.pts || y.v - x.v || y.sg - x.sg || y.gp - x.gp ||
      (nomes?.get(x.id) ?? x.id).localeCompare(nomes?.get(y.id) ?? y.id),
  );
}

/** Zonas da tabela do Brasileirão (simplificadas). */
export function zona(posicao: number): "libertadores" | "pre" | "sula" | "rebaixamento" | null {
  if (posicao <= 4) return "libertadores";
  if (posicao <= 6) return "pre";
  if (posicao <= 12) return "sula";
  if (posicao >= 17) return "rebaixamento";
  return null;
}

/** Moedas de premiação no fim da temporada pela posição. */
export function premioFinal(posicao: number) {
  return posicao === 1 ? 3000 : posicao <= 4 ? 1500 : posicao <= 12 ? 800 : posicao <= 16 ? 400 : 200;
}
