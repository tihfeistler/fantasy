import { simularPartida } from "./match";
import { criarRng } from "./rng";
import type { ResultadoPartida, Time } from "./types";
import { LIGAS, ligaDe, type Divisao, type Liga } from "./ligas";

/**
 * Copas da carreira, em mata-mata de jogo único (empate vai para os pênaltis).
 * Correm junto com o campeonato: cada fase é jogada depois de uma rodada da
 * liga, e o técnico disputa o jogo dele antes de seguir para a próxima rodada.
 *
 * - Copa nacional: todos os clubes do país, de todas as divisões. Quando o
 *   número de clubes não é potência de 2, os mais fracos fazem uma fase
 *   preliminar e os da primeira divisão entram direto.
 * - Copa continental: Libertadores (Brasil e Argentina) e Champions League
 *   (Europa), com os classificados pela tabela da primeira divisão de cada país.
 *   O país do técnico usa a tabela final da temporada anterior; os outros
 *   países (que não são simulados na carreira) usam a força dos clubes.
 *
 * Prêmios no caixa único: cada fase vencida paga em dobro a anterior, e o
 * título paga a final de novo. Moedas a cada fase vencida e no título.
 */
export type TipoCopa = "nacional" | "continental";

export interface JogoCopa {
  mandante: string;
  visitante: string;
  placar?: [number, number];
  /** Disputa de pênaltis, quando o jogo empata. */
  penaltis?: [number, number];
}

export interface FaseCopa {
  nome: string;
  jogos: JogoCopa[];
  /** Clubes que entram direto na fase seguinte (só na preliminar). */
  folgas: string[];
}

export interface Copa {
  /** "copa-BRA", "copa-ENG"... ou "libertadores" e "champions". */
  id: string;
  nome: string;
  tipo: TipoCopa;
  ano: number;
  seed: number;
  /** Inscritos, do cabeça de chave para baixo. */
  clubes: string[];
  /** Fases já sorteadas; a última é a atual enquanto não houver campeão. */
  fases: FaseCopa[];
  /** Quantas rodadas da liga precisam estar jogadas para cada fase acontecer. */
  datas: number[];
  campeao?: string;
}

/** Nome da copa nacional de cada país (sigla de ligas.ts). */
export const COPAS_NACIONAIS: Record<string, string> = {
  BRA: "Copa do Brasil",
  ENG: "FA Cup",
  ESP: "Copa del Rey",
  ITA: "Coppa Italia",
  GER: "DFB-Pokal",
  FRA: "Coupe de France",
  POR: "Taça de Portugal",
  NED: "KNVB Beker",
  BEL: "Copa da Bélgica",
  ARG: "Copa Argentina",
  KSA: "Copa do Rei (Arábia Saudita)",
  NOR: "Copa da Noruega",
  DEN: "Copa da Dinamarca",
  SCO: "Scottish Cup",
  AUT: "Copa da Áustria",
  SRB: "Copa da Sérvia",
};

export interface Continental {
  id: string;
  nome: string;
  /** Zonas da primeira divisão que classificam (nomes em ligas.ts). */
  zonas: string[];
}
export const CONTINENTAIS: Continental[] = [
  { id: "libertadores", nome: "Copa Libertadores", zonas: ["Libertadores", "Pré-Libertadores"] },
  { id: "champions", nome: "Champions League", zonas: ["Champions League"] },
];

/** Prêmio (R$ mil) da primeira fase vencida; igual a PREMIO_COPA em api/carreira.php. */
export const PREMIO_BASE_CONTINENTAL: Record<string, number> = { libertadores: 1000, champions: 2000 };
/** Copa nacional: R$ 300 mil vezes o fator de premiação da primeira divisão do país. */
export const premioBaseNacional = (sigla: string) =>
  Math.round(300 * (LIGAS.find((l) => l.sigla === sigla && l.nivel === 1)?.fatorPremio ?? 1));

export const idCopaNacional = (sigla: string) => `copa-${sigla}`;

/**
 * Prêmio em dinheiro por vencer a fase `fase` (0 = primeira). A final vencida paga também o título.
 * Copa não paga moedas por jogo: passar de fase e ser campeão são missões (src/engine/missoes.ts).
 */
