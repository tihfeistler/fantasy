import type { Rng } from "./rng";
import { LIGAS } from "./ligas";
import type { Jogador, Posicao } from "./types";
import { fatorBilheteria, type Estadio } from "./estadios";

/**
 * Time próprio: em vez de assumir um clube existente, o técnico cria o seu
 * (nome, cidade, estádio, cores, emblema e camisa) e monta o elenco num draft.
 *
 * O time entra na divisão escolhida, no lugar do clube mais fraco dela (os
 * jogadores desse clube vão para os outros da divisão).
 *
 * As regras aqui são as mesmas de api/time_proprio.php: o servidor sorteia de
 * verdade na conta; este arquivo serve à demonstração e aos testes.
 */

// ------------------------------------------------------------------ identidade

export type FormaEmblema = "escudo" | "redondo" | "losango" | "classico";
export type SimboloEmblema = "estrela" | "coroa" | "raio" | "bola" | "listras" | "nenhum";
export type ModeloCamisa =
  | "lisa"
  | "listras"
  | "horizontais"
  | "faixa"
  | "metades"
  | "detalhes"
  | "faixa-peito"
  | "faixa-central";

export const FORMAS: { id: FormaEmblema; nome: string }[] = [
  { id: "escudo", nome: "Escudo" },
  { id: "classico", nome: "Clássico" },
  { id: "redondo", nome: "Redondo" },
  { id: "losango", nome: "Losango" },
];
export const SIMBOLOS: { id: SimboloEmblema; nome: string }[] = [
  { id: "estrela", nome: "Estrela" },
  { id: "coroa", nome: "Coroa" },
  { id: "raio", nome: "Raio" },
  { id: "bola", nome: "Bola" },
  { id: "listras", nome: "Listras" },
  { id: "nenhum", nome: "Só a sigla" },
];
export const MODELOS_CAMISA: { id: ModeloCamisa; nome: string }[] = [
  { id: "lisa", nome: "Lisa" },
  { id: "listras", nome: "Listras verticais" },
  { id: "horizontais", nome: "Listras horizontais" },
  { id: "faixa", nome: "Faixa diagonal" },
  { id: "metades", nome: "Metades" },
  { id: "detalhes", nome: "Lisa com detalhes" },
  { id: "faixa-peito", nome: "Faixa no peito" },
  { id: "faixa-central", nome: "Faixa central" },
];

/** Uma camisa: modelo e as duas cores (corpo e detalhe). */
export interface Uniforme {
  modelo: ModeloCamisa;
  cor: string;
  cor2: string;
}

/**
 * Cartas de estádio. Capacidade, atmosfera e qualidade dão a bilheteria e o fator casa
 * (estadios.ts); quanto melhor a carta, mais ela custa do caixa inicial.
 */
export interface CartaEstadio extends Omit<Estadio, "nome"> {
  id: string;
  nome: string;
  /** Sai do caixa inicial (R$ mil). */
  custo: number;
  raridade: "bronze" | "prata" | "ouro" | "elite" | "lenda";
}
export const ESTADIOS: CartaEstadio[] = [
  { id: "municipal", nome: "Estádio Municipal", capacidade: 8000, atmosfera: 60, qualidade: 45, custo: 0, raridade: "bronze" },
  { id: "bairro", nome: "Estádio do Bairro", capacidade: 15000, atmosfera: 72, qualidade: 52, custo: 1000, raridade: "prata" },
  { id: "arena", nome: "Arena Moderna", capacidade: 25000, atmosfera: 66, qualidade: 86, custo: 2500, raridade: "ouro" },
  { id: "olimpico", nome: "Estádio Olímpico", capacidade: 40000, atmosfera: 58, qualidade: 76, custo: 4000, raridade: "elite" },
  { id: "monumental", nome: "Arena Monumental", capacidade: 60000, atmosfera: 82, qualidade: 94, custo: 6000, raridade: "lenda" },
];
/** Fator de bilheteria da carta (o mesmo cálculo dos estádios reais). */
export const fatorDaCarta = (e: CartaEstadio) => fatorBilheteria({ ...e });

export interface Identidade {
  nome: string;
  /** 3 letras maiúsculas. */
  sigla: string;
  /** Sigla do país da liga (BRA, ENG...). */
  pais: string;
  /** Divisão onde o time começa (id de LIGAS: "A", "ING2"...). */
  divisao: string;
  cidade: string;
  /** id de ESTADIOS. */
  estadio: string;
  /** Nome que o técnico deu ao estádio. */
  nomeEstadio: string;
  cor: string;
  corSecundaria: string;
  emblema: { forma: FormaEmblema; simbolo: SimboloEmblema };
  /** Modelo da camisa principal (nas duas cores do time). */
  camisa: ModeloCamisa;
  /** Camisa reserva; sem ela (contas antigas), a principal com as cores invertidas. */
  camisaReserva?: Uniforme;
}

