import { MAX_LENDAS_EM_CAMPO } from "../engine/pacotes";
import clubesJson from "../../data/clubes.json";
import atuaisJson from "../../data/atuais.json";
import { FORMACOES } from "../engine/ratings";
import type { Jogador, Time } from "../engine/types";

/**
 * Clubes da Série A com os elencos atuais (data/clubes.json + data/atuais.json),
 * empacotados no front para o modo solo funcionar offline.
 * Os atributos são RASCUNHO: ver scripts/gerar_atuais.py.
 */
export interface Clube {
  id: string;
  nome: string;
  sigla: string;
  cor: string;
  corSecundaria?: string;
  liga: string;
  nivel: number;
}

export const CLUBES = clubesJson as Clube[];
const ATUAIS = atuaisJson as Jogador[];

export function montarTimesAtuais(): Time[] {
  return CLUBES.map((c) => ({
    id: c.id,
    nome: c.nome,
    sigla: c.sigla,
    cor: c.cor,
    elenco: ATUAIS.filter((j) => j.clubeId === c.id),
    formacao: FORMACOES[0],
    titulares: [],
    maxLendas: MAX_LENDAS_EM_CAMPO,
  }));
}

/** Estilo do escudo: fundo na cor do clube e texto legível por cima (preto em cores claras). */
export function estiloEscudo(cor: string) {
  const n = parseInt(cor.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const claro = 0.299 * r + 0.587 * g + 0.114 * b > 160;
  return { background: cor, color: claro ? "#0b1324" : "#ffffff", textShadow: claro ? "none" : undefined };
}
