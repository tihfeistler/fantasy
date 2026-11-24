import type { Temporada } from "../engine/campeonato";
import type { Financas } from "../engine/mercado";
import type { MercadoCartas } from "../engine/mercadoCartas";
import type { TimeCartas } from "../engine/desafios";
import { LIMITE_CARTAS_INICIAL } from "../engine/pacotes";

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
  escalacao?: { formacao: string; titulares: string[]; banco?: string[] };
  /** ids de lendas no elenco, por clube. */
  noElenco: Record<string, string[]>;
  /** Quantas cartas cabem no total (estoque + lendas no elenco). Sem valor: LIMITE_CARTAS_INICIAL. */
  limiteCartas?: number;
  /** Compras e vendas de jogadores atuais: jogadorId -> clube atual. */
  transferencias?: Record<string, string>;
  /** Caixa, receitas e extrato do clube do manager. */
  financas?: Financas;
  /** Mercado de cartas entre técnicos (na prévia, com técnicos simulados). */
  mercadoCartas?: MercadoCartas;
  /** Jogadores atuais já negociados com a IA, e em qual rodada (uma negociação por rodada). */
  negociacoes?: Record<string, number>;
  /** Cartas base (ids de jogadores atuais) compradas do sistema para o time de cartas. */
  cartasBase?: string[];
  /** Time de cartas dos desafios (e do online): caixa, escalação e histórico. */
  timeCartas?: TimeCartas;
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

export const limiteCartas = (p: Progresso) => Math.max(p.limiteCartas ?? 0, LIMITE_CARTAS_INICIAL);
/** Cartas que o manager tem: estoque mais lendas levadas a qualquer elenco. */
export const totalCartas = (p: Progresso) =>
  p.estoque.length +
  Object.values(p.noElenco).reduce((n, ids) => n + ids.length, 0) +
  (p.mercadoCartas?.meus.length ?? 0);

/** Cópias de uma lenda que o manager tem (estoque + elencos). */
export const copias = (p: Progresso, id: string) =>
  p.estoque.filter((x) => x === id).length +
  Object.values(p.noElenco).filter((ids) => ids.includes(id)).length +
  (p.mercadoCartas?.meus.filter((a) => a.jogadorId === id).length ?? 0);
