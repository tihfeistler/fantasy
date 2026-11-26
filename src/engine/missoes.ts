// Missões da carreira: a fonte de moedas durante a temporada.
//
// Moedas só entram no fim da temporada (premiação), nos desafios e nas missões.
// Partida não paga moedas. Cada missão paga uma vez: as "da temporada" voltam a
// valer a cada ano, as "conquistas" só uma vez na carreira.
//
// O catálogo é igual a MISSOES em api/carreira.php (o servidor confere o teto e
// se a missão já foi paga).

import { chaveJogo, type Temporada } from "./campeonato";
import { vencedorDoJogo, type Copa } from "./copas";
import { ligaDe, type Divisao } from "./ligas";
import type { Lancamento } from "./mercado";

export interface Missao {
  id: string;
  nome: string;
  descricao: string;
  moedas: number;
  /** Volta a valer a cada temporada; sem isso, é conquista (uma vez na carreira). */
  temporada: boolean;
  /** Quanto precisa (para a barra de progresso). */
  meta: number;
}

export const MISSOES: Missao[] = [
  { id: "vitorias-5", nome: "Começo forte", descricao: "Vença 5 jogos no campeonato", moedas: 100, temporada: true, meta: 5 },
  { id: "vitorias-12", nome: "Candidato", descricao: "Vença 12 jogos no campeonato", moedas: 250, temporada: true, meta: 12 },
  { id: "gols-25", nome: "Ataque afiado", descricao: "Marque 25 gols no campeonato", moedas: 150, temporada: true, meta: 25 },
  { id: "sem-sofrer-5", nome: "Muralha", descricao: "Termine 5 jogos sem sofrer gol", moedas: 150, temporada: true, meta: 5 },
  { id: "sequencia-3", nome: "Embalado", descricao: "Vença 3 jogos seguidos no campeonato", moedas: 100, temporada: true, meta: 3 },
  { id: "casa-6", nome: "Caldeirão", descricao: "Vença 6 jogos em casa", moedas: 150, temporada: true, meta: 6 },
  { id: "copa-fase", nome: "Mata-mata", descricao: "Passe de fase numa copa", moedas: 100, temporada: true, meta: 1 },
  { id: "copa-titulo", nome: "Taça na mão", descricao: "Seja campeão de uma copa", moedas: 800, temporada: true, meta: 1 },
  {
    id: "caixa-azul",
    nome: "Contas em dia",
    descricao: "Termine o campeonato com o caixa positivo",
    moedas: 200,
    temporada: true,
    meta: 1,
  },
  {
    id: "primeira-contratacao",
    nome: "Reforço",
    descricao: "Contrate um jogador no mercado",
    moedas: 100,
    temporada: false,
    meta: 1,
  },
  { id: "acesso", nome: "Subindo", descricao: "Suba de divisão", moedas: 500, temporada: false, meta: 1 },
  { id: "titulo-liga", nome: "Campeão", descricao: "Seja campeão da liga", moedas: 1000, temporada: false, meta: 1 },
];

export const MISSAO_POR_ID = new Map(MISSOES.map((m) => [m.id, m]));

/** Chave de pagamento: "2026:vitorias-5" nas da temporada, só o id nas conquistas. */
export const chaveMissao = (m: Missao, ano: number) => (m.temporada ? `${ano}:${m.id}` : m.id);

/** O que as missões olham na carreira. */
export interface ContextoMissoes {
  temporada: Temporada;
  meuTimeId: string;
  copas?: Copa[];
  caixa: number;
  extrato: Lancamento[];
  historico?: { ano: number; posicao: number; campeao: string; divisao?: Divisao }[];
}

/** Números do clube no campeonato desta temporada. */
export function numerosDaTemporada(t: Temporada, timeId: string) {
  let vitorias = 0;
  let gols = 0;
  let semSofrer = 0;
  let emCasa = 0;
  let seguidas = 0;
  let melhorSequencia = 0;
  for (let r = 0; r < t.rodadas.length; r++) {
    const i = t.rodadas[r].findIndex(([m, v]) => m === timeId || v === timeId);
    const placar = i >= 0 ? t.placares[chaveJogo(r, i)] : undefined;
    if (!placar) continue;
    const casa = t.rodadas[r][i][0] === timeId;
    const [meus, deles] = casa ? placar : [placar[1], placar[0]];
    gols += meus;
    if (deles === 0) semSofrer++;
    if (meus > deles) {
      vitorias++;
      if (casa) emCasa++;
      seguidas++;
      melhorSequencia = Math.max(melhorSequencia, seguidas);
    } else seguidas = 0;
  }
  return { vitorias, gols, semSofrer, emCasa, melhorSequencia };
}

/** Progresso de cada missão (0 até a meta). */
export function progressoDasMissoes(c: ContextoMissoes): Record<string, number> {
  const { temporada: t, meuTimeId: eu } = c;
  const n = numerosDaTemporada(t, eu);
  const copasDoAno = (c.copas ?? []).filter((x) => x.ano === t.ano);
  const passouFase = copasDoAno.some((x) => x.fases.some((f) => f.jogos.some((j) => vencedorDoJogo(j) === eu)));
  const fim = t.rodadaAtual >= t.rodadas.length;
  const anterior = c.historico?.filter((h) => h.ano < t.ano).at(-1);
  const subiu = !!anterior && ligaDe(t.divisao).nivel < ligaDe(anterior.divisao).nivel;
  return {
    "vitorias-5": n.vitorias,
    "vitorias-12": n.vitorias,
    "gols-25": n.gols,
    "sem-sofrer-5": n.semSofrer,
    "sequencia-3": n.melhorSequencia,
    "casa-6": n.emCasa,
    "copa-fase": passouFase ? 1 : 0,
    "copa-titulo": copasDoAno.some((x) => x.campeao === eu) ? 1 : 0,
    "caixa-azul": fim && c.caixa >= 0 ? 1 : 0,
    "primeira-contratacao": c.extrato.some((l) => l.tipo === "compra") ? 1 : 0,
    acesso: subiu ? 1 : 0,
    "titulo-liga": (c.historico ?? []).some((h) => h.campeao === eu) ? 1 : 0,
  };
}

/** Missões cumpridas e ainda não pagas, com a chave de pagamento. */
export function missoesParaPagar(c: ContextoMissoes, pagas: readonly string[]): { missao: Missao; chave: string }[] {
  const feito = progressoDasMissoes(c);
  const ja = new Set(pagas);
  return MISSOES.filter((m) => (feito[m.id] ?? 0) >= m.meta)
    .map((m) => ({ missao: m, chave: chaveMissao(m, c.temporada.ano) }))
    .filter((x) => !ja.has(x.chave));
}
