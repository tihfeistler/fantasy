import { criarRng } from "./rng";
import { ehLenda, type Jogador, type Posicao, type Time } from "./types";

/**
 * Mercado de jogadores atuais e finanças do clube. Valores em R$ mil.
 * Lendas não entram aqui: não têm valor de mercado nem salário.
 */

/** Valor de mercado pelo geral: dobra a cada 5 pontos (geral 60 = R$ 2 mi, 80 = R$ 32 mi). */
export function valorDeMercado(j: Jogador): number {
  const v = 2000 * 2 ** ((j.geral - 60) / 5);
  return Math.max(100, Math.round(v / 50) * 50);
}

/** Salário mensal: 1% do valor de mercado, no mínimo R$ 20 mil. */
export function salarioMensal(j: Jogador): number {
  return Math.max(20, Math.round(valorDeMercado(j) / 100 / 5) * 5);
}

export const MIN_ELENCO = 18;
export const MAX_ELENCO = 45;
/** Partidas por mês: a folha é paga em quartos, um a cada rodada. */
export const RODADAS_POR_MES = 4;

const atuais = (t: Time) => t.elenco.filter((j) => !ehLenda(j));

export const folhaMensal = (t: Time) => atuais(t).reduce((s, j) => s + salarioMensal(j), 0);
export const valorDoElenco = (t: Time) => atuais(t).reduce((s, j) => s + valorDeMercado(j), 0);

/** Tipo do lançamento: o servidor confere cada um antes de mexer no caixa da conta. */
export type TipoLancamento =
  | "tv"
  | "bilheteria"
  | "salarios"
  | "juros"
  | "compra"
  | "venda"
  | "premiacao"
  | "desafio-custo"
  | "desafio-premio"
  | "partida"
  | "copa"
  | "aviso";

export interface Lancamento {
  /** Rodada (1 a 38) ou 0 para fora do campeonato. */
  rodada: number;
  descricao: string;
  valor: number;
  tipo?: TipoLancamento;
  /** Temporada do lançamento. */
  ano?: number;
  /** Jogador (compra e venda) ou desafio. */
  ref?: string;
  /** Moedas ganhas junto (prêmio de partida, de temporada ou de desafio). */
  moedas?: number;
  /** Lenda ganha na primeira vitória de um desafio (vai para a coleção da conta). */
  carta?: string;
  /** Número sequencial, dado por `lancar`; o servidor aplica cada número uma vez. */
  n?: number;
}

export interface Financas {
  caixa: number;
  /** Receita de TV e patrocínio por rodada, fixada no início da carreira. */
  receitaPorRodada: number;
  /** Bilheteria por jogo em casa. */
  bilheteria: number;
  /** Últimos lançamentos, do mais novo para o mais antigo. */
  extrato: Lancamento[];
  /** Quantos lançamentos já foram feitos (numera os novos). */
  seq?: number;
}

/**
 * Finanças iniciais: caixa de 10% do valor do elenco e receitas que
 * cobrem a folha atual com uma pequena sobra (TV e patrocínio pagam 75%
 * da folha; a bilheteria dos jogos em casa, o resto e um pouco mais).
 */
export function financasIniciais(t: Time): Financas {
  const folhaRodada = folhaMensal(t) / RODADAS_POR_MES;
  return {
    caixa: Math.round(valorDoElenco(t) * 0.1),
    receitaPorRodada: Math.round(folhaRodada * 0.75),
    bilheteria: Math.round(folhaRodada * 0.6),
    extrato: [],
  };
}

/** TV e patrocínio na Série B valem metade; a bilheteria cai um quarto. */
export const FATOR_TV_SERIE_B = 0.5;
export const FATOR_BILHETERIA_SERIE_B = 0.75;

/** Receitas ao subir (fator > 1) ou cair (fator < 1) de divisão. */
export function financasAoMudarDeDivisao(f: Financas, subiu: boolean): Financas {
  const tv = subiu ? 1 / FATOR_TV_SERIE_B : FATOR_TV_SERIE_B;
  const bil = subiu ? 1 / FATOR_BILHETERIA_SERIE_B : FATOR_BILHETERIA_SERIE_B;
  return { ...f, receitaPorRodada: Math.round(f.receitaPorRodada * tv), bilheteria: Math.round(f.bilheteria * bil) };
}