/** As duas camisas do time próprio: principal nas cores do time e a reserva. */
export function uniformesDoTimeProprio(i: Identidade): [Uniforme, Uniforme] {
  return [
    { modelo: i.camisa, cor: i.cor, cor2: i.corSecundaria },
    i.camisaReserva ?? { modelo: i.camisa, cor: i.corSecundaria, cor2: i.cor },
  ];
}

/** Time próprio já na carreira: a identidade e o clube cujo lugar ele ocupa. */
export interface ClubeProprio extends Identidade {
  /** id do clube substituído (o time usa esse id na liga). */
  vaga: string;
}

const COR = /^#[0-9a-f]{6}$/i;
const TEXTO = /^[\p{L}\p{N}][\p{L}\p{N} .'-]{1,29}$/u;

/** Mesmas regras de api/time_proprio.php. Devolve o primeiro problema, ou null. */
export function problemaNaIdentidade(i: Identidade): string | null {
  if (!TEXTO.test(i.nome.trim())) return "O nome do time deve ter de 2 a 30 letras ou números.";
  if (!/^[A-Z]{3}$/.test(i.sigla)) return "A sigla deve ter 3 letras.";
  if (!LIGAS.some((l) => l.id === i.divisao && l.sigla === i.pais)) return "Escolha a divisão.";
  if (!TEXTO.test(i.cidade.trim())) return "Digite a cidade do time.";
  if (!ESTADIOS.some((e) => e.id === i.estadio)) return "Escolha a carta do estádio.";
  if (!TEXTO.test(i.nomeEstadio.trim())) return "Dê um nome ao estádio.";
  if (!COR.test(i.cor) || !COR.test(i.corSecundaria)) return "Escolha as duas cores.";
  if (i.cor.toLowerCase() === i.corSecundaria.toLowerCase()) return "As duas cores precisam ser diferentes.";
  if (!FORMAS.some((f) => f.id === i.emblema.forma) || !SIMBOLOS.some((s) => s.id === i.emblema.simbolo))
    return "Monte o emblema.";
  if (!MODELOS_CAMISA.some((m) => m.id === i.camisa)) return "Escolha o modelo da camisa.";
  if (i.camisaReserva) {
    const r = i.camisaReserva;
    if (!MODELOS_CAMISA.some((m) => m.id === r.modelo)) return "Escolha o modelo da camisa reserva.";
    if (!COR.test(r.cor) || !COR.test(r.cor2)) return "Escolha as cores da camisa reserva.";
    if (r.cor.toLowerCase() === r.cor2.toLowerCase()) return "A camisa reserva precisa de duas cores diferentes.";
    if (r.cor.toLowerCase() === i.cor.toLowerCase()) return "A camisa reserva precisa de outra cor de fundo.";
  }
  return null;
}

/** Sigla sugerida pelo nome: "Real Porto Alegre" -> "RPA", "Tigres" -> "TIG". */
export function siglaSugerida(nome: string): string {
  const palavras = nome
    .normalize("NFD")
    .replace(/[^A-Za-z ]/g, "")
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p));
  const s = palavras.length >= 3 ? palavras.slice(0, 3).map((p) => p[0]).join("") : (palavras.join("") + "XXX").slice(0, 3);
  return s.toUpperCase();
}

// ------------------------------------------------------------------ draft

/** Função escolhida em cada escolha do draft e a posição da base que ela usa. */
export type Funcao = "GOL" | "LD" | "LE" | "ZAG" | "VOL" | "MC" | "MEI" | "MD" | "ME" | "C" | "PD" | "PE" | "SA";
export const POSICAO_DA_FUNCAO: Record<Funcao, Posicao> = {
  GOL: "GOL", LD: "LAT", LE: "LAT", ZAG: "ZAG",
  VOL: "VOL", MC: "MEI", MEI: "MEI", MD: "MEI", ME: "MEI",
  C: "ATA", PD: "ATA", PE: "ATA", SA: "ATA",
};
export const NOME_FUNCAO: Record<Funcao, string> = {
  GOL: "Goleiro", LD: "Lateral direito", LE: "Lateral esquerdo", ZAG: "Zagueiro",
  VOL: "Volante", MC: "Meio-campo", MEI: "Meia ofensivo", MD: "Meia direita", ME: "Meia esquerda",
  C: "Centroavante", PD: "Ponta direita", PE: "Ponta esquerda", SA: "Segundo atacante",
};

