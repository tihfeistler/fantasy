import { salarioMensal } from "./mercado";
import { ehLenda, type Jogador } from "./types";

/**
 * Contratos dos jogadores atuais do clube do técnico (carreira).
 *
 * Cada jogador tem salário mensal (R$ mil) e um último ano de contrato. No
 * fim da temporada desse ano, quem não renovou vai embora de graça. Para
 * contratar ou renovar, o técnico propõe salário e duração; o jogador pede
 * um pouco mais por contratos longos e tem um "humor" que muda a cada rodada.
 * Lendas são cartas: não têm contrato nem salário.
 */

export interface Contrato {
  /** Último ano (temporada) do contrato. */
  ate: number;
  /** Salário mensal em R$ mil. */
  salario: number;
}

export const DURACAO_MAXIMA = 5;
/** Abaixo de 80% do pedido, o jogador nem conversa. */
export const LIMITE_CONTRAPROPOSTA = 0.8;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const arred5 = (v: number) => Math.max(5, Math.round(v / 5) * 5);

/** Contrato de quem nunca negociou: salário de tabela e fim entre o ano inicial e +3 (fixo por jogador). */
export function contratoPadrao(j: Jogador, anoInicial: number): Contrato {
  return { ate: anoInicial + (hash(j.id) % 4), salario: salarioMensal(j) };
}

export function contratoDe(j: Jogador, contratos: Record<string, Contrato> | undefined, anoInicial: number): Contrato {
  return contratos?.[j.id] ?? contratoPadrao(j, anoInicial);
}

/** Salário que conta na folha: o do contrato; sem contrato, o de tabela. Lenda: zero. */
export function salarioDoJogador(j: Jogador, contratos: Record<string, Contrato> | undefined, anoInicial: number): number {
  return ehLenda(j) ? 0 : contratoDe(j, contratos, anoInicial).salario;
}

/**
 * Quanto o jogador pede por mês: salário de tabela, +4% por ano a mais de
 * contrato e o humor do momento (0,95 a 1,20, muda a cada rodada).
 */
export function pedidaSalarial(j: Jogador, anos: number, momento: number): number {
  const humor = 0.95 + (hash(`${j.id}|${momento}`) % 1000) / 4000;
  return arred5(salarioMensal(j) * (1 + 0.04 * (anos - 1)) * humor);
}

export type RespostaContrato =
  | { tipo: "aceita"; contrato: Contrato }
  | { tipo: "contraproposta"; pedida: number }
  | { tipo: "recusa"; pedida: number };

/**
 * Resposta a uma proposta de contrato. `anoInicio` é a primeira temporada do
 * contrato novo; `momento` identifica a rodada (o humor muda entre rodadas).
 */
export function negociarContrato(
  j: Jogador,
  salario: number,
  anos: number,
  anoInicio: number,
  momento: number,
): RespostaContrato {
  const n = Math.min(DURACAO_MAXIMA, Math.max(1, Math.round(anos)));
  const pedida = pedidaSalarial(j, n, momento);
  if (salario >= pedida) return { tipo: "aceita", contrato: { ate: anoInicio + n - 1, salario: Math.round(salario) } };
  if (salario >= pedida * LIMITE_CONTRAPROPOSTA) return { tipo: "contraproposta", pedida };
  return { tipo: "recusa", pedida };
}

/** Folha mensal com os salários de contrato. */
export function folhaComContratos(
  elenco: Jogador[],
  contratos: Record<string, Contrato> | undefined,
  anoInicial: number,
): number {
  return elenco.reduce((s, j) => s + salarioDoJogador(j, contratos, anoInicial), 0);
}

/** Jogadores atuais cujo contrato termina no ano dado (ou antes). */
export function contratosTerminando(
  elenco: Jogador[],
  contratos: Record<string, Contrato> | undefined,
  anoInicial: number,
  ano: number,
): Jogador[] {
  return elenco.filter((j) => !ehLenda(j) && contratoDe(j, contratos, anoInicial).ate <= ano);
}

/**
 * Para onde vai quem sai de graça no fim do contrato: um clube fixo por
 * jogador e ano, entre os da lista (o do técnico fica de fora).
 */
export function destinoDaSaida(j: Jogador, clubes: string[], meuClube: string, ano: number): string {
  const outros = clubes.filter((c) => c !== meuClube);
  return outros[hash(`${j.id}|saida|${ano}`) % outros.length];
}
