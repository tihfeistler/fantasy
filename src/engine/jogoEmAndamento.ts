import { simularPartida, type Decisao } from "./match";
import type { ResultadoPartida, Time } from "./types";

/**
 * Jogo do técnico contra a IA que já começou. Fica salvo na conta antes da bola rolar
 * (com os dois times como estavam e cada decisão tomada), então fechar o navegador ou
 * sair da tela não deixa jogar de novo: o jogo é concluído com o que já foi decidido.
 */
export interface JogoEmAndamento {
  tipo: "liga" | "copa" | "desafio";
  /**
   * Qual jogo é. liga: "ano:rodada:jogo"; copa: "copaId:ano:fase:jogo"; desafio: id do desafio.
   * O servidor (api/carreira.php) usa isso para saber se o resultado já foi gravado.
   */
  ref: string;
  mandante: Time;
  visitante: Time;
  seed: number;
  meuTimeId: string;
  decisoes: Decisao[];
}

export const refJogoLiga = (ano: number, rodada: number, jogo: number) => `${ano}:${rodada}:${jogo}`;
export const refJogoCopa = (copaId: string, ano: number, fase: number, jogo: number) =>
  `${copaId}:${ano}:${fase}:${jogo}`;

/**
 * Termina o jogo que o técnico deixou no meio: mesma seed, mesmos times e as decisões dele nos
 * seus minutos. Dá o mesmo placar que ele veria se ficasse na tela sem mexer em mais nada.
 */
export const concluirJogo = (j: JogoEmAndamento): ResultadoPartida =>
  simularPartida(j.mandante, j.visitante, j.seed, j.decisoes, [j.meuTimeId]);