export interface Grupo {
  id: "gol" | "lat" | "zag" | "mei" | "ata";
  nome: string;
  vagas: number;
  funcoes: Funcao[];
}
/** 30 escolhas: 2 goleiros, 4 laterais, 4 zagueiros, 12 meias e 8 atacantes. */
export const GRUPOS: Grupo[] = [
  { id: "gol", nome: "Goleiros", vagas: 2, funcoes: ["GOL"] },
  { id: "lat", nome: "Laterais", vagas: 4, funcoes: ["LD", "LE"] },
  { id: "zag", nome: "Zagueiros", vagas: 4, funcoes: ["ZAG"] },
  { id: "mei", nome: "Meias", vagas: 12, funcoes: ["VOL", "MC", "MEI", "MD", "ME"] },
  { id: "ata", nome: "Atacantes", vagas: 8, funcoes: ["C", "PD", "PE", "SA"] },
];
export const TOTAL_DRAFT = GRUPOS.reduce((s, g) => s + g.vagas, 0);
export const OPCOES_POR_ESCOLHA = 5;

/** Grupo da escolha número `n` (0 a 29), na ordem de GRUPOS. */
export function grupoDaEscolha(n: number): Grupo | null {
  let ate = 0;
  for (const g of GRUPOS) {
    ate += g.vagas;
    if (n < ate) return g;
  }
  return null;
}

/** Raridade de uma carta no draft. "especial" é a faixa elite (85+) dos atuais. */
export type RaridadeDraft = "bronze" | "prata" | "ouro" | "especial" | "lenda";
export const ORDEM_RARIDADE: RaridadeDraft[] = ["bronze", "prata", "ouro", "especial", "lenda"];
export const NOME_RARIDADE: Record<RaridadeDraft, string> = {
  bronze: "Bronze", prata: "Prata", ouro: "Ouro", especial: "Especial", lenda: "Lenda",
};
/**
 * Chance de cada opção do draft sair em cada raridade (como as dos pacotes de
 * jogos de futebol). Se não houver jogador daquela raridade na nacionalidade e
 * posição, vale a raridade mais próxima abaixo (ou, sem nenhuma abaixo, acima).
 */
export const CHANCES_DRAFT: Record<RaridadeDraft, number> = {
  lenda: 0.0001,
  especial: 0.009,
  ouro: 0.14,
  prata: 0.5,
  bronze: 0.3509,
};

export function raridadeDraft(j: Jogador): RaridadeDraft {
  if (j.tipo !== "atual") return "lenda";
  return j.geral >= 85 ? "especial" : j.geral >= 75 ? "ouro" : j.geral >= 65 ? "prata" : "bronze";
}

export function sortearRaridade(r: number): RaridadeDraft {
  let acc = 0;
  for (const x of [...ORDEM_RARIDADE].reverse()) {
    acc += CHANCES_DRAFT[x];
    if (r < acc) return x;
  }
  return "bronze";
}

/** Escolha feita no draft. */
export interface EscolhaDraft {
  funcao: Funcao;
  jogadorId: string;
}

/** Jogadores que podem sair numa escolha: posição e nacionalidade, sem os já escolhidos. */
export function candidatos(base: Jogador[], posicao: Posicao, nacionalidade: string, excluir: Set<string>) {
  return base.filter((j) => j.posicao === posicao && j.nacionalidade === nacionalidade && !excluir.has(j.id));
}

/**
 * Nacionalidades que dá para escolher numa posição (com pelo menos 5 atuais
 * disponíveis), da que tem mais jogadores para a que tem menos.
 */
export function nacionalidadesDisponiveis(atuais: Jogador[], posicao: Posicao, excluir: Set<string>) {
  const n = new Map<string, number>();
  for (const j of atuais)
    if (j.posicao === posicao && !excluir.has(j.id)) n.set(j.nacionalidade, (n.get(j.nacionalidade) ?? 0) + 1);
  return [...n]
    .filter(([, q]) => q >= OPCOES_POR_ESCOLHA)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([nac, q]) => ({ nac, quantidade: q }));
}

