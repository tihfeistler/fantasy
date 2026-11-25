import { criarRng, escolherPonderado, type Rng } from "./rng";
import { escalar, forcaNaPosicao, montarBanco, type ForcaSetores, type Vaga } from "./ratings";
import type { EventoPartida, Jogador, Posicao, ResultadoPartida, Time } from "./types";

/**
 * Simulação de partida minuto a minuto, inspirada em gerenciadores
 * clássicos: a cada minuto um time tem a posse do lance (meio-campo
 * decide), pode criar uma chance (ataque x defesa) e a chance pode virar
 * gol (finalizador x goleiro). Os números foram calibrados para dar
 * ~2,5-3 gols por jogo entre times parecidos (ver match.test.ts).
 *
 * A partida é interativa: `PartidaAoVivo` avança um minuto por vez e
 * aceita decisões do técnico (tática e substituições), que valem a partir
 * do minuto seguinte. O resultado é função da seed e das decisões, então o
 * servidor do modo online pode reproduzir a partida com a lista de decisões.
 */
export const PARAMS = {
  vantagemMandante: 1.06,
  chanceBase: 0.11, // prob. de um lance virar chance, times iguais
  golBase: 0.24, // prob. de uma chance virar gol, finalizador = goleiro
  cartaoPorMinuto: 0.035,
};

export const MAX_SUBSTITUICOES = 5;

export type Tatica = "defensiva" | "equilibrada" | "ofensiva";
/** Efeito da tática em ataque e defesa. */
export const EFEITO_TATICA: Record<Tatica, { ataque: number; defesa: number }> = {
  defensiva: { ataque: 0.88, defesa: 1.12 },
  equilibrada: { ataque: 1, defesa: 1 },
  ofensiva: { ataque: 1.12, defesa: 0.88 },
};

export type Decisao =
  | { minuto: number; timeId: string; tipo: "tatica"; tatica: Tatica }
  | { minuto: number; timeId: string; tipo: "sub"; sai: string; entra: string };
/** Decisão sem o minuto (quem aplica é a partida, no minuto atual). */
export type NovaDecisao =
  | { timeId: string; tipo: "tatica"; tatica: Tatica }
  | { timeId: string; tipo: "sub"; sai: string; entra: string };

interface Lado {
  time: Time;
  vagas: Vaga[];
  banco: Jogador[];
  /** Minuto em que cada jogador em campo entrou (0 = titular). */
  entrou: Map<string, number>;
  /** Quem já saiu não volta. */
  saiu: Set<string>;
  subs: number;
  tatica: Tatica;
  gols: number;
  mandante: boolean;
  /** Controlado por um técnico humano (sem IA). */
  humano: boolean;
}

const razao = (a: number, b: number) => a / (a + b);

/** Aproximação suave: 0.5 => 1x; quanto mais desequilibrado, mais efeito. */
const fatorDesequilibrio = (r: number, intensidade: number) => Math.pow(r / 0.5, intensidade);

/**
 * Energia de 0 a 1. Cai a partir de 30 minutos em campo; quem tem mais
 * físico cansa menos. Um titular com físico 60 chega aos 90' com ~84%.
 */
export function energia(j: Jogador, minutosEmCampo: number): number {
  const desgaste = Math.max(0, minutosEmCampo - 30) / 60;
  return Math.max(0.6, 1 - desgaste * 0.3 * (1 - j.atributos.fisico / 130));
}

function escolherFinalizador(rng: Rng, vagas: Vaga[]) {
  const peso: Record<string, number> = { ATA: 6, MEI: 3, VOL: 1, LAT: 1, ZAG: 0.6, GOL: 0 };
  return escolherPonderado(rng, vagas, (v) => peso[v.pos] * (v.jogador.atributos.finalizacao / 50));
}

export class PartidaAoVivo {
  readonly mandante: Time;
  readonly visitante: Time;
  readonly seed: number;
  minuto = 0;
  readonly eventos: EventoPartida[] = [{ minuto: 0, tipo: "inicio", texto: "Bola rolando!" }];
  readonly decisoes: Decisao[] = [];
  private rng: Rng;
  private lados: [Lado, Lado];

