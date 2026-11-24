import type { Temporada } from "../engine/campeonato";

/**
 * Progresso do jogador no modo solo: moedas, cartas no estoque e lendas
 * levadas para o elenco de cada clube. Fica no navegador (localStorage);
 * no modo online isso vai para as tabelas usuarios/cartas do MySQL.
 */
export interface Manager {
  nome: string;
  /** Clube escolhido ao criar a carreira; não muda depois. */
  clubeId: string;
  /** AAAA-MM-DD */
  criadoEm: string;
}

export interface Progresso {
  /** Sem manager: o jogo abre na tela de criação. */
  manager?: Manager;
  moedas: number;
  /** ids de lendas no estoque (pode repetir). */
  estoque: string[];
  /** Formação e titulares escolhidos para o clube do manager. */
  escalacao?: { formacao: string; titulares: string[] };
  /** ids de lendas no elenco, por clube. */
  noElenco: Record<string, string[]>;
  /** Brasileirão em andamento (calendário, rodada atual e placares). */
  temporada?: Temporada;
  /** Temporadas encerradas. */
  historico?: { ano: number; posicao: number; campeao: string }[];
}

const CHAVE = "fantasy-progresso-v1";
export const PROGRESSO_INICIAL: Progresso = { moedas: 1500, estoque: [], noElenco: {} };

export function carregarProgresso(): Progresso {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return { ...PROGRESSO_INICIAL, ...JSON.parse(bruto) };
  } catch {
    /* sem armazenamento: começa do zero */
  }
  return PROGRESSO_INICIAL;
}

export function salvarProgresso(p: Progresso) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    /* ignora: o jogo segue sem salvar */
  }
}