export function premioDaFase(c: Pick<Copa, "id" | "tipo" | "clubes">, fase: number) {
  const base =
    c.tipo === "continental" ? (PREMIO_BASE_CONTINENTAL[c.id] ?? 0) : premioBaseNacional(c.id.replace("copa-", ""));
  const final = fase === totalDeFases(c.clubes.length) - 1;
  const valor = base * 2 ** fase * (final ? 2 : 1);
  return { valor, final };
}

const potenciaAbaixo = (n: number) => 2 ** Math.floor(Math.log2(Math.max(1, n)));
/** Quantas fases a copa tem com `n` inscritos (a preliminar conta como uma). */
export const totalDeFases = (n: number) => (n < 2 ? 0 : (n > potenciaAbaixo(n) ? 1 : 0) + Math.log2(potenciaAbaixo(n)));

/** Nome da fase pelo número de clubes que a disputam. */
export function nomeDaFase(clubesNaFase: number, preliminar = false): string {
  if (preliminar) return "Fase preliminar";
  return (
    { 2: "Final", 4: "Semifinal", 8: "Quartas de final", 16: "Oitavas de final" }[clubesNaFase] ??
    `Fase de ${clubesNaFase}`
  );
}

/** Nomes de todas as fases de uma copa com `n` inscritos, da primeira à final. */
export function nomesDasFases(n: number): string[] {
  const p = potenciaAbaixo(n);
  const nomes = n > p ? [nomeDaFase(n, true)] : [];
  for (let k = p; k >= 2; k /= 2) nomes.push(nomeDaFase(k));
  return nomes;
}

/**
 * Datas das fases: espalhadas pela temporada da liga, a última antes da
 * rodada final. A continental fica meia rodada deslocada para não cair
 * sempre na mesma semana da nacional.
 */
export function datasDasFases(fases: number, rodadas: number, deslocar = false): number[] {
  return Array.from({ length: fases }, (_, k) =>
    Math.min(rodadas - 1, Math.max(1, Math.round(((k + 1) * rodadas) / (fases + 1) + (deslocar ? 0.5 : 0)))),
  );
}

function embaralhar<T>(lista: T[], rng: () => number): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sorteia a próxima fase com os clubes vivos (em ordem de cabeça de chave).
 * Na primeira fase de uma copa com número de clubes fora da potência de 2,
 * só os últimos jogam (preliminar) e o resto folga. O pior colocado (ou o
 * clube de divisão menor) joga em casa.
 */
function sortear(c: Copa, vivos: string[]): FaseCopa {
  const n = vivos.length;
  const p = potenciaAbaixo(n);
  const rng = criarRng((c.seed ^ ((c.fases.length + 1) * 2654435761)) >>> 0);
  const preliminar = n > p;
  const disputam = preliminar ? vivos.slice(n - 2 * (n - p)) : vivos;
  const folgas = preliminar ? vivos.slice(0, n - 2 * (n - p)) : [];
  const ordem = new Map(c.clubes.map((id, i) => [id, i]));
  const misturados = embaralhar(disputam, rng);
  const jogos: JogoCopa[] = [];
  for (let i = 0; i + 1 < misturados.length; i += 2) {
    const [a, b] = [misturados[i], misturados[i + 1]];
    const aPior = (ordem.get(a) ?? 0) > (ordem.get(b) ?? 0);
    jogos.push(aPior ? { mandante: a, visitante: b } : { mandante: b, visitante: a });
  }
  return { nome: nomeDaFase(disputam.length, preliminar), jogos, folgas };
}

export function novaCopa(
  dados: Pick<Copa, "id" | "nome" | "tipo" | "ano" | "seed" | "clubes">,
  rodadas: number,
): Copa {
  const c: Copa = {
    ...dados,
    fases: [],
    datas: datasDasFases(totalDeFases(dados.clubes.length), rodadas, dados.tipo === "continental"),
  };
  return dados.clubes.length < 2 ? { ...c, campeao: dados.clubes[0] } : { ...c, fases: [sortear(c, dados.clubes)] };
}

export const faseAtual = (c: Copa): FaseCopa | null => (c.campeao ? null : (c.fases[c.fases.length - 1] ?? null));
/** A fase atual já pode ser jogada (rodadas da liga suficientes)? */
export const faseDevida = (c: Copa, rodadasJogadas: number) =>
  !c.campeao && c.fases.length > 0 && c.datas[c.fases.length - 1] <= rodadasJogadas;