export function lancar(f: Financas, ls: Lancamento[]): Financas {
  const soma = ls.reduce((s, l) => s + l.valor, 0);
  const seq = f.seq ?? 0;
  const numerados = ls.map((l, i) => ({ ...l, n: seq + i + 1 }));
  return {
    ...f,
    caixa: f.caixa + soma,
    seq: seq + ls.length,
    extrato: [...numerados.reverse(), ...f.extrato].slice(0, 60),
  };
}

/** Lançamentos de uma rodada disputada. */
export function balancoDaRodada(
  f: Financas,
  meuTime: Time,
  rodada: number,
  emCasa: boolean,
  /** Folha mensal com os salários de contrato; sem ela, usa o salário de tabela. */
  folha = folhaMensal(meuTime),
): Lancamento[] {
  const ls: Lancamento[] = [{ rodada, descricao: "TV e patrocínio", valor: f.receitaPorRodada, tipo: "tv" }];
  if (emCasa) ls.push({ rodada, descricao: "Bilheteria", valor: f.bilheteria, tipo: "bilheteria" });
  ls.push({ rodada, descricao: "Salários", valor: -Math.round(folha / RODADAS_POR_MES), tipo: "salarios" });
  return ls;
}

/**
 * Caixa negativo. Cada rodada no vermelho cobra 2% de juros sobre a dívida e
 * trava as contratações. Quatro rodadas seguidas no vermelho custam 3 pontos
 * na tabela (e a contagem recomeça).
 */
export const JUROS_DIVIDA = 0.02;
export const RODADAS_ATE_PUNICAO = 4;
export const PONTOS_DE_PUNICAO = 3;
export function dividaDaRodada(
  caixa: number,
  rodada: number,
  noVermelho: number,
): { lancamentos: Lancamento[]; noVermelho: number; perdePontos: boolean } {
  if (caixa >= 0) return { lancamentos: [], noVermelho: 0, perdePontos: false };
  const juros = Math.max(10, Math.round((-caixa * JUROS_DIVIDA) / 10) * 10);
  const n = noVermelho + 1;
  const perdePontos = n >= RODADAS_ATE_PUNICAO;
  return {
    lancamentos: [{ rodada, descricao: "Juros da dívida", valor: -juros, tipo: "juros" }],
    noVermelho: perdePontos ? 0 : n,
    perdePontos,
  };
}

/** Premiação em dinheiro pela posição final: o campeão leva 10 rodadas de receita. */
export const premiacaoEmDinheiro = (f: Financas, posicao: number, total = 20) =>
  Math.round((f.receitaPorRodada * Math.max(1, total + 1 - posicao) * 10) / total);

/**
 * Oferta e procura: quanto mais jogadores parecidos (mesma posição, geral
 * até 2 pontos de diferença) existem na liga, mais barato; posição e nível
 * raros ficam mais caros. Fator entre 0,85 e 1,20.
 */
export type Oferta = (j: Jogador) => number;
export function criarOferta(times: Time[]): Oferta {
  const contagem = new Map<string, number>();
  const todos = times.flatMap(atuais);
  for (const j of todos) contagem.set(`${j.posicao}|${j.geral}`, (contagem.get(`${j.posicao}|${j.geral}`) ?? 0) + 1);
  const parecidos = (p: Posicao, g: number) => {
    let n = 0;
    for (let d = -2; d <= 2; d++) n += contagem.get(`${p}|${g + d}`) ?? 0;
    return Math.max(1, n);
  };
  const media = todos.reduce((s, j) => s + parecidos(j.posicao, j.geral), 0) / Math.max(1, todos.length);
  return (j) => Math.min(1.2, Math.max(0.85, (media / parecidos(j.posicao, j.geral)) ** 0.35));
}

