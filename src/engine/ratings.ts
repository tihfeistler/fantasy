import { ehLenda, type Atributos, type Formacao, type Jogador, type Posicao, type Time } from "./types";

/**
 * Pesos dos atributos por posição para calcular o "geral".
 * Suposição: a frente da base de dados usa a mesma ideia; se a fórmula
 * dela for diferente, esta tabela deve ser trocada pela de data/README.md.
 */
type Pesos = Partial<Record<keyof Atributos, number>>;

/**
 * Pesos dos atributos por posição (cada linha soma 1). O geral é a média
 * ponderada. Mesma tabela em scripts/gerar_atuais.py e
 * scripts/converter_atributos.py; mude nos três juntos.
 */
export const PESOS: Record<Posicao, Pesos> = {
  GOL: { goleiro: 0.75, mentalidade: 0.1, fisico: 0.05, passe: 0.05, velocidade: 0.05 },
  ZAG: { defesa: 0.5, fisico: 0.2, mentalidade: 0.1, velocidade: 0.1, passe: 0.1 },
  LAT: { defesa: 0.3, velocidade: 0.25, passe: 0.15, drible: 0.1, fisico: 0.1, mentalidade: 0.05, finalizacao: 0.05 },
  VOL: { defesa: 0.35, passe: 0.25, fisico: 0.15, mentalidade: 0.15, drible: 0.05, velocidade: 0.05 },
  MEI: { passe: 0.35, drible: 0.25, finalizacao: 0.15, mentalidade: 0.15, velocidade: 0.05, fisico: 0.05 },
  ATA: { finalizacao: 0.45, drible: 0.15, velocidade: 0.15, fisico: 0.1, mentalidade: 0.1, passe: 0.05 },
};

export function calcularGeral(atr: Atributos, pos: Posicao): number {
  let v = 0;
  for (const [k, p] of Object.entries(PESOS[pos]) as [keyof Atributos, number][]) v += atr[k] * p;
  return Math.round(Math.min(100, Math.max(1, v)));
}

/** Força de um jogador atuando numa posição (penaliza improviso). */
export function forcaNaPosicao(j: Jogador, pos: Posicao): number {
  if (j.posicao === pos) return j.geral;
  const base = calcularGeral(j.atributos, pos);
  if (pos === "GOL" || j.posicao === "GOL") return Math.round(base * 0.5);
  return Math.round(base * 0.9);
}

export const FORMACOES: Formacao[] = [
  { nome: "4-4-2", ZAG: 2, LAT: 2, VOL: 2, MEI: 2, ATA: 2 },
  { nome: "4-3-3", ZAG: 2, LAT: 2, VOL: 1, MEI: 2, ATA: 3 },
  { nome: "3-5-2", ZAG: 3, LAT: 2, VOL: 2, MEI: 1, ATA: 2 },
  { nome: "4-5-1", ZAG: 2, LAT: 2, VOL: 2, MEI: 3, ATA: 1 },
];

export interface Vaga {
  pos: Posicao;
  jogador: Jogador;
}

/** Vagas da formação na ordem GOL, ZAG, LAT, VOL, MEI, ATA. */
export function vagasDaFormacao(f: Formacao): Posicao[] {
  const v: Posicao[] = ["GOL"];
  for (const p of ["ZAG", "LAT", "VOL", "MEI", "ATA"] as const) {
    for (let i = 0; i < f[p]; i++) v.push(p);
  }
  return v;
}

/**
 * Escala os 11 melhores para a formação (guloso por vaga). Se o técnico
 * escolheu titulares (mesmo menos de 11), usa só eles e deixa vagas vazias.
 */
export function escalar(time: Time): Vaga[] {
  const vagas = vagasDaFormacao(time.formacao);
  const pool =
    time.titulares.length > 0
      ? time.elenco.filter((j) => time.titulares.includes(j.id))
      : [...time.elenco];
  const usados = new Set<string>();
  const resultado: Vaga[] = [];
  // Limite de lendas em campo: as que passarem do limite ficam de fora.
  let lendas = 0;
  const cabe = (j: Jogador) => !ehLenda(j) || lendas < (time.maxLendas ?? Infinity);
  const usar = (j: Jogador) => {
    usados.add(j.id);
    if (ehLenda(j)) lendas++;
  };
  // Preenche primeiro as vagas com jogadores da posição natural.
  const pendentes: Posicao[] = [];
  for (const pos of vagas) {
    const melhor = pool
      .filter((j) => !usados.has(j.id) && j.posicao === pos && cabe(j))
      .sort((a, b) => b.geral - a.geral)[0];
    if (melhor) {
      usar(melhor);
      resultado.push({ pos, jogador: melhor });
    } else pendentes.push(pos);
  }
  // Depois improvisa quem sobrou.
  for (const pos of pendentes) {
    const melhor = pool
      .filter((j) => !usados.has(j.id) && cabe(j))
      .sort((a, b) => forcaNaPosicao(b, pos) - forcaNaPosicao(a, pos))[0];
    if (!melhor) break;
    usar(melhor);
    resultado.push({ pos, jogador: melhor });
  }
  const ordem = (p: Posicao) => vagas.indexOf(p);
  return resultado.sort((a, b) => ordem(a.pos) - ordem(b.pos));
}

export interface ForcaSetores {
  goleiro: number;
  defesa: number;
  meio: number;
  ataque: number;
}

export function forcaSetores(vagas: Vaga[]): ForcaSetores {
  const media = (ps: Posicao[]) => {
    const vs = vagas.filter((v) => ps.includes(v.pos));
    if (vs.length === 0) return 30;
    return vs.reduce((s, v) => s + forcaNaPosicao(v.jogador, v.pos), 0) / vs.length;
  };
  // Menos de 11 em campo derruba todos os setores.
  const fator = Math.min(1, vagas.length / 11);
  return {
    goleiro: media(["GOL"]) * fator,
    defesa: media(["ZAG", "LAT", "VOL"]) * fator,
    meio: media(["VOL", "MEI", "LAT"]) * fator,
    ataque: media(["ATA", "MEI"]) * fator,
  };
}

/** Vagas no banco de reservas. Quem não é titular nem está no banco fica fora da partida. */
export const VAGAS_BANCO = 12;

/**
 * Banco de reservas: o escolhido pelo técnico (sem titulares, até
 * VAGAS_BANCO) ou, se não escolheu, um goleiro e os melhores que sobraram.
 */
export function montarBanco(time: Time, titulares: Set<string>): Jogador[] {
  const livres = time.elenco.filter((j) => !titulares.has(j.id));
  if (time.banco) {
    const porId = new Map(livres.map((j) => [j.id, j]));
    return time.banco.map((id) => porId.get(id)).filter((j): j is Jogador => !!j).slice(0, VAGAS_BANCO);
  }
  const ordenados = [...livres].sort((a, b) => b.geral - a.geral);
  const goleiro = ordenados.find((j) => j.posicao === "GOL");
  const resto = ordenados.filter((j) => j !== goleiro);
  return [...(goleiro ? [goleiro] : []), ...resto].slice(0, VAGAS_BANCO);
}