  constructor(mandante: Time, visitante: Time, seed: number, humanos: string[] = []) {
    this.mandante = mandante;
    this.visitante = visitante;
    this.seed = seed;
    this.rng = criarRng(seed);
    const mk = (time: Time, mandante: boolean): Lado => {
      const vagas = escalar(time);
      const tit = new Set(vagas.map((v) => v.jogador.id));
      return {
        time,
        vagas,
        banco: montarBanco(time, tit),
        entrou: new Map(vagas.map((v) => [v.jogador.id, 0])),
        saiu: new Set(),
        subs: 0,
        tatica: "equilibrada",
        gols: 0,
        mandante,
        humano: humanos.includes(time.id),
      };
    };
    this.lados = [mk(mandante, true), mk(visitante, false)];
  }

  get encerrada() {
    return this.minuto >= 90;
  }

  lado(timeId: string) {
    return this.lados[0].time.id === timeId ? this.lados[0] : this.lados[1];
  }

  /** Estado de um time para a tela: em campo (com energia), banco, tática e substituições. */
  estado(timeId: string) {
    const l = this.lado(timeId);
    return {
      tatica: l.tatica,
      subs: l.subs,
      gols: l.gols,
      emCampo: l.vagas.map((v) => ({
        ...v,
        energia: energia(v.jogador, this.minuto - (l.entrou.get(v.jogador.id) ?? 0)),
      })),
      banco: l.banco.filter((j) => !l.saiu.has(j.id) && !l.vagas.some((v) => v.jogador.id === j.id)),
    };
  }

  /** Aplica uma decisão do técnico; vale a partir do próximo minuto. Devolve o motivo se for inválida. */
  decidir(d: NovaDecisao): string | null {
    if (this.encerrada) return "A partida acabou.";
    const l = this.lado(d.timeId);
    if (d.tipo === "tatica") {
      if (l.tatica === d.tatica) return null;
      l.tatica = d.tatica;
    } else {
      if (l.subs >= MAX_SUBSTITUICOES) return `Limite de ${MAX_SUBSTITUICOES} substituições.`;
      const i = l.vagas.findIndex((v) => v.jogador.id === d.sai);
      const entra = l.banco.find((j) => j.id === d.entra);
      if (i < 0 || !entra || l.saiu.has(entra.id) || l.entrou.has(entra.id)) return "Substituição inválida.";
      const pos: Posicao = l.vagas[i].pos;
      const sai = l.vagas[i].jogador;
      l.vagas[i] = { pos, jogador: entra };
      l.saiu.add(sai.id);
      l.entrou.set(entra.id, this.minuto);
      l.subs++;
      this.eventos.push({
        minuto: this.minuto,
        tipo: "sub",
        timeId: l.time.id,
        jogadorId: entra.id,
        texto: `Substituição no ${l.time.sigla}: sai ${sai.nome}, entra ${entra.nome}.`,
      });
    }
    if (d.tipo === "tatica")
      this.eventos.push({
        minuto: this.minuto,
        tipo: "tatica",
        timeId: l.time.id,
        texto: `${l.time.sigla} passa a jogar no modo ${d.tatica}.`,
      });
    this.decisoes.push({ ...d, minuto: this.minuto } as Decisao);
    return null;
  }

  /** Força dos setores agora: escalação, energia, tática e mando. */
  private forca(l: Lado): ForcaSetores {
    const media = (ps: Posicao[]) => {
      const vs = l.vagas.filter((v) => ps.includes(v.pos));
      if (!vs.length) return 30;
      return (
        vs.reduce(
          (s, v) => s + forcaNaPosicao(v.jogador, v.pos) * energia(v.jogador, this.minuto - (l.entrou.get(v.jogador.id) ?? 0)),
          0,
        ) / vs.length
      );
    };
    const fator = Math.min(1, l.vagas.length / 11);
    const mando = l.mandante ? PARAMS.vantagemMandante : 1;
    const t = EFEITO_TATICA[l.tatica];
    return {
      goleiro: media(["GOL"]) * fator,
      defesa: media(["ZAG", "LAT", "VOL"]) * fator * mando * t.defesa,
      meio: media(["VOL", "MEI", "LAT"]) * fator * mando,
      ataque: media(["ATA", "MEI"]) * fator * mando * t.ataque,
    };
  }

