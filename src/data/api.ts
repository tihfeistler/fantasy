import type { Jogador, Posicao } from "../engine/types";

/**
 * Em desenvolvimento (npm run dev) o Vite repassa /api para o XAMPP.
 * No build servido pelo Apache (htdocs/fantasy/dist/), a API fica em ../api.
 */
const BASE = import.meta.env.DEV ? "/api" : "../api";

export interface FiltroJogadores {
  tipo?: "classico" | "atual";
  posicao?: Posicao;
  clube?: string;
  busca?: string;
}

export async function buscarJogadores(filtro: FiltroJogadores = {}): Promise<Jogador[]> {
  const qs = new URLSearchParams(
    Object.entries(filtro).filter(([, v]) => v) as [string, string][],
  ).toString();
  const r = await fetch(`${BASE}/jogadores.php${qs ? `?${qs}` : ""}`);
  if (!r.ok) throw new Error(`API respondeu ${r.status}`);
  return r.json();
}
