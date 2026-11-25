import { calcularGeral, FORMACOES } from "../engine/ratings";
import type { Atributos, Jogador, Pe, Posicao, Time } from "../engine/types";

/**
 * DADOS DE EXEMPLO, só para o esqueleto rodar. Os atributos foram
 * estimados à mão e serão substituídos por data/jogadores.json, que está
 * sendo montado em paralelo no mesmo formato.
 */
type Linha = [id: string, nome: string, nac: string, pos: Posicao, pe: Pe, auge: number, clube: string,
  atk: number, def: number, pas: number, vel: number, fis: number, gol: number];

function montar(l: Linha): Jogador {
  const [id, nome, nacionalidade, posicao, pe, auge, clubeMarcante, ataque, defesa, passe, velocidade, fisico, goleiro] = l;
  // Valores antigos (6 atributos) convertidos para os 8 atuais.
  const gk = posicao === "GOL";
  const atributos: Atributos = {
    finalizacao: ataque,
    passe,
    drible: gk ? 20 : Math.round(0.5 * ataque + 0.3 * passe + 0.2 * velocidade),
    velocidade,
    defesa,
    fisico,
    mentalidade: Math.round((ataque + defesa + passe + fisico + goleiro) / 5 + 15),
    goleiro,
  };
  return {
    id, nome, nacionalidade, posicao, pe, auge, clubeMarcante, atributos,
    epoca: { inicio: auge - 8, fim: auge + 6 }, // aproximação para o exemplo
    geral: calcularGeral(atributos, posicao),
  };
}

const brasil: Linha[] = [
  ["felix", "Félix", "BRA", "GOL", "D", 1970, "Fluminense", 10, 30, 40, 40, 60, 78],
  ["leao", "Leão", "BRA", "GOL", "E", 1978, "Palmeiras", 10, 30, 40, 40, 70, 84],
  ["carlos-alberto-torres", "Carlos Alberto", "BRA", "LAT", "D", 1970, "Santos", 70, 84, 80, 82, 82, 10],
  ["nilton-santos", "Nílton Santos", "BRA", "LAT", "E", 1958, "Botafogo", 66, 88, 78, 80, 78, 10],
  ["brito", "Brito", "BRA", "ZAG", "D", 1970, "Flamengo", 30, 82, 55, 60, 86, 10],
  ["piazza", "Piazza", "BRA", "ZAG", "D", 1970, "Cruzeiro", 40, 82, 70, 62, 80, 10],
  ["mauro-ramos", "Mauro Ramos", "BRA", "ZAG", "D", 1962, "Santos", 35, 85, 68, 60, 82, 10],
  ["clodoaldo", "Clodoaldo", "BRA", "VOL", "D", 1970, "Santos", 60, 80, 84, 72, 74, 10],
  ["falcao", "Falcão", "BRA", "VOL", "D", 1982, "Internacional", 72, 82, 90, 70, 78, 10],
  ["gerson", "Gérson", "BRA", "MEI", "E", 1970, "São Paulo", 74, 60, 95, 62, 70, 10],
  ["rivelino", "Rivellino", "BRA", "MEI", "E", 1970, "Corinthians", 88, 45, 90, 76, 74, 10],
  ["zico", "Zico", "BRA", "MEI", "D", 1981, "Flamengo", 92, 40, 94, 80, 66, 10],
  ["socrates", "Sócrates", "BRA", "MEI", "D", 1982, "Corinthians", 86, 50, 92, 68, 76, 10],
  ["pele", "Pelé", "BRA", "ATA", "A", 1970, "Santos", 98, 45, 92, 90, 84, 10],
  ["garrincha", "Garrincha", "BRA", "ATA", "D", 1962, "Botafogo", 92, 30, 82, 94, 66, 10],
  ["jairzinho", "Jairzinho", "BRA", "ATA", "D", 1970, "Botafogo", 90, 35, 74, 92, 82, 10],
  ["tostao", "Tostão", "BRA", "ATA", "E", 1970, "Cruzeiro", 88, 35, 86, 78, 66, 10],
];

const europa: Linha[] = [
  ["yashin", "Yashin", "URS", "GOL", "D", 1963, "Dínamo Moscou", 10, 35, 50, 45, 80, 92],
  ["zoff", "Zoff", "ITA", "GOL", "D", 1982, "Juventus", 10, 30, 45, 40, 74, 88],
  ["facchetti", "Facchetti", "ITA", "LAT", "E", 1965, "Internazionale", 72, 86, 72, 82, 84, 10],
  ["vogts", "Vogts", "FRG", "LAT", "D", 1974, "Borussia M'gladbach", 50, 86, 66, 76, 84, 10],
  ["beckenbauer", "Beckenbauer", "FRG", "ZAG", "D", 1974, "Bayern de Munique", 70, 92, 92, 76, 80, 10],
  ["moore", "Bobby Moore", "ENG", "ZAG", "D", 1966, "West Ham", 45, 90, 82, 60, 78, 10],
  ["krol", "Krol", "NED", "ZAG", "E", 1978, "Ajax", 55, 86, 84, 72, 80, 10],
  ["neeskens", "Neeskens", "NED", "VOL", "D", 1974, "Ajax", 76, 82, 84, 78, 84, 10],
  ["rijkaard", "Rijkaard", "NED", "VOL", "D", 1990, "Milan", 70, 88, 84, 72, 88, 10],
  ["charlton", "Bobby Charlton", "ENG", "MEI", "A", 1966, "Manchester United", 90, 50, 88, 74, 76, 10],
  ["platini", "Platini", "FRA", "MEI", "D", 1984, "Juventus", 92, 40, 95, 70, 66, 10],
  ["di-stefano", "Di Stéfano", "ESP", "MEI", "D", 1959, "Real Madrid", 92, 60, 90, 80, 80, 10],
  ["cruyff", "Cruyff", "NED", "ATA", "D", 1974, "Barcelona", 95, 45, 92, 92, 70, 10],
  ["eusebio", "Eusébio", "POR", "ATA", "D", 1966, "Benfica", 94, 35, 78, 92, 82, 10],
  ["gerd-muller", "Gerd Müller", "FRG", "ATA", "D", 1972, "Bayern de Munique", 96, 30, 66, 74, 80, 10],
  ["puskas", "Puskás", "HUN", "ATA", "E", 1954, "Honvéd", 95, 30, 86, 72, 74, 10],
  ["van-basten", "Van Basten", "NED", "ATA", "D", 1988, "Milan", 94, 35, 80, 80, 82, 10],
];

export const TIMES_EXEMPLO: Time[] = [
  {
    id: "brasil-classico", nome: "Brasil Clássico", sigla: "BRC", cor: "#f2c230",
    elenco: brasil.map(montar), formacao: FORMACOES[0], titulares: [],
  },
  {
    id: "europa-classica", nome: "Europa Clássica", sigla: "EUC", cor: "#3a6fd8",
    elenco: europa.map(montar), formacao: FORMACOES[1], titulares: [],
  },
];