  /** Técnico da IA: muda a tática pelo placar e troca os mais cansados. */
  private ia(l: Lado) {
    if (l.humano || this.minuto < 55) return;
    const outro = l === this.lados[0] ? this.lados[1] : this.lados[0];
    const saldo = l.gols - outro.gols;
    const tatica: Tatica = this.minuto >= 65 && saldo < 0 ? "ofensiva" : this.minuto >= 75 && saldo > 0 ? "defensiva" : "equilibrada";
    if (tatica !== l.tatica) this.decidir({ timeId: l.time.id, tipo: "tatica", tatica });
    if ([60, 70, 80].includes(this.minuto) && l.subs < 3) {
      const est = this.estado(l.time.id);
      const cansado = est.emCampo.filter((v) => v.pos !== "GOL").sort((a, b) => a.energia - b.energia)[0];
      const reserva =
        cansado &&
        est.banco
          .filter((j) => j.posicao === cansado.pos)
          .sort((a, b) => b.geral - a.geral)[0];
      if (cansado && reserva && reserva.geral >= cansado.jogador.geral * cansado.energia)
        this.decidir({ timeId: l.time.id, tipo: "sub", sai: cansado.jogador.id, entra: reserva.id });
    }
  }

  /** Joga um minuto. Devolve os eventos novos. */
  avancar(): EventoPartida[] {
    if (this.encerrada) return [];
    const antes = this.eventos.length;
    for (const l of this.lados) this.ia(l);
    this.minuto++;
    const minuto = this.minuto;
    const rng = this.rng;
    const [casa, fora] = this.lados;
    if (minuto === 46) this.eventos.push({ minuto: 45, tipo: "intervalo", texto: "Fim do primeiro tempo." });
    const fc = this.forca(casa);
    const ff = this.forca(fora);
    const [atk, def, fa, fd] = rng() < razao(fc.meio, ff.meio) ? [casa, fora, fc, ff] : [fora, casa, ff, fc];

    if (rng() < PARAMS.cartaoPorMinuto) {
      const v = def.vagas[1 + Math.floor(rng() * (def.vagas.length - 1))] ?? def.vagas[0];
      this.eventos.push({
        minuto,
        tipo: "cartao",
        timeId: def.time.id,
        jogadorId: v.jogador.id,
        texto: `Cartão amarelo para ${v.jogador.nome} (${def.time.sigla}).`,
      });
    }

    const pChance = PARAMS.chanceBase * fatorDesequilibrio(razao(fa.ataque, fd.defesa), 2.5);
    if (rng() < pChance) {
      const fin = escolherFinalizador(rng, atk.vagas);
      const gk = def.vagas.find((v) => v.pos === "GOL")?.jogador;
      const pGol = PARAMS.golBase * fatorDesequilibrio(razao(fin.jogador.atributos.finalizacao, fd.goleiro), 2);
      if (rng() < pGol) {
        atk.gols++;
        this.eventos.push({
          minuto,
          tipo: "gol",
          timeId: atk.time.id,
          jogadorId: fin.jogador.id,
          texto: `GOL! ${fin.jogador.nome} marca para ${atk.time.sigla}.`,
        });
      } else if (gk && rng() < 0.5) {
        this.eventos.push({
          minuto,
          tipo: "defesa",
          timeId: def.time.id,
          jogadorId: gk.id,
          texto: `${gk.nome} (${def.time.sigla}) defende a finalização de ${fin.jogador.nome}.`,
        });
      } else {
        this.eventos.push({
          minuto,
          tipo: "chance",
          timeId: atk.time.id,
          jogadorId: fin.jogador.id,
          texto: `${fin.jogador.nome} finaliza para fora.`,
        });
      }
    }

    if (minuto === 90)
      this.eventos.push({
        minuto: 90,
        tipo: "fim",
        texto: `Fim de jogo: ${this.mandante.sigla} ${casa.gols} x ${fora.gols} ${this.visitante.sigla}.`,
      });
    return this.eventos.slice(antes);
  }

  resultado(): ResultadoPartida {
    return {
      mandanteId: this.mandante.id,
      visitanteId: this.visitante.id,
      golsMandante: this.lados[0].gols,
      golsVisitante: this.lados[1].gols,
      eventos: [...this.eventos],
      seed: this.seed,
    };
  }
}

/**
 * Partida inteira de uma vez. `decisoes` (de técnicos humanos) são
 * reaplicadas nos seus minutos: mesma seed + mesmas decisões = mesma partida.
 */
export function simularPartida(mandante: Time, visitante: Time, seed: number, decisoes: Decisao[] = []): ResultadoPartida {
  const humanos = [...new Set(decisoes.map((d) => d.timeId))];
  const p = new PartidaAoVivo(mandante, visitante, seed, humanos);
  while (!p.encerrada) {
    for (const d of decisoes.filter((x) => x.minuto === p.minuto)) p.decidir(d);
    p.avancar();
  }
  return p.resultado();
}
