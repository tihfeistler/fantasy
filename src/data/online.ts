import type { Decisao } from "../engine/match";
import type { Jogador, Time } from "../engine/types";

/** Mesma regra de src/data/api.ts: no dev o Vite repassa /api ao XAMPP; no build, ../api. */
const BASE = import.meta.env.DEV ? "/api" : "../api";

export class ErroApi extends Error {
  constructor(
    msg: string,
    readonly status: number,
  ) {
    super(msg);
  }
}

async function chamar<T>(arquivo: string, corpo?: object, qs = ""): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/${arquivo}${qs}`, {
      method: corpo ? "POST" : "GET",
      credentials: "include",
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi("Servidor fora do ar.", 0);
  }
  const tipo = r.headers.get("content-type") ?? "";
  if (!tipo.includes("json")) throw new ErroApi("Servidor fora do ar.", 0);
  const dados = await r.json();
  if (!r.ok) throw new ErroApi(dados?.erro ?? `Erro ${r.status}`, r.status);
  return dados as T;
}

export interface Usuario {
  id: number;
  nome: string;
  moedas: number;
}

export interface PerfilRanqueado {
  temporada: number;
  tier: number;
  divisao: string;
  pdl: number;
  vitorias: number;
  empates: number;
  derrotas: number;
}

export interface SituacaoOnline {
  usuario: { id: number; nome: string; timeId: string };
  moedas: number;
  time: { caixa: number; formacao: string; titulares: string[]; banco: string[]; custo: number };
  cartas: (Jogador & { copias: number })[];
  ranqueado: PerfilRanqueado;
  /** Só na resposta de abrir_pacote. */
  novas?: Jogador[];
}

export interface PartidaServidor {
  id: number;
  status: "ao_vivo" | "encerrada" | "anulada";
  seed: number;
  mandante: Time;
  visitante: Time;
  meuTimeId: string;
  inicioMs: number;
  agoraMs: number;
  segPorMinuto: number;
  decisoes: (Decisao & { id: number })[];
  custo: number;
  relatei: boolean;
  gols: [number, number] | null;
  pdl: number | null;
}

export interface EstadoRanqueado {
  fila: boolean;
  espera: number;
  partida: PartidaServidor | null;
  perfil: PerfilRanqueado;
  caixa: number;
  impedimento: string | null;
}

export interface Ranking {
  temporada: number;
  top: (PerfilRanqueado & { nome: string; eu: boolean })[];
  minhaPosicao: number;
  perfil: PerfilRanqueado;
  historico: {
    id: number;
    adversario: string;
    status: string;
    meus: number | null;
    deles: number | null;
    pdl: number | null;
  }[];
}

export const online = {
  eu: () => chamar<Usuario | null>("auth.php"),
  registrar: (nome: string, senha: string) => chamar<Usuario>("auth.php", { acao: "registrar", nome, senha }),
  entrar: (nome: string, senha: string) => chamar<Usuario>("auth.php", { acao: "entrar", nome, senha }),
  sair: () => chamar<null>("auth.php", { acao: "sair" }),

  situacao: () => chamar<SituacaoOnline>("online.php"),
  escalar: (formacao: string, titulares: string[], banco: string[]) =>
    chamar<SituacaoOnline>("online.php", { acao: "escalar", formacao, titulares, banco }),
  comprarBase: (id: string) => chamar<SituacaoOnline>("online.php", { acao: "comprar_base", jogador_id: id }),
  venderBase: (id: string) => chamar<SituacaoOnline>("online.php", { acao: "vender_base", jogador_id: id }),
  abrirPacote: () => chamar<SituacaoOnline>("online.php", { acao: "abrir_pacote" }),

  estado: (partida?: number) =>
    chamar<EstadoRanqueado>("ranqueado.php", undefined, `?acao=estado${partida ? `&partida=${partida}` : ""}`),
  ranking: () => chamar<Ranking>("ranqueado.php", undefined, "?acao=ranking"),
  entrarFila: () => chamar<EstadoRanqueado>("ranqueado.php", { acao: "entrar_fila" }),
  sairFila: () => chamar<EstadoRanqueado>("ranqueado.php", { acao: "sair_fila" }),
  decidir: (partidaId: number, decisao: object) =>
    chamar<EstadoRanqueado>("ranqueado.php", { acao: "decidir", partida_id: partidaId, decisao }),
  relatar: (partidaId: number, gols: [number, number]) =>
    chamar<EstadoRanqueado>("ranqueado.php", { acao: "relatar", partida_id: partidaId, gols }),
};

/** Nome curto da temporada: 20264 → "2026 T4". */
export const nomeTemporada = (t: number) => `${Math.floor(t / 10)} T${t % 10}`;
