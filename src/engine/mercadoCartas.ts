import { faixa, type Faixa } from "./pacotes";
import { criarRng, type Rng } from "./rng";
import type { Jogador } from "./types";

/**
 * Mercado de cartas de lendas entre técnicos.
 *
 * No modo online isso roda no servidor (api/mercado.php) com técnicos de
 * verdade. Na prévia, sem servidor, os outros técnicos são SIMULADOS: eles
 * anunciam cartas, compram as suas e mandam propostas a cada rodada, com as
 * mesmas regras (preço livre, propostas, taxa de 5% do vendedor).
 */

export const TAXA_MERCADO = 0.05;
export const PRECO_MINIMO = 10;
export const PRECO_MAXIMO = 1_000_000;

export interface AnuncioCarta {
  id: string;
  /** Nome do técnico que vende; "voce" nos seus anúncios. */
  vendedor: string;
  jogadorId: string;
  preco: number;
}

export interface PropostaCarta {
  id: string;
  /** Técnico que fez a proposta. */
  de: string;
  /** Anúncio (seu) a que se refere. */
  anuncioId: string;
  jogadorId: string;
  valor: number;
  /** Máximo que o técnico simulado aceita pagar numa contraproposta (escondido do jogador). */
  teto?: number;
}

export interface MovimentoCarta {
  rodada: number;
  texto: string;
  moedas: number;
}

export interface MercadoCartas {
  /** Anúncios dos outros técnicos. */
  anuncios: AnuncioCarta[];
  /** Seus anúncios: a carta sai do estoque enquanto está anunciada. */
  meus: AnuncioCarta[];
  /** Propostas recebidas pelos seus anúncios. */
  recebidas: PropostaCarta[];
  /** O que aconteceu, do mais novo para o mais antigo. */
  movimentos: MovimentoCarta[];
  proximoId: number;
}

export const MERCADO_CARTAS_INICIAL: MercadoCartas = { anuncios: [], meus: [], recebidas: [], movimentos: [], proximoId: 1 };

/** Nomes fictícios dos técnicos simulados. */
export const TECNICOS_SIMULADOS = [
  "Rafa Mendes", "Bia Torres", "Duda Lopes", "Caio Nunes", "Lu Andrade", "Gabi Rocha",
  "Teo Martins", "Nina Prado", "Juca Farias", "Mari Costa", "Leo Batista", "Vivi Ramos",
];

/**
 * Preço de referência de uma carta entre técnicos (moedas). Bem acima do
 * preço básico do sistema, que é o piso: comum 150 a 300, rara 450 a 800,
 * ícone a partir de 1.800.
 */
const BASE: Record<Faixa, { preco: number; inicio: number }> = {
  comum: { preco: 150, inicio: 60 },
  rara: { preco: 450, inicio: 80 },
  icone: { preco: 1800, inicio: 88 },
};
export function precoReferencia(j: Jogador): number {
  const b = BASE[faixa(j)];
  return Math.round((b.preco * (1 + Math.max(0, j.geral - b.inicio) / 10)) / 10) * 10;
}

const arred = (v: number) => Math.max(PRECO_MINIMO, Math.round(v / 10) * 10);
export const comTaxa = (valor: number) => valor - Math.ceil(valor * TAXA_MERCADO);