/** Elenco ideal por posição: com mais que isso, o clube tem sobra; com menos, carência. */
export const ELENCO_IDEAL: Record<Posicao, number> = { GOL: 3, ZAG: 4, LAT: 4, VOL: 3, MEI: 4, ATA: 4 };
export function situacaoNaPosicao(t: Time, p: Posicao): "sobra" | "carencia" | "normal" {
  const n = atuais(t).filter((j) => j.posicao === p).length;
  return n > ELENCO_IDEAL[p] + 1 ? "sobra" : n < ELENCO_IDEAL[p] ? "carencia" : "normal";
}

export interface DetalhePreco {
  preco: number;
  /** Fator de oferta na liga (0,85 a 1,20). */
  liga: number;
  /** Fator do clube dono: sobra na posição barateia, carência encarece. */
  clube: number;
  /** Um dos 3 melhores do clube. */
  destaque: boolean;
}

/**
 * Preço pedido pelo clube dono: valor de mercado ajustado pela oferta na
 * liga e pela situação do dono na posição, mais 20% (60% para um dos 3
 * melhores do elenco).
 */
export function detalharPreco(j: Jogador, dono: Time, oferta: Oferta): DetalhePreco {
  const destaque = atuais(dono)
    .sort((a, b) => b.geral - a.geral)
    .slice(0, 3)
    .some((x) => x.id === j.id);
  const sit = situacaoNaPosicao(dono, j.posicao);
  const clube = sit === "sobra" ? 0.85 : sit === "carencia" ? 1.2 : 1;
  const liga = oferta(j);
  const preco = Math.round((valorDeMercado(j) * liga * clube * (destaque ? 1.6 : 1.2)) / 50) * 50;
  return { preco, liga, clube, destaque };
}
export const precoDeCompra = (j: Jogador, dono: Time, oferta: Oferta) => detalharPreco(j, dono, oferta).preco;

export type MotivoRecusa = "caixa" | "meu-elenco-cheio" | "elenco-dele-curto" | null;

export function podeComprar(j: Jogador, dono: Time, meu: Time, caixa: number, oferta: Oferta): MotivoRecusa {
  if (atuais(dono).length <= MIN_ELENCO) return "elenco-dele-curto";
  if (atuais(meu).length >= MAX_ELENCO) return "meu-elenco-cheio";
  if (caixa < precoDeCompra(j, dono, oferta)) return "caixa";
  return null;
}

export interface Proposta {
  jogadorId: string;
  clubeId: string;
  valor: number;
  /** Máximo que o clube aceita pagar se você negociar (escondido do jogador). */
  teto: number;
}

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Proposta da IA por um jogador do manager. Muda a cada rodada, mas é a
 * mesma dentro da rodada (recarregar a página não sorteia outra).
 * Quem compra é um clube que comporta o jogador: nível perto ou acima do geral.
 */
export function propostaPor(
  j: Jogador,
  meuTimeId: string,
  times: Time[],
  nivel: Map<string, number>,
  rodada: number,
  seed: number,
  oferta: Oferta,
): Proposta {
  const rng = criarRng(hash(`${j.id}|${rodada}|${seed}`));
  const candidatos = times.filter((t) => t.id !== meuTimeId && (nivel.get(t.id) ?? 0) >= j.geral - 6);
  const lista = candidatos.length ? candidatos : times.filter((t) => t.id !== meuTimeId);
  const clube = lista[Math.floor(rng() * lista.length)];
  // Oferta na liga pesa igual; quem tem carência na posição paga 10% a mais.
  const precisa = situacaoNaPosicao(clube, j.posicao) === "carencia" ? 1.1 : 1;
  const valor = Math.round((valorDeMercado(j) * oferta(j) * precisa * (0.75 + rng() * 0.3)) / 50) * 50;
  const teto = Math.round((valor * (1.05 + rng() * 0.2)) / 50) * 50;
  return { jogadorId: j.id, clubeId: clube.id, valor, teto };
}

/** "R$ 12,5 mi" ou "R$ 850 mil". */
export function formatarDinheiro(mil: number): string {
  const sinal = mil < 0 ? "−" : "";
  const v = Math.abs(mil);
  if (v >= 1000) {
    const mi = v / 1000;
    return `${sinal}R$ ${mi.toLocaleString("pt-BR", { maximumFractionDigits: mi >= 100 ? 0 : 1 })} mi`;
  }
  return `${sinal}R$ ${Math.round(v)} mil`;
}