/** Índice do jogo do clube na fase atual (jogado ou não), ou -1. */
export const jogoDoClube = (c: Copa, id: string) =>
  faseAtual(c)?.jogos.findIndex((j) => j.mandante === id || j.visitante === id) ?? -1;

/** O clube ainda está na copa? */
export function estaVivo(c: Copa, id: string): boolean {
  if (c.campeao) return c.campeao === id;
  const f = faseAtual(c);
  return !!f && (f.folgas.includes(id) || f.jogos.some((j) => j.mandante === id || j.visitante === id));
}

export function vencedorDoJogo(j: JogoCopa): string | null {
  if (!j.placar) return null;
  const [m, v] = j.penaltis ?? j.placar;
  return m > v ? j.mandante : v > m ? j.visitante : null;
}

export const seedDoJogoCopa = (c: Copa, fase: number, jogo: number) =>
  (c.seed ^ (fase * 6151 + jogo * 92821 + 17)) >>> 0;

/** Pênaltis: cinco cobranças para cada lado e alternadas até alguém errar. */
export function disputaDePenaltis(seed: number): [number, number] {
  const rng = criarRng(seed);
  const cobra = () => (rng() < 0.76 ? 1 : 0);
  let [a, b] = [0, 0];
  for (let i = 0; i < 5; i++) {
    a += cobra();
    b += cobra();
  }
  while (a === b) {
    a += cobra();
    b += cobra();
  }
  return [a, b];
}

/** Grava o placar de um jogo da fase atual (com pênaltis se empatou). */
export function registrarJogo(c: Copa, indice: number, golsMandante: number, golsVisitante: number): Copa {
  const f = faseAtual(c);
  if (!f || !f.jogos[indice] || f.jogos[indice].placar) return c;
  const fase = c.fases.length - 1;
  const jogo: JogoCopa = { ...f.jogos[indice], placar: [golsMandante, golsVisitante] };
  if (golsMandante === golsVisitante) jogo.penaltis = disputaDePenaltis(seedDoJogoCopa(c, fase, indice) ^ 0x5bd1e995);
  const jogos = f.jogos.map((j, i) => (i === indice ? jogo : j));
  return { ...c, fases: [...c.fases.slice(0, -1), { ...f, jogos }] };
}

/** Simula o que falta da fase atual e sorteia a próxima (ou define o campeão). */
export function concluirFase(c: Copa, times: Map<string, Time>): Copa {
  const f = faseAtual(c);
  if (!f) return c;
  const fase = c.fases.length - 1;
  f.jogos.forEach((j, i) => {
    if (j.placar) return;
    const r: ResultadoPartida = simularPartida(times.get(j.mandante)!, times.get(j.visitante)!, seedDoJogoCopa(c, fase, i));
    c = registrarJogo(c, i, r.golsMandante, r.golsVisitante);
  });
  const feita = faseAtual(c)!;
  const passam = new Set([...feita.folgas, ...feita.jogos.map((j) => vencedorDoJogo(j)!)]);
  const vivos = c.clubes.filter((id) => passam.has(id));
  if (vivos.length === 1) return { ...c, campeao: vivos[0] };
  return { ...c, fases: [...c.fases, sortear(c, vivos)] };
}

/**
 * Joga as fases que já chegaram, menos a que tem jogo do técnico (essa
 * espera ele jogar). `rodadasJogadas` = rodadas da liga já disputadas.
 */
export function avancarCopas(copas: Copa[], rodadasJogadas: number, times: Map<string, Time>, meuId: string): Copa[] {
  return copas.map((c) => {
    while (faseDevida(c, rodadasJogadas) && jogoDoClube(c, meuId) < 0) c = concluirFase(c, times);
    return c;
  });
}

/** A copa com jogo do técnico esperando para ser disputado (ou já jogado, esperando concluir a fase). */
export function copaPendente(copas: Copa[], rodadasJogadas: number, meuId: string): Copa | null {
  return copas.find((c) => faseDevida(c, rodadasJogadas) && jogoDoClube(c, meuId) >= 0) ?? null;
}

