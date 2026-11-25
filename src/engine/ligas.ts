/**
 * Ligas do jogo. A carreira acontece dentro de uma delas; o mercado compra de todas.
 *
 * O id da liga é a "divisão" guardada na temporada: "A", "B", "C" e "D" são as
 * Séries do Brasileirão (saves antigos seguem valendo) e as estrangeiras usam a
 * sigla do país, com o número da divisão a partir da segunda (ING, ING2, ING3...).
 * As divisões de um país formam uma escada: os últimos de cada uma descem e os
 * primeiros da de baixo sobem, na quantidade `vagas` da divisão de cima.
 */
export type Divisao = string;

export type ClasseZona = "libertadores" | "pre" | "sula" | "rebaixamento" | "acesso";

export interface Zona {
  /** Até que posição vale a zona (de cima) ou, com `deBaixo`, quantas posições do fim. */
  ate: number;
  deBaixo?: boolean;
  nome: string;
  /** Cor na tabela (classe CSS zona-*). */
  classe: ClasseZona;
}

export interface Liga {
  id: Divisao;
  /** Valor de `liga` em data/clubes.json. */
  chave: string;
  nome: string;
  pais: string;
  /** Sigla de 3 letras do país (bandeira em texto). */
  sigla: string;
  /** 1 = primeira divisão. */
  nivel: number;
  /** Turno e returno (2) ou turno único (1). */
  turnos: 1 | 2;
  /** Fator da premiação em moedas no fim da temporada. */
  fatorPremio: number;
  /** Quantos caem desta para a divisão de baixo (e sobem de lá). Sem valor: não há divisão abaixo. */
  vagas?: number;
  /** Zonas continentais (só na primeira divisão); acesso e rebaixamento são acrescentados sozinhos. */
  zonas: Zona[];
}

const EUROPA = (champions: number, liga: number, conference: number): Zona[] => [
  { ate: champions, nome: "Champions League", classe: "libertadores" },
  { ate: champions + liga, nome: "Europa League", classe: "pre" },
  { ate: champions + liga + conference, nome: "Conference League", classe: "sula" },
];

type Base = Omit<Liga, "nivel" | "fatorPremio" | "zonas" | "turnos"> &
  Partial<Pick<Liga, "zonas" | "turnos">> & { premio?: number };

/** Monta as divisões de um país, da primeira para baixo. */
function pais(premio: number, divisoes: Base[]): Liga[] {
  return divisoes.map((d, i) => ({
    turnos: 2,
    zonas: [],
    ...d,
    nivel: i + 1,
    fatorPremio: Math.round(premio * 0.5 ** i * 100) / 100,
  }));
}

const BRASIL = (id: string, nome: string, vagas?: number): Base => ({
  id, chave: `brasileirao-${id.toLowerCase()}`, nome, pais: "Brasil", sigla: "BRA", vagas,
});

