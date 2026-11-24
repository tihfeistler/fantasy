/**
 * Progresso do jogador no modo solo: moedas, cartas no estoque e lendas
 * levadas para o elenco de cada clube. Fica no navegador (localStorage);
 * no modo online isso vai para as tabelas usuarios/cartas do MySQL.
 */
export interface Progresso {
  moedas: number;
  /** ids de lendas no estoque (pode repetir). */
  estoque: string[];
  /** ids de lendas no elenco, por clube. */
  noElenco: Record<string, string[]>;
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
