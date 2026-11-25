/**
 * Ligas do jogo. A carreira acontece dentro de uma delas; o mercado compra de todas.
 *
 * O id da liga é a "divisão" guardada na temporada: "A" e "B" continuam sendo as
 * Séries A e B do Brasileirão (saves antigos seguem valendo) e as estrangeiras
 * usam a sigla do país. Só o Brasil tem duas divisões com acesso e rebaixamento;
 * nas outras ligas ninguém cai (a segunda divisão delas não está no jogo).
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
  /** Turno e returno (2) ou turno único (1). */
  turnos: 1 | 2;
  /** Fator da premiação em moedas no fim da temporada. */
  fatorPremio: number;
  /** Divisão ligada por acesso e rebaixamento (só no Brasil). */
  par?: Divisao;
  zonas: Zona[];
}

const EUROPA = (champions: number, liga: number, conference: number): Zona[] => [
  { ate: champions, nome: "Champions League", classe: "libertadores" },
  { ate: champions + liga, nome: "Europa League", classe: "pre" },
  { ate: champions + liga + conference, nome: "Conference League", classe: "sula" },
];

export const LIGAS: Liga[] = [
  {
    id: "A", chave: "brasileirao-a", nome: "Brasileirão Série A", pais: "Brasil", sigla: "BRA",
    turnos: 2, fatorPremio: 1, par: "B",
    zonas: [
      { ate: 4, nome: "Libertadores", classe: "libertadores" },
      { ate: 6, nome: "Pré-Libertadores", classe: "pre" },
      { ate: 12, nome: "Sul-Americana", classe: "sula" },
      { ate: 4, deBaixo: true, nome: "Rebaixamento para a Série B", classe: "rebaixamento" },
    ],
  },
  {
    id: "B", chave: "brasileirao-b", nome: "Brasileirão Série B", pais: "Brasil", sigla: "BRA",
    turnos: 2, fatorPremio: 0.5, par: "A",
    zonas: [{ ate: 4, nome: "Acesso à Série A", classe: "acesso" }],
  },
  { id: "ING", chave: "premier-league", nome: "Premier League", pais: "Inglaterra", sigla: "ENG", turnos: 2, fatorPremio: 1.5, zonas: EUROPA(4, 1, 1) },
  { id: "ESP", chave: "la-liga", nome: "La Liga", pais: "Espanha", sigla: "ESP", turnos: 2, fatorPremio: 1.4, zonas: EUROPA(4, 2, 1) },
  { id: "ITA", chave: "serie-a-italia", nome: "Serie A (Itália)", pais: "Itália", sigla: "ITA", turnos: 2, fatorPremio: 1.3, zonas: EUROPA(4, 1, 1) },
  { id: "ALE", chave: "bundesliga", nome: "Bundesliga", pais: "Alemanha", sigla: "GER", turnos: 2, fatorPremio: 1.3, zonas: EUROPA(4, 1, 1) },
  { id: "FRA", chave: "ligue-1", nome: "Ligue 1", pais: "França", sigla: "FRA", turnos: 2, fatorPremio: 1.2, zonas: EUROPA(3, 1, 1) },
  { id: "POR", chave: "liga-portugal", nome: "Liga Portugal", pais: "Portugal", sigla: "POR", turnos: 2, fatorPremio: 1, zonas: EUROPA(2, 1, 1) },
  {
    id: "ARG", chave: "liga-argentina", nome: "Liga Profesional (Argentina)", pais: "Argentina", sigla: "ARG",
    turnos: 1, fatorPremio: 0.8,
    zonas: [
      { ate: 3, nome: "Libertadores", classe: "libertadores" },
      { ate: 9, nome: "Sul-Americana", classe: "sula" },
    ],
  },
];

const POR_ID = new Map(LIGAS.map((l) => [l.id, l]));
const POR_CHAVE = new Map(LIGAS.map((l) => [l.chave, l]));

/** Liga pelo id (divisão). Id desconhecido: Série A, como nos saves antigos. */
export const ligaDe = (d: Divisao | undefined): Liga => POR_ID.get(d ?? "A") ?? LIGAS[0];
/** Divisão a partir do campo `liga` de data/clubes.json. */
export const divisaoDaChave = (chave: string | null | undefined): Divisao => POR_CHAVE.get(chave ?? "")?.id ?? "A";
export const nomeDaLiga = (d: Divisao | undefined) => ligaDe(d).nome;
/** "Série A" no Brasil, o nome da liga nas outras. */
export const nomeCurto = (d: Divisao | undefined) => {
  const l = ligaDe(d);
  return l.par ? `Série ${l.id}` : l.nome;
};

/** Zona da tabela pela posição (1 = líder) e o total de clubes. */
export function zonaDaLiga(d: Divisao | undefined, posicao: number, total: number): Zona | null {
  for (const z of ligaDe(d).zonas)
    if (z.deBaixo ? posicao > total - z.ate : posicao <= z.ate) return z;
  return null;
}