const DEFINICAO: Liga[] = [
  ...pais(1, [
    {
      ...BRASIL("A", "Brasileirão Série A", 4),
      zonas: [
        { ate: 4, nome: "Libertadores", classe: "libertadores" },
        { ate: 6, nome: "Pré-Libertadores", classe: "pre" },
        { ate: 12, nome: "Sul-Americana", classe: "sula" },
      ],
    },
    BRASIL("B", "Brasileirão Série B", 4),
    BRASIL("C", "Brasileirão Série C", 4),
    { ...BRASIL("D", "Brasileirão Série D"), turnos: 1 },
  ]),
  ...pais(1.5, [
    { id: "ING", chave: "premier-league", nome: "Premier League", pais: "Inglaterra", sigla: "ENG", vagas: 3, zonas: EUROPA(4, 1, 1) },
    { id: "ING2", chave: "championship", nome: "Championship", pais: "Inglaterra", sigla: "ENG", vagas: 3 },
    { id: "ING3", chave: "league-one", nome: "League One", pais: "Inglaterra", sigla: "ENG", vagas: 4 },
    { id: "ING4", chave: "league-two", nome: "League Two", pais: "Inglaterra", sigla: "ENG" },
  ]),
  ...pais(1.4, [
    { id: "ESP", chave: "la-liga", nome: "La Liga", pais: "Espanha", sigla: "ESP", vagas: 3, zonas: EUROPA(4, 2, 1) },
    { id: "ESP2", chave: "segunda-division", nome: "Segunda División", pais: "Espanha", sigla: "ESP" },
  ]),
  ...pais(1.3, [
    { id: "ITA", chave: "serie-a-italia", nome: "Serie A (Itália)", pais: "Itália", sigla: "ITA", vagas: 3, zonas: EUROPA(4, 1, 1) },
    { id: "ITA2", chave: "serie-b-italia", nome: "Serie B (Itália)", pais: "Itália", sigla: "ITA" },
  ]),
  ...pais(1.3, [
    { id: "ALE", chave: "bundesliga", nome: "Bundesliga", pais: "Alemanha", sigla: "GER", vagas: 2, zonas: EUROPA(4, 1, 1) },
    { id: "ALE2", chave: "2-bundesliga", nome: "2. Bundesliga", pais: "Alemanha", sigla: "GER" },
  ]),
  ...pais(1.2, [
    { id: "FRA", chave: "ligue-1", nome: "Ligue 1", pais: "França", sigla: "FRA", vagas: 2, zonas: EUROPA(3, 1, 1) },
    { id: "FRA2", chave: "ligue-2", nome: "Ligue 2", pais: "França", sigla: "FRA" },
  ]),
  ...pais(1, [
    { id: "POR", chave: "liga-portugal", nome: "Liga Portugal", pais: "Portugal", sigla: "POR", vagas: 2, zonas: EUROPA(2, 1, 1) },
    { id: "POR2", chave: "liga-portugal-2", nome: "Liga Portugal 2", pais: "Portugal", sigla: "POR" },
  ]),
  ...pais(1, [
    { id: "NED", chave: "eredivisie", nome: "Eredivisie", pais: "Holanda", sigla: "NED", vagas: 2, zonas: EUROPA(2, 1, 1) },
    { id: "NED2", chave: "eerste-divisie", nome: "Eerste Divisie", pais: "Holanda", sigla: "NED" },
  ]),
  ...pais(0.9, [
    { id: "BEL", chave: "pro-league", nome: "Pro League (Bélgica)", pais: "Bélgica", sigla: "BEL", vagas: 2, zonas: EUROPA(2, 1, 1) },
    { id: "BEL2", chave: "challenger-pro-league", nome: "Challenger Pro League", pais: "Bélgica", sigla: "BEL" },
  ]),
  ...pais(0.8, [
    {
      id: "ARG", chave: "liga-argentina", nome: "Liga Profesional (Argentina)", pais: "Argentina", sigla: "ARG",
      turnos: 1, vagas: 2,
      zonas: [
        { ate: 3, nome: "Libertadores", classe: "libertadores" },
        { ate: 9, nome: "Sul-Americana", classe: "sula" },
      ],
    },
    { id: "ARG2", chave: "primera-nacional", nome: "Primera Nacional", pais: "Argentina", sigla: "ARG", turnos: 1 },
  ]),
  ...pais(1, [
    {
      id: "KSA", chave: "saudi-pro-league", nome: "Saudi Pro League", pais: "Arábia Saudita", sigla: "KSA", vagas: 3,
      zonas: [{ ate: 2, nome: "Champions League da Ásia", classe: "libertadores" }],
    },
    { id: "KSA2", chave: "saudi-first-division", nome: "Primeira Divisão Saudita", pais: "Arábia Saudita", sigla: "KSA" },
  ]),
  ...pais(0.7, [
    { id: "NOR", chave: "eliteserien", nome: "Eliteserien", pais: "Noruega", sigla: "NOR", vagas: 2, zonas: EUROPA(1, 1, 1) },
    { id: "NOR2", chave: "obos-ligaen", nome: "OBOS-ligaen", pais: "Noruega", sigla: "NOR" },
  ]),
  ...pais(0.7, [
    { id: "DEN", chave: "superliga-dinamarca", nome: "Superliga (Dinamarca)", pais: "Dinamarca", sigla: "DEN", vagas: 2, zonas: EUROPA(1, 1, 1) },
    { id: "DEN2", chave: "1-division-dinamarca", nome: "1ª Divisão (Dinamarca)", pais: "Dinamarca", sigla: "DEN" },
  ]),
  ...pais(0.7, [
    { id: "SCO", chave: "scottish-premiership", nome: "Scottish Premiership", pais: "Escócia", sigla: "SCO", vagas: 1, zonas: EUROPA(2, 1, 1) },
    { id: "SCO2", chave: "scottish-championship", nome: "Scottish Championship", pais: "Escócia", sigla: "SCO" },
  ]),
  ...pais(0.7, [
    { id: "AUT", chave: "bundesliga-austria", nome: "Bundesliga (Áustria)", pais: "Áustria", sigla: "AUT", vagas: 1, zonas: EUROPA(2, 1, 1) },
    { id: "AUT2", chave: "2-liga-austria", nome: "2. Liga (Áustria)", pais: "Áustria", sigla: "AUT" },
  ]),
  ...pais(0.6, [
    { id: "SRB", chave: "superliga-servia", nome: "SuperLiga (Sérvia)", pais: "Sérvia", sigla: "SRB", vagas: 2, zonas: EUROPA(1, 1, 1) },
    { id: "SRB2", chave: "prva-liga-servia", nome: "Prva Liga (Sérvia)", pais: "Sérvia", sigla: "SRB" },
  ]),
];

