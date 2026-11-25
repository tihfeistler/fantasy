import type { Rng } from "./rng";
import type { Jogador } from "./types";

/** Faixas das cartas de lenda pelo geral. */
export type Faixa = "comum" | "rara" | "icone";
export function faixa(j: Jogador): Faixa {
  return j.geral >= 88 ? "icone" : j.geral >= 80 ? "rara" : "comum";
}

/** Chance de cada carta do pacote cair em cada faixa (mostrada ao jogador). */
export const CHANCES: Record<Faixa, number> = { comum: 0.7, rara: 0.25, icone: 0.05 };
export const PRECO_PACOTE = 500;
export const CARTAS_POR_PACOTE = 5;
export const VALOR_VENDA: Record<Faixa, number> = { comum: 100, rara: 200, icone: 400 };
/**
 * Valor de venda de uma carta conforme quantas cópias dela você tem
 * (estoque + elenco): cada cópia a mais tira 15%, até a metade do valor.
 */
export function valorDeVenda(j: Jogador, copias: number): number {
  const fator = Math.max(0.5, 1 - 0.15 * Math.max(0, copias - 1));
  return Math.round((VALOR_VENDA[faixa(j)] * fator) / 5) * 5;
}
/** Lendas que podem jogar juntas entre os titulares. No elenco não há limite. */
export const MAX_LENDAS_EM_CAMPO = 3;
/** Espaço para cartas (estoque + lendas no elenco), e como ampliá-lo. */
export const LIMITE_CARTAS_INICIAL = 300;
export const LIMITE_CARTAS_MAXIMO = 500;
export const AMPLIACAO = { cartas: 10, preco: 1000 };

/** Prêmio em moedas por resultado de partida. */
export const PREMIO = { vitoria: 300, empate: 150, derrota: 50 };

/** Sorteia as cartas de um pacote. Faixa sem cartas cai para a próxima disponível. */
export function abrirPacote(lendas: Jogador[], rng: Rng, n = CARTAS_POR_PACOTE): Jogador[] {
  const porFaixa: Record<Faixa, Jogador[]> = { comum: [], rara: [], icone: [] };
  for (const j of lendas) porFaixa[faixa(j)].push(j);
  const ordem: Faixa[] = ["comum", "rara", "icone"];
  const saida: Jogador[] = [];
  for (let i = 0; i < n; i++) {
    const r = rng();
    let f: Faixa = r < CHANCES.icone ? "icone" : r < CHANCES.icone + CHANCES.rara ? "rara" : "comum";
    if (!porFaixa[f].length) f = ordem.find((x) => porFaixa[x].length) ?? f;
    const lista = porFaixa[f];
    if (!lista.length) break;
    saida.push(lista[Math.floor(rng() * lista.length)]);
  }
  return saida;
}