/** Sorteia as 5 opções de uma escolha (sem repetir jogador). */
export function sortearOpcoes(
  atuais: Jogador[],
  lendas: Jogador[],
  funcao: Funcao,
  nacionalidade: string,
  excluir: Set<string>,
  rng: Rng,
): Jogador[] {
  const pos = POSICAO_DA_FUNCAO[funcao];
  const porRaridade = new Map<RaridadeDraft, Jogador[]>(ORDEM_RARIDADE.map((r) => [r, []]));
  for (const j of [...candidatos(atuais, pos, nacionalidade, excluir), ...candidatos(lendas, pos, nacionalidade, excluir)])
    porRaridade.get(raridadeDraft(j))!.push(j);
  const saida: Jogador[] = [];
  for (let i = 0; i < OPCOES_POR_ESCOLHA; i++) {
    const alvo = ORDEM_RARIDADE.indexOf(sortearRaridade(rng()));
    // A mais próxima abaixo com jogadores; sem nenhuma, a mais próxima acima.
    const ordem = [
      ...ORDEM_RARIDADE.slice(0, alvo + 1).reverse(),
      ...ORDEM_RARIDADE.slice(alvo + 1),
    ];
    const r = ordem.find((x) => porRaridade.get(x)!.length);
    if (!r) break;
    const lista = porRaridade.get(r)!;
    const k = Math.floor(rng() * lista.length);
    saida.push(lista[k]);
    lista.splice(k, 1);
  }
  return saida;
}

/** Clube que dá lugar ao time próprio: o mais fraco (menor nível) da liga. Empate: o primeiro em ordem de id. */
export function vagaDoTimeProprio(clubes: { id: string; liga: string; nivel: number }[], chaveLiga: string): string | null {
  const daLiga = clubes
    .filter((c) => c.liga === chaveLiga)
    .sort((a, b) => a.nivel - b.nivel || a.id.localeCompare(b.id));
  return daLiga[0]?.id ?? null;
}

/** Nome em português das nacionalidades mais comuns (código FIFA); as outras mostram o código. */
export const NOME_NACIONALIDADE: Record<string, string> = {
  BRA: "Brasil", ARG: "Argentina", ENG: "Inglaterra", ESP: "Espanha", FRA: "França", SRB: "Sérvia",
  GER: "Alemanha", KSA: "Arábia Saudita", NOR: "Noruega", ITA: "Itália", NED: "Holanda", DEN: "Dinamarca",
  BEL: "Bélgica", AUT: "Áustria", POR: "Portugal", SCO: "Escócia", IRL: "Irlanda", MAR: "Marrocos",
  SEN: "Senegal", NGA: "Nigéria", SWE: "Suécia", URU: "Uruguai", WAL: "País de Gales", CIV: "Costa do Marfim",
  GHA: "Gana", COL: "Colômbia", JPN: "Japão", USA: "Estados Unidos", CRO: "Croácia", SUI: "Suíça",
  ALG: "Argélia", CMR: "Camarões", BIH: "Bósnia", POL: "Polônia", MLI: "Mali", NIR: "Irlanda do Norte",
  AUS: "Austrália", PAR: "Paraguai", ISL: "Islândia", TUR: "Turquia", COD: "RD Congo", ECU: "Equador",
  CAN: "Canadá", FIN: "Finlândia", JAM: "Jamaica", SVN: "Eslovênia", GRE: "Grécia", GUI: "Guiné",
  MNE: "Montenegro", CHI: "Chile", GAM: "Gâmbia", BFA: "Burkina Faso", UKR: "Ucrânia", KOR: "Coreia do Sul",
  KOS: "Kosovo", CPV: "Cabo Verde", ALB: "Albânia", GNB: "Guiné-Bissau", SVK: "Eslováquia", HUN: "Hungria",
  VEN: "Venezuela", PER: "Peru", MEX: "México", BOL: "Bolívia", CZE: "Tchéquia", ROU: "Romênia",
  MKD: "Macedônia do Norte", BUL: "Bulgária", ANG: "Angola", MOZ: "Moçambique", TUN: "Tunísia",
  EGY: "Egito", RUS: "Rússia", ISR: "Israel", IRN: "Irã", QAT: "Catar", UAE: "Emirados Árabes",
  CHN: "China", NZL: "Nova Zelândia", CRC: "Costa Rica", HON: "Honduras", PAN: "Panamá", TOG: "Togo",
  GAB: "Gabão", BEN: "Benin", ZAM: "Zâmbia", ZIM: "Zimbábue", RSA: "África do Sul", KEN: "Quênia",
  GEO: "Geórgia", ARM: "Armênia", LUX: "Luxemburgo", FRO: "Ilhas Faroé", SUR: "Suriname", CUW: "Curaçao",
};
export const nomeNacionalidade = (c: string) => NOME_NACIONALIDADE[c] ?? c;

/** Identidade válida de exemplo (testes). */
export const IDENTIDADE_TESTE: Identidade = {
  nome: "Tigres do Sul", sigla: "TDS", pais: "BRA", divisao: "A", cidade: "Porto Alegre", estadio: "arena",
  nomeEstadio: "Arena dos Tigres", cor: "#f36c21", corSecundaria: "#000000",
  emblema: { forma: "escudo", simbolo: "estrela" }, camisa: "listras",
};