/** Acrescenta as zonas de acesso (vindas da divisão de cima) e de rebaixamento. */
export const LIGAS: Liga[] = DEFINICAO.map((l) => {
  const acima = DEFINICAO.find((x) => x.pais === l.pais && x.nivel === l.nivel - 1);
  const abaixo = DEFINICAO.find((x) => x.pais === l.pais && x.nivel === l.nivel + 1);
  const zonas = [...l.zonas];
  if (acima?.vagas) zonas.unshift({ ate: acima.vagas, nome: `Acesso à ${nomeCurtoDe(acima)}`, classe: "acesso" });
  if (abaixo && l.vagas) zonas.push({ ate: l.vagas, deBaixo: true, nome: `Rebaixamento para a ${nomeCurtoDe(abaixo)}`, classe: "rebaixamento" });
  return { ...l, zonas };
});

function nomeCurtoDe(l: Pick<Liga, "pais" | "id" | "nome">) {
  return l.pais === "Brasil" ? `Série ${l.id}` : l.nome;
}

const POR_ID = new Map(LIGAS.map((l) => [l.id, l]));
const POR_CHAVE = new Map(LIGAS.map((l) => [l.chave, l]));

/** Liga pelo id (divisão). Id desconhecido: Série A, como nos saves antigos. */
export const ligaDe = (d: Divisao | undefined): Liga => POR_ID.get(d ?? "A") ?? LIGAS[0];
/** Divisão a partir do campo `liga` de data/clubes.json. */
export const divisaoDaChave = (chave: string | null | undefined): Divisao => POR_CHAVE.get(chave ?? "")?.id ?? "A";
export const nomeDaLiga = (d: Divisao | undefined) => ligaDe(d).nome;
/** "Série A" no Brasil, o nome da liga nos outros países. */
export const nomeCurto = (d: Divisao | undefined) => nomeCurtoDe(ligaDe(d));

/** Todas as divisões do país da liga, da primeira para baixo. */
export const divisoesDoPais = (d: Divisao): Divisao[] => {
  const p = ligaDe(d).pais;
  return LIGAS.filter((l) => l.pais === p).map((l) => l.id);
};
/** As outras divisões do país (simuladas junto com a do técnico). */
export const outrasDivisoes = (d: Divisao): Divisao[] => divisoesDoPais(d).filter((x) => x !== ligaDe(d).id);

/** Zona da tabela pela posição (1 = líder) e o total de clubes. */
export function zonaDaLiga(d: Divisao | undefined, posicao: number, total: number): Zona | null {
  for (const z of ligaDe(d).zonas)
    if (z.deBaixo ? posicao > total - z.ate : posicao <= z.ate) return z;
  return null;
}
