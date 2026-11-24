import { criarRng } from "./rng";
import { ehLenda, type Jogador, type Time } from "./types";

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

export interface Lancamento {
  /** Rodada (1 a 38) ou 0 para fora do campeonato. */
  rodada: number;
  descricao: string;
  valor: number;
}

export interface Financas {
  caixa: number;
  /** Receita de TV e patrocínio por rodada, fixada no início da carreira. */
  receitaPorRodada: number;
  /** Bilheteria por jogo em casa. */
  bilheteria: number;
  /** Últimos lançamentos, do mais novo para o mais antigo. */
  extrato: Lancamento[];
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

export function lancar(f: Financas, ls: Lancamento[]): Financas {
  const soma = ls.reduce((s, l) => s + l.valor, 0);
  return { ...f, caixa: f.caixa + soma, extrato: [...[...ls].reverse(), ...f.extrato].slice(0, 60) };
}

/** Lançamentos de uma rodada disputada. */
export function balancoDaRodada(f: Financas, meuTime: Time, rodada: number, emCasa: boolean): Lancamento[] {
  const ls: Lancamento[] = [{ rodada, descricao: "TV e patrocínio", valor: f.receitaPorRodada }];
  if (emCasa) ls.push({ rodada, descricao: "Bilheteria", valor: f.bilheteria });
  ls.push({ rodada, descricao: "Salários", valor: -Math.round(folhaMensal(meuTime) / RODADAS_POR_MES) });
  return ls;
}

/** Premiação em dinheiro pela posição final: o campeão leva 10 rodadas de receita. */
export const premiacaoEmDinheiro = (f: Financas, posicao: number) =>
  Math.round(f.receitaPorRodada * (21 - posicao) * 0.5);

/** Preço pedido pelo clube dono: 20% acima do valor, 60% acima para um dos 3 melhores do elenco. */
export function precoDeCompra(j: Jogador, dono: Time): number {
  const melhores = atuais(dono)
    .sort((a, b) => b.geral - a.geral)
    .slice(0, 3)
    .map((x) => x.id);
  const fator = melhores.includes(j.id) ? 1.6 : 1.2;
  return Math.round((valorDeMercado(j) * fator) / 50) * 50;
}

export type MotivoRecusa = "caixa" | "meu-elenco-cheio" | "elenco-dele-curto" | null;

export function podeComprar(j: Jogador, dono: Time, meu: Time, caixa: number): MotivoRecusa {
  if (atuais(dono).length <= MIN_ELENCO) return "elenco-dele-curto";
  if (atuais(meu).length >= MAX_ELENCO) return "meu-elenco-cheio";
  if (caixa < precoDeCompra(j, dono)) return "caixa";
  return null;
}

export interface Proposta {
  jogadorId: string;
  clubeId: string;
  valor: number;
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
export function propostaPor(j: Jogador, meuTimeId: string, times: Time[], nivel: Map<string, number>, rodada: number, seed: number): Proposta {
  const rng = criarRng(hash(`${j.id}|${rodada}|${seed}`));
  const candidatos = times.filter((t) => t.id !== meuTimeId && (nivel.get(t.id) ?? 0) >= j.geral - 6);
  const lista = candidatos.length ? candidatos : times.filter((t) => t.id !== meuTimeId);
  const clube = lista[Math.floor(rng() * lista.length)];
  const valor = Math.round((valorDeMercado(j) * (0.75 + rng() * 0.3)) / 50) * 50;
  return { jogadorId: j.id, clubeId: clube.id, valor };
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
