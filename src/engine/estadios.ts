/**
 * Estádios: capacidade, atmosfera e qualidade mexem no jogo.
 *
 * - Bilheteria: o público médio sai da capacidade e da atmosfera (torcida que lota),
 *   o preço do ingresso da qualidade (conforto, camarotes). A renda vira um fator
 *   de 0,8 a 1,3 sobre a bilheteria base da carreira (ver financasIniciais).
 * - Fator casa: a atmosfera empurra o mandante. Atmosfera 50 = a vantagem padrão
 *   do motor (1,06); La Bombonera (99) chega perto de 1,10.
 *
 * As contas são as mesmas de api/estadios_lib.php; se mudar uma, mude a outra.
 */

export interface Estadio {
  nome: string;
  capacidade: number;
  /** 1-100: pressão da torcida. */
  atmosfera: number;
  /** 1-100: conforto, estrutura e conservação. */
  qualidade: number;
}

/** Torcedores num jogo comum: lotação de 45% a 95%, conforme a atmosfera. */
export function publicoMedio(e: Estadio): number {
  return Math.round(e.capacidade * (0.45 + 0.5 * (e.atmosfera / 100)));
}

/** Preço relativo do ingresso: 0,6 a 1,4, conforme a qualidade. */
export const precoRelativo = (e: Estadio) => 0.6 + 0.8 * (e.qualidade / 100);

const RENDA_MIN = 3000;
const RENDA_MAX = 50000;

/** Multiplica a bilheteria base: 0,8 (estádio pequeno e vazio) a 1,3 (gigante e lotado). */
export function fatorBilheteria(e: Estadio): number {
  const renda = publicoMedio(e) * precoRelativo(e);
  const t = Math.min(1, Math.max(0, Math.log(renda / RENDA_MIN) / Math.log(RENDA_MAX / RENDA_MIN)));
  return Math.round((0.8 + 0.5 * t) * 1000) / 1000;
}

/** Força extra do mandante (multiplica defesa, meio e ataque). */
export function fatorCasa(e: Pick<Estadio, "atmosfera">): number {
  return Math.round((1.02 + 0.08 * (e.atmosfera / 100)) * 1000) / 1000;
}

/** Rótulo curto de uma nota de 1 a 100. */
export function rotuloNota(n: number): string {
  if (n >= 90) return "Lendária";
  if (n >= 80) return "Excelente";
  if (n >= 65) return "Boa";
  if (n >= 50) return "Regular";
  return "Fraca";
}
