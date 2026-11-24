import { criarRng, escolherPonderado, type Rng } from "./rng";
import { escalar, forcaSetores, type ForcaSetores, type Vaga } from "./ratings";
import type { EventoPartida, ResultadoPartida, Time } from "./types";

/**
 * Simulação de partida minuto a minuto, inspirada em gerenciadores
 * clássicos: a cada minuto um time tem a posse do lance (meio-campo
 * decide), pode criar uma chance (ataque x defesa) e a chance pode virar
 * gol (finalizador x goleiro). Os números foram calibrados para dar
 * ~2,5-3 gols por jogo entre times parecidos (ver match.test.ts).
 */
export const PARAMS = {
  vantagemMandante: 1.06,
  chanceBase: 0.11, // prob. de um lance virar chance, times iguais
  golBase: 0.24, // prob. de uma chance virar gol, finalizador = goleiro
  cartaoPorMinuto: 0.035,
};

interface Lado {
  time: Time;
  vagas: Vaga[];
  forca: ForcaSetores;
  gols: number;
}

const razao = (a: number, b: number) => a / (a + b);

/** Aproximação suave: 0.5 => 1x; quanto mais desequilibrado, mais efeito. */
const fatorDesequilibrio = (r: number, intensidade: number) => Math.pow(r / 0.5, intensidade);

function escolherFinalizador(rng: Rng, vagas: Vaga[]) {
  const peso: Record<string, number> = { ATA: 6, MEI: 3, VOL: 1, LAT: 1, ZAG: 0.6, GOL: 0 };
  return escolherPonderado(rng, vagas, (v) => peso[v.pos] * (v.jogador.atributos.ataque / 50));
}

export function simularPartida(mandante: Time, visitante: Time, seed: number): ResultadoPartida {
  const rng = criarRng(seed);
  const mk = (time: Time): Lado => {
    const vagas = escalar(time);
    return { time, vagas, forca: forcaSetores(vagas), gols: 0 };
  };
  const casa = mk(mandante);
  const fora = mk(visitante);
  casa.forca = {
    goleiro: casa.forca.goleiro,
    defesa: casa.forca.defesa * PARAMS.vantagemMandante,
    meio: casa.forca.meio * PARAMS.vantagemMandante,
    ataque: casa.forca.ataque * PARAMS.vantagemMandante,
  };

  const eventos: EventoPartida[] = [{ minuto: 0, tipo: "inicio", texto: "Bola rolando!" }];
  const posseCasa = razao(casa.forca.meio, fora.forca.meio);

  for (let minuto = 1; minuto <= 90; minuto++) {
    if (minuto === 46) eventos.push({ minuto: 45, tipo: "intervalo", texto: "Fim do primeiro tempo." });
    const [atk, def] = rng() < posseCasa ? [casa, fora] : [fora, casa];

    if (rng() < PARAMS.cartaoPorMinuto) {
      const v = def.vagas[1 + Math.floor(rng() * (def.vagas.length - 1))] ?? def.vagas[0];
      eventos.push({
        minuto,
        tipo: "cartao",
        timeId: def.time.id,
        jogadorId: v.jogador.id,
        texto: `Cartão amarelo para ${v.jogador.nome} (${def.time.sigla}).`,
      });
    }

    const pChance =
      PARAMS.chanceBase * fatorDesequilibrio(razao(atk.forca.ataque, def.forca.defesa), 2.5);
    if (rng() >= pChance) continue;

    const fin = escolherFinalizador(rng, atk.vagas);
    const gk = def.vagas.find((v) => v.pos === "GOL")?.jogador;
    const goleiro = def.forca.goleiro;
    const pGol =
      PARAMS.golBase * fatorDesequilibrio(razao(fin.jogador.atributos.ataque, goleiro), 2);

    if (rng() < pGol) {
      atk.gols++;
      eventos.push({
        minuto,
        tipo: "gol",
        timeId: atk.time.id,
        jogadorId: fin.jogador.id,
        texto: `GOL! ${fin.jogador.nome} marca para ${atk.time.sigla}.`,
      });
    } else if (gk && rng() < 0.5) {
      eventos.push({
        minuto,
        tipo: "defesa",
        timeId: def.time.id,
        jogadorId: gk.id,
        texto: `${gk.nome} defende a finalização de ${fin.jogador.nome}.`,
      });
    } else {
      eventos.push({
        minuto,
        tipo: "chance",
        timeId: atk.time.id,
        jogadorId: fin.jogador.id,
        texto: `${fin.jogador.nome} finaliza para fora.`,
      });
    }
  }

  eventos.push({
    minuto: 90,
    tipo: "fim",
    texto: `Fim de jogo: ${mandante.sigla} ${casa.gols} x ${fora.gols} ${visitante.sigla}.`,
  });

  return {
    mandanteId: mandante.id,
    visitanteId: visitante.id,
    golsMandante: casa.gols,
    golsVisitante: fora.gols,
    eventos,
    seed,
  };
}
