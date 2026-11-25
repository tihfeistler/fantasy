import type { Lancamento } from "../engine/mercado";
import type { Progresso } from "./progresso";

/**
 * Carreira salva na conta (api/carreira.php). O caixa e as moedas são os da
 * conta: um só para carreira, desafios e ranqueado. O servidor confere cada
 * lançamento e devolve o caixa e as moedas que valem.
 */
const BASE = import.meta.env.DEV ? "/api" : "../api";

export interface EstadoCarreira {
  dados: Progresso | null;
  caixa: number;
  moedas: number;
  seq: number;
  /** Só ao criar: caixa inicial do clube. */
  bonus?: number;
}

export interface RespostaSalvar {
  caixa: number;
  moedas: number;
  seq: number;
  /** Números dos lançamentos que o servidor não aceitou. */
  recusados: number[];
  /** O servidor ajustou transferências ou contratos: recarregue. */
  corrigido: boolean;
}

async function chamar<T>(corpo?: object): Promise<T> {
  const r = await fetch(`${BASE}/carreira.php`, {
    method: corpo ? "POST" : "GET",
    credentials: "include",
    headers: corpo ? { "Content-Type": "application/json" } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(dados?.erro ?? `Erro ${r.status}`), { status: r.status });
  return dados as T;
}

export const conta = {
  carregar: () => chamar<EstadoCarreira>(),
  criar: (dados: Progresso) => chamar<EstadoCarreira>({ acao: "criar", dados }),
  salvar: (dados: Progresso, lancamentos: Lancamento[]) =>
    chamar<RespostaSalvar>({ acao: "salvar", dados: semDerivados(dados), lancamentos }),
};

/** O que vem da conta (estoque e moedas) não vai no JSON da carreira. */
function semDerivados(p: Progresso): Progresso {
  const { estoque: _e, mercadoCartas: _m, cartasBase: _c, ...resto } = p;
  return { ...resto, estoque: [] };
}

/** Lançamentos ainda não confirmados pelo servidor (número maior que `seq`). */
export const pendentes = (p: Progresso, seq: number) => (p.financas?.extrato ?? []).filter((l) => (l.n ?? 0) > seq);