/** Até onde o clube foi: "Campeão", "Final", "Eliminado na Semifinal"... ou null se não jogou. */
export function campanha(c: Copa, id: string): { texto: string; vivo: boolean } | null {
  if (!c.clubes.includes(id)) return null;
  if (c.campeao === id) return { texto: "Campeão", vivo: false };
  for (const f of c.fases) {
    const j = f.jogos.find((x) => x.mandante === id || x.visitante === id);
    if (!j) continue;
    const venc = vencedorDoJogo(j);
    if (venc && venc !== id) return { texto: `Eliminado: ${f.nome}`, vivo: false };
  }
  const atual = faseAtual(c);
  if (!atual) return { texto: "Eliminado", vivo: false };
  if (atual.folgas.includes(id)) {
    const proxima = nomesDasFases(c.clubes.length)[c.fases.length];
    return { texto: `Entra direto na ${proxima}`.replace("na Fase", "na fase"), vivo: true };
  }
  return { texto: `Na ${atual.nome}`.replace("Na Fase", "Na fase"), vivo: true };
}

// ---- Montagem das copas da temporada ----

export interface DadosTemporadaCopas {
  ano: number;
  seed: number;
  /** Divisão do técnico na temporada que começa. */
  minhaDivisao: Divisao;
  /** Divisão de cada clube (todos os países). */
  divisoes: Record<string, Divisao>;
  /** Força de cada clube (usada para cabeças de chave e para estimar tabelas). */
  forca: Map<string, number>;
  /** Tabela final (ids em ordem) da temporada anterior, por divisão. Só o país do técnico tem. */
  tabelas?: Record<Divisao, string[]>;
  /** Rodadas da liga do técnico. */
  rodadas: number;
}

const porForca = (ids: string[], forca: Map<string, number>) =>
  [...ids].sort((a, b) => (forca.get(b) ?? 0) - (forca.get(a) ?? 0) || a.localeCompare(b));

/** Quantas vagas da primeira divisão a continental tem (zonas cumulativas). */
export function vagasContinentais(liga: Liga, cont: Continental): number {
  return Math.max(0, ...liga.zonas.filter((z) => !z.deBaixo && cont.zonas.includes(z.nome)).map((z) => z.ate));
}

/** A continental do país da divisão, se houver (Arábia Saudita fica sem). */
export function continentalDoPais(d: Divisao): Continental | null {
  const pais = ligaDe(d).pais;
  const primeira = LIGAS.find((l) => l.pais === pais && l.nivel === 1);
  return CONTINENTAIS.find((c) => primeira && vagasContinentais(primeira, c) > 0) ?? null;
}

/** Classificados da continental: os primeiros de cada primeira divisão, pela tabela ou pela força. */
export function classificadosContinental(cont: Continental, dados: DadosTemporadaCopas): string[] {
  const ids: string[] = [];
  for (const liga of LIGAS.filter((l) => l.nivel === 1)) {
    const vagas = vagasContinentais(liga, cont);
    if (!vagas) continue;
    const tabela =
      dados.tabelas?.[liga.id] ??
      porForca(
        Object.keys(dados.divisoes).filter((id) => dados.divisoes[id] === liga.id),
        dados.forca,
      );
    ids.push(...tabela.slice(0, vagas));
  }
  return porForca(ids, dados.forca);
}

/** Copa nacional do país do técnico e a continental do continente dele. */
export function criarCopasDaTemporada(dados: DadosTemporadaCopas): Copa[] {
  const liga = ligaDe(dados.minhaDivisao);
  const nivelDe = (id: string) => ligaDe(dados.divisoes[id]).nivel;
  const doPais = Object.keys(dados.divisoes).filter((id) => ligaDe(dados.divisoes[id]).pais === liga.pais);
  const nacionais = porForca(doPais, dados.forca).sort((a, b) => nivelDe(a) - nivelDe(b));
  const copas = [
    novaCopa(
      {
        id: idCopaNacional(liga.sigla),
        nome: COPAS_NACIONAIS[liga.sigla] ?? `Copa (${liga.pais})`,
        tipo: "nacional",
        ano: dados.ano,
        seed: (dados.seed ^ 0x9e3779b9) >>> 0,
        clubes: nacionais,
      },
      dados.rodadas,
    ),
  ];
  const cont = continentalDoPais(dados.minhaDivisao);
  if (cont)
    copas.push(
      novaCopa(
        {
          id: cont.id,
          nome: cont.nome,
          tipo: "continental",
          ano: dados.ano,
          seed: (dados.seed ^ 0x85ebca6b) >>> 0,
          clubes: classificadosContinental(cont, dados),
        },
        dados.rodadas,
      ),
    );
  return copas;
}
