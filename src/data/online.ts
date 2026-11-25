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

/**
 * Id aleatório deste navegador, guardado no localStorage. O servidor usa para achar
 * contas que dividem o mesmo aparelho (elas não se enfrentam no ranqueado).
 */
function dispositivo(): string {
  const chave = "fantasy-dispositivo";
  try {
    let id = localStorage.getItem(chave);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-x`;
      localStorage.setItem(chave, id);
    }
    return id;
  } catch {
    return "";
  }
}

async function chamar<T>(arquivo: string, corpo?: object, qs = ""): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/${arquivo}${qs}`, {
      method: corpo ? "POST" : "GET",
      credentials: "include",
      headers: { ...(corpo ? { "Content-Type": "application/json" } : {}), "X-Fantasy-Dispositivo": dispositivo() },
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
  /** Maior divisão alcançada na temporada e o prêmio de fim de temporada correspondente. */
  divisaoMax: string;
  premioPrevisto: number;
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
  ultimaTemporada: UltimaTemporada | null;
  /** Só na resposta de abrir_pacote. */
  novas?: Jogador[];
}

/** Convite de amistoso entre amigos. */
export interface Convite {
  id: number;
  nome: string;
}

export interface UltimaTemporada {
  temporada: number;
  divisaoMax: string;
  moedas: number;
}

export interface PartidaServidor {
  id: number;
  status: "ao_vivo" | "encerrada" | "anulada";
  tipo: "ranqueado" | "amistoso";
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
  convites: { recebidos: Convite[]; enviados: Convite[] };
  ultimaTemporada: UltimaTemporada | null;
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
    tipo: "ranqueado" | "amistoso";
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
  convidar: (nome: string) => chamar<EstadoRanqueado>("ranqueado.php", { acao: "convidar", nome }),
  responderConvite: (id: number, aceitar: boolean) =>
    chamar<EstadoRanqueado>("ranqueado.php", { acao: "responder_convite", convite_id: id, aceitar }),
  cancelarConvite: (id: number) => chamar<EstadoRanqueado>("ranqueado.php", { acao: "cancelar_convite", convite_id: id }),

  anuncios: (f: { busca?: string; posicao?: string; ordem?: string } = {}) =>
    chamar<AnuncioOnline[]>(
      "mercado.php",
      undefined,
      `?${new URLSearchParams({ acao: "anuncios", ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) })}`,
    ),
  minhas: () => chamar<MinhasOnline>("mercado.php", undefined, "?acao=minhas"),
  mercado: (acao: string, dados: object) => chamar<object>("mercado.php", { acao, ...dados }),
};

export interface AnuncioOnline {
  anuncio_id: number;
  carta_id: number;
  preco: number;
  vendedor: string;
  jogador: Jogador;
}

export interface PropostaOnline {
  id: number;
  carta_id: number;
  valor: number;
  contra_valor: number | null;
  status: "aberta" | "contraproposta" | "aceita" | "recusada" | "cancelada" | "expirada";
  /** Comprador (recebidas) ou dono da carta (enviadas). */
  outro: string;
  jogador: Jogador;
}

export interface MinhasOnline {
  moedas: number;
  cartas: { carta_id: number; anuncio_id: number | null; preco: number | null; venda_sistema: number; jogador: Jogador }[];
  recebidas: PropostaOnline[];
  enviadas: PropostaOnline[];
}

/** Nome curto da temporada: 20264 → "2026 T4". */
export const nomeTemporada = (t: number) => `${Math.floor(t / 10)} T${t % 10}`;