function sortear<T>(rng: Rng, xs: T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

/** Sorteio de uma lenda, com ícones mais raros (como nos pacotes). */
function sortearLenda(rng: Rng, lendas: Jogador[]): Jogador {
  const r = rng();
  const f: Faixa = r < 0.12 ? "icone" : r < 0.45 ? "rara" : "comum";
  const daFaixa = lendas.filter((j) => faixa(j) === f);
  return sortear(rng, daFaixa.length ? daFaixa : lendas);
}

export const seedDoMercado = (seed: number, rodada: number) => (seed ^ (rodada * 2654435761)) >>> 0;

/**
 * Uma rodada do mercado simulado:
 * 1. os técnicos simulados olham seus anúncios: quanto mais barato em
 *    relação à referência, maior a chance de alguém comprar; se não
 *    comprarem, podem mandar uma proposta abaixo do preço;
 * 2. parte dos anúncios deles sai (vendidos a outros) e entram novos.
 */
export function rodadaDoMercado(
  m: MercadoCartas,
  lendas: Map<string, Jogador>,
  rodada: number,
  rng: Rng,
): { mercado: MercadoCartas; moedas: number } {
  let { proximoId } = m;
  const novoId = () => `m${proximoId++}`;
  let moedas = 0;
  const movimentos: MovimentoCarta[] = [];
  const meus: AnuncioCarta[] = [];
  const recebidas = [...m.recebidas];

  for (const a of m.meus) {
    const j = lendas.get(a.jogadorId);
    if (!j) continue;
    const ref = precoReferencia(j);
    const chance = Math.min(0.9, Math.max(0.03, 1.4 - a.preco / ref) * 0.6);
    if (rng() < chance) {
      const comprador = sortear(rng, TECNICOS_SIMULADOS);
      const liquido = comTaxa(a.preco);
      moedas += liquido;
      movimentos.push({ rodada, texto: `${comprador} comprou ${j.nome} por ${a.preco} (taxa de 5%)`, moedas: liquido });
      // Propostas por essa carta deixam de valer.
      for (let i = recebidas.length - 1; i >= 0; i--) if (recebidas[i].anuncioId === a.id) recebidas.splice(i, 1);
      continue;
    }
    meus.push(a);
    const jaTem = recebidas.some((p) => p.anuncioId === a.id);
    if (!jaTem && rng() < 0.45) {
      const valor = arred(Math.min(a.preco * 0.95, ref * (0.7 + rng() * 0.35)));
      if (valor < a.preco) {
        const teto = arred(Math.min(a.preco, valor * (1.08 + rng() * 0.22)));
        recebidas.push({ id: novoId(), de: sortear(rng, TECNICOS_SIMULADOS), anuncioId: a.id, jogadorId: a.jogadorId, valor, teto });
      }
    }
  }

  const lista = [...lendas.values()];
  const anuncios = m.anuncios.filter(() => rng() > 0.3);
  while (lista.length && anuncios.length < 14) {
    const j = sortearLenda(rng, lista);
    anuncios.push({
      id: novoId(),
      vendedor: sortear(rng, TECNICOS_SIMULADOS),
      jogadorId: j.id,
      preco: arred(precoReferencia(j) * (0.8 + rng() * 0.6)),
    });
  }

  return {
    mercado: { anuncios, meus, recebidas, movimentos: [...movimentos, ...m.movimentos].slice(0, 40), proximoId },
    moedas,
  };
}

/** Mercado inicial de uma carreira. */
export function mercadoInicial(lendas: Map<string, Jogador>, seed: number): MercadoCartas {
  return rodadaDoMercado(MERCADO_CARTAS_INICIAL, lendas, 0, criarRng(seedDoMercado(seed, 0))).mercado;
}

export type Resposta = { tipo: "aceita" } | { tipo: "contra"; valor: number } | { tipo: "recusa" };

/**
 * Resposta de um técnico simulado à sua proposta por uma carta anunciada:
 * aceita a partir de 90% do preço; de 60% a 90%, faz uma contraproposta
 * (o meio do caminho até o preço, no mínimo 90% dele); abaixo de 60%, recusa.
 */
export function respostaSimulada(preco: number, valor: number): Resposta {
  const r = valor / preco;
  if (r >= 0.9) return { tipo: "aceita" };
  if (r < 0.6) return { tipo: "recusa" };
  return { tipo: "contra", valor: Math.min(preco, arred(Math.max(preco * 0.9, (valor + preco) / 2))) };
}

/**
 * Sua contraproposta a uma proposta recebida: o técnico simulado aceita
 * até o teto dele; acima disso, desiste da compra.
 */
export function aceitaContraproposta(p: PropostaCarta, valor: number): boolean {
  return valor <= (p.teto ?? Math.round(p.valor * 1.15));
}
