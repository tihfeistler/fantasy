import { useEffect, useRef, useState } from "react";
import type { PartidaAoVivo } from "../engine/match";
import type { EventoPartida, Posicao, Time } from "../engine/types";

/**
 * Campo 2D da partida. É só a tela: o resultado continua vindo do motor
 * (match.ts). A cada minuto o campo monta um "roteiro" do lance com o que o
 * motor decidiu (quem teve a posse, se houve chance, gol, defesa ou
 * cartão) e anima a bola e os 22 jogadores durante o minuto. O roteiro usa
 * um sorteio próprio, preso à seed e ao minuto, então não mexe no placar.
 *
 * Coordenadas em metros: campo de 105 x 68. O mandante ataca para a direita.
 */
const C = 105;
const L = 68;
type P = { x: number; y: number };
type Lado = 0 | 1;

/** Profundidade base de cada posição (0 = próprio gol, 1 = gol adversário). */
const PROFUNDIDADE: Record<Posicao, number> = { GOL: 0.035, ZAG: 0.2, LAT: 0.25, VOL: 0.34, MEI: 0.46, ATA: 0.6 };

const lim = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: P, b: P, f: number): P => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const suave = (f: number) => f * f * (3 - 2 * f);

/** Do referencial do time (profundidade, largura de 0 a 1) para o campo. */
const noCampo = (lado: Lado, ax: number, ay: number): P =>
  lado === 0 ? { x: ax * C, y: ay * L } : { x: (1 - ax) * C, y: (1 - ay) * L };
const doCampo = (lado: Lado, p: P) => (lado === 0 ? { ax: p.x / C, ay: p.y / L } : { ax: 1 - p.x / C, ay: 1 - p.y / L });

/** Posição base (referencial do time) de cada vaga, pela formação. */
export function posicoesBase(posicoes: Posicao[]) {
  const total: Partial<Record<Posicao, number>> = {};
  for (const p of posicoes) total[p] = (total[p] ?? 0) + 1;
  const visto: Partial<Record<Posicao, number>> = {};
  return posicoes.map((pos) => {
    const n = total[pos]!;
    const i = (visto[pos] = (visto[pos] ?? -1) + 1);
    let ay: number;
    if (pos === "GOL") ay = 0.5;
    else if (pos === "LAT") ay = n === 1 ? 0.14 : 0.12 + (i * 0.76) / (n - 1);
    else {
      const gap = n >= 4 ? 0.2 : n === 3 ? 0.25 : 0.3;
      ay = 0.5 + (i - (n - 1) / 2) * gap;
    }
    return { ax: PROFUNDIDADE[pos], ay: lim(ay, 0.08, 0.92) };
  });
}

/** Sorteio só da tela (mulberry32), preso à seed e ao minuto. */
function sorteio(seed: number, minuto: number) {
  let a = (seed ^ Math.imul(minuto + 1, 2654435761)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cor do visitante: a própria, ou uma alternativa se for parecida com a do mandante. */
function rgb(cor: string) {
  const n = parseInt(cor.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const claro = (cor: string) => {
  const [r, g, b] = rgb(cor);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
};
const distancia = (x: string, y: string) => {
  const [a, b] = [rgb(x), rgb(y)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};
const GRAMADO = "#2c7f3e";
/**
 * Cores das camisas no campo: a do clube, trocada por branco ou escuro se
 * sumir no gramado; o visitante também troca se ficar parecido com o mandante.
 */
export function coresDosTimes(m: string, v: string): [string, string] {
  const alternativas = ["#f4f4f4", "#1b1f2a", "#d62828", "#1d4ed8"];
  const naGrama = (c: string) => distancia(c, GRAMADO) < 110;
  const casa = naGrama(m) ? alternativas.find((c) => !naGrama(c))! : m;
  if (!naGrama(v) && distancia(casa, v) >= 110) return [casa, v];
  return [casa, alternativas.find((c) => !naGrama(c) && distancia(c, casa) >= 110)!];
}
/** Goleiros com cor própria, diferente das camisas de linha. */
const COR_GOLEIRO = ["#f4a261", "#c084fc"];

interface Quadro {
  t: number;
  p: P;
  /** Quem está com a bola (ou indo buscá-la) neste trecho. */
  dono?: string;
}
interface Roteiro {
  minuto: number;
  quadros: Quadro[];
  posse?: Lado;
  /** Instante (0-1) em que sai o chute. */
  chuteT?: number;
  lance?: EventoPartida;
  /** Como recomeça o próximo minuto. */
  depois?: "centro" | "tiro-de-meta" | "goleiro";
}

interface Jog {
  id: string;
  nome: string;
  pos: Posicao;
  lado: Lado;
  num: number;
  base: { ax: number; ay: number };
}

interface Props {
  partida: PartidaAoVivo;
  mandante: Time;
  visitante: Time;
  meuTimeId: string;
  /** Quanto tempo o minuto atual fica na tela (a animação do lance cabe nele). */
  msPorMinuto: number;
}

export function CampoPartida({ partida, mandante, visitante, meuTimeId, msPorMinuto }: Props) {
  const [, setQuadro] = useState(0);
  const props = useRef({ partida, msPorMinuto });
  props.current = { partida, msPorMinuto };
  const estado = useRef({
    roteiro: null as Roteiro | null,
    inicioMinuto: 0,
    bola: { x: C / 2, y: L / 2 } as P,
    dono: undefined as string | undefined,
    pos: new Map<string, P>(),
    ultimo: 0,
    numeros: new Map<string, number>(),
  });

  const [corM, corV] = coresDosTimes(mandante.cor, visitante.cor);
  const cores = [corM, corV];

  // Jogadores em campo agora (as trocas aparecem na hora).
  const jogadores = (): Jog[] => {
    const e = estado.current;
    const out: Jog[] = [];
    [mandante, visitante].forEach((t, lado) => {
      const vagas = partida.estado(t.id).emCampo;
      const base = posicoesBase(vagas.map((v) => v.pos));
      vagas.forEach((v, i) => {
        // Número da camisa: titulares 1-11 pela vaga; quem entra herda o próximo livre.
        const chave = `${lado}:${v.jogador.id}`;
        if (!e.numeros.has(chave)) {
          const usados = [...e.numeros].filter(([k]) => k.startsWith(`${lado}:`)).map(([, n]) => n);
          e.numeros.set(chave, usados.length < vagas.length && !usados.includes(i + 1) && usados.length === i ? i + 1 : Math.max(11, ...usados) + 1);
        }
        out.push({
          id: v.jogador.id,
          nome: v.jogador.nome,
          pos: v.pos,
          lado: lado as Lado,
          num: e.numeros.get(chave)!,
          base: base[i],
        });
      });
    });
    return out;
  };

  const ladoDe = (timeId?: string): Lado | undefined =>
    timeId === mandante.id ? 0 : timeId === visitante.id ? 1 : undefined;

  /** Onde o jogador quer estar, dada a bola e a posse. */
  const alvo = (j: Jog, bola: P, posse: Lado | undefined, agora: number): P => {
    const b = doCampo(j.lado, bola);
    const balanco = Math.sin(agora / 900 + j.num * 1.7) * 0.008;
    if (j.pos === "GOL") return noCampo(j.lado, 0.03 + lim((0.4 - b.ax) * -0.03, 0, 0.03), 0.5 + (b.ay - 0.5) * 0.25);
    const comBola = posse === j.lado;
    const desloc = (b.ax - 0.5) * 0.42 + (posse === undefined ? -0.08 : comBola ? 0.07 : -0.06);
    const minAx = j.pos === "ZAG" ? 0.1 : 0.07;
    const ax = lim(j.base.ax + desloc + balanco, minAx, posse === undefined ? 0.48 : 0.93);
    const ay = lim(j.base.ay + (b.ay - 0.5) * 0.24 + balanco, 0.04, 0.96);
    return noCampo(j.lado, ax, ay);
  };

  /** Monta o lance do minuto com o que o motor decidiu. */
  const montarRoteiro = (minuto: number, js: Jog[], agora: number): Roteiro => {
    const e = estado.current;
    const anterior = e.roteiro;
    const rng = sorteio(partida.seed, minuto);
    const posse = ladoDe(partida.posse[minuto]);
    const evs = partida.eventos.filter((x) => x.minuto === minuto);
    const lance = evs.find((x) => x.tipo === "gol" || x.tipo === "defesa" || x.tipo === "chance");
    const r: Roteiro = { minuto, quadros: [], posse, lance };
    if (posse === undefined) {
      r.quadros.push({ t: 0, p: { x: C / 2, y: L / 2 } });
      return r;
    }
    const meus = js.filter((j) => j.lado === posse);
    const outros = js.filter((j) => j.lado !== posse);
    const linha = meus.filter((j) => j.pos !== "GOL");
    const goleiro = (lado: Lado) => js.find((j) => j.lado === lado && j.pos === "GOL");
    if (!linha.length) {
      r.quadros.push({ t: 0, p: e.bola });
      return r;
    }

    // Ponto de partida: continua de onde a bola parou ou recomeça.
    let inicio = e.bola;
    let dono = e.dono;
    if (!anterior || anterior.depois === "centro" || minuto === 46) {
      inicio = { x: C / 2, y: L / 2 };
      dono = (linha.find((j) => j.pos === "ATA") ?? linha[0]).id;
    } else if (anterior.depois === "tiro-de-meta") {
      const lado = anterior.posse === 0 ? 1 : 0;
      inicio = noCampo(lado as Lado, 0.05, 0.5);
      dono = goleiro(lado as Lado)?.id;
    }
    r.quadros.push({ t: 0, p: inicio, dono });
    let t = 0;
    // Se a bola está com o outro time, alguém do time da posse toma a bola.
    if (!meus.some((j) => j.id === dono)) {
      const perto = [...linha].sort((a, b) => dist(alvo(a, inicio, posse, agora), inicio) - dist(alvo(b, inicio, posse, agora), inicio))[0];
      const p = lerp(inicio, alvo(perto, inicio, posse, agora), 0.35);
      t = 0.14;
      r.quadros.push({ t, p, dono: perto.id });
      dono = perto.id;
      inicio = p;
    }

    const chute = !!lance;
    const progresso0 = doCampo(posse, inicio).ax;
    const progressoFim = chute ? 0.83 + rng() * 0.05 : lim(progresso0 + (rng() - 0.35) * 0.45, 0.15, 0.78);
    const n = chute ? 3 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
    const fimPasses = chute ? 0.6 : 0.95;
    // Quem finaliza: o do motor (gol ou chance); na defesa, um atacante.
    let finalizador = lance && lance.tipo !== "defesa" ? linha.find((j) => j.id === lance.jogadorId) : undefined;
    if (chute && !finalizador) {
      const atk = linha.filter((j) => j.pos === "ATA" || j.pos === "MEI");
      finalizador = (atk.length ? atk : linha)[Math.floor(rng() * (atk.length || linha.length))];
    }
    for (let k = 1; k <= n; k++) {
      const alvoProg = progresso0 + ((progressoFim - progresso0) * k) / n;
      let j: Jog;
      if (k === n && finalizador) j = finalizador;
      else {
        const cand = linha.filter((x) => x.id !== dono);
        const pesos = cand.map((x) => Math.exp(-(((x.base.ax + 0.12 - alvoProg) / 0.14) ** 2)) + 0.04);
        let s = rng() * pesos.reduce((a, b) => a + b, 0);
        j = cand[cand.length - 1];
        for (let i = 0; i < cand.length; i++) if ((s -= pesos[i]) <= 0) {
          j = cand[i];
          break;
        }
      }
      const ay = k === n && chute ? 0.32 + rng() * 0.36 : lim(j.base.ay + (rng() - 0.5) * 0.16, 0.06, 0.94);
      t = t + (fimPasses - t) / (n - k + 1);
      r.quadros.push({ t, p: noCampo(posse, lim(alvoProg + (rng() - 0.5) * 0.04, 0.06, 0.9), ay), dono: j.id });
      dono = j.id;
    }

    if (lance) {
      r.chuteT = fimPasses;
      const outro: Lado = posse === 0 ? 1 : 0;
      if (lance.tipo === "gol") {
        r.quadros.push({ t: fimPasses + 0.1, p: noCampo(posse, 1.012, 0.45 + rng() * 0.1) });
        r.depois = "centro";
      } else if (lance.tipo === "defesa") {
        const gk = goleiro(outro);
        r.quadros.push({ t: fimPasses + 0.1, p: noCampo(posse, 0.975, 0.44 + rng() * 0.12), dono: gk?.id });
        r.depois = "goleiro";
      } else {
        r.quadros.push({ t: fimPasses + 0.12, p: noCampo(posse, 1.03, rng() < 0.5 ? 0.38 : 0.62) });
        r.depois = "tiro-de-meta";
      }
    } else if (rng() < 0.3) {
      // Às vezes o lance termina num desarme.
      const ult = r.quadros[r.quadros.length - 1];
      const ladrao = [...outros].filter((j) => j.pos !== "GOL").sort((a, b) => dist(alvo(a, ult.p, posse, agora), ult.p) - dist(alvo(b, ult.p, posse, agora), ult.p))[0];
      if (ladrao) r.quadros.push({ t: 0.98, p: lerp(ult.p, alvo(ladrao, ult.p, posse, agora), 0.4), dono: ladrao.id });
    }
    return r;
  };

  const bolaEm = (r: Roteiro, t: number): { p: P; dono?: string } => {
    const q = r.quadros;
    if (!q.length) return { p: { x: C / 2, y: L / 2 } };
    if (t <= q[0].t) return { p: q[0].p, dono: q[0].dono };
    for (let i = 1; i < q.length; i++) {
      if (t < q[i].t) {
        const f = (t - q[i - 1].t) / (q[i].t - q[i - 1].t);
        return { p: lerp(q[i - 1].p, q[i].p, suave(f)), dono: q[i].dono };
      }
    }
    const u = q[q.length - 1];
    return { p: u.p, dono: u.dono };
  };

  useEffect(() => {
    let id = 0;
    const passo = (agora: number) => {
      const e = estado.current;
      const { partida: pt, msPorMinuto: ms } = props.current;
      const js = jogadores();
      if (!e.roteiro || e.roteiro.minuto !== pt.minuto) {
        e.roteiro = montarRoteiro(pt.minuto, js, agora);
        e.inicioMinuto = agora;
      }
      const r = e.roteiro;
      const t = lim((agora - e.inicioMinuto) / Math.max(1, ms), 0, 1);
      const b = bolaEm(r, t);
      e.bola = b.p;
      e.dono = b.dono;
      const dt = Math.min(0.1, (agora - (e.ultimo || agora)) / 1000);
      e.ultimo = agora;
      // Quem marca: o adversário mais perto da bola aperta.
      const defensor = r.posse === undefined ? undefined : js
        .filter((j) => j.lado !== r.posse && j.pos !== "GOL")
        .sort((a, c) => dist(alvo(a, b.p, r.posse, agora), b.p) - dist(alvo(c, b.p, r.posse, agora), b.p))[0];
      // Mais rápido quando o minuto passa rápido.
      const k = lim(5 * (700 / Math.max(120, ms)), 4, 18);
      const vivos = new Set<string>();
      for (const j of js) {
        vivos.add(j.id);
        let a = alvo(j, b.p, r.posse, agora);
        if (j.id === b.dono) {
          const dir = j.lado === 0 ? -1 : 1;
          a = { x: b.p.x + dir * 0.9, y: b.p.y + 0.3 };
        } else if (defensor && j.id === defensor.id) a = lerp(a, b.p, 0.55);
        // Quem entra começa na lateral, perto do banco.
        const atual = e.pos.get(j.id) ?? (pt.minuto === 0 ? a : { x: C / 2 + (j.lado ? 4 : -4), y: L + 2 });
        const f = 1 - Math.exp(-dt * (j.id === b.dono ? k * 1.8 : k));
        e.pos.set(j.id, lerp(atual, a, f));
      }
      for (const idj of e.pos.keys()) if (!vivos.has(idj)) e.pos.delete(idj);
      setQuadro((x) => x + 1);
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
    // O laço lê tudo por refs; só reinicia ao trocar de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partida]);

  const e = estado.current;
  const js = jogadores();
  const r = e.roteiro;
  const agora = typeof performance !== "undefined" ? performance.now() : 0;
  const t = r ? lim((agora - e.inicioMinuto) / Math.max(1, msPorMinuto), 0, 1) : 0;
  const chutou = r?.chuteT !== undefined && t >= r.chuteT + 0.08;

  // Faixa sobre o campo: o lance do minuto (depois do chute) e trocas/cartões.
  const doMinuto = partida.eventos.filter((x) => x.minuto === partida.minuto);
  const faixa: { texto: string; classe: string; cor?: string } | null = (() => {
    if (r?.lance && chutou) {
      const l = r.lance;
      const nome = js.find((j) => j.id === l.jogadorId)?.nome ?? "";
      if (l.tipo === "gol")
        return { texto: `GOL! ${nome}`, classe: "gol", cor: cores[ladoDe(l.timeId) ?? 0] };
      if (l.tipo === "defesa") return { texto: `Defesa de ${nome}!`, classe: "lance" };
      return { texto: "Para fora!", classe: "lance" };
    }
    const sub = [...doMinuto].reverse().find((x) => x.tipo === "sub" || x.tipo === "cartao");
    if (sub) return { texto: sub.texto, classe: sub.tipo === "cartao" ? "cartao" : "troca" };
    if (partida.encerrada) return { texto: "Fim de jogo", classe: "aviso" };
    if (partida.minuto === 45) return { texto: "Intervalo", classe: "aviso" };
    return null;
  })();
  const cartoes = new Set(doMinuto.filter((x) => x.tipo === "cartao").map((x) => x.jogadorId));
  const golNaRede = r?.lance?.tipo === "gol" && chutou ? ladoDe(r.lance.timeId) : undefined;
  const nomeDono = js.find((j) => j.id === e.dono);

  return (
    <div className="campo-partida">
      <svg viewBox={`-4 -4 ${C + 8} ${L + 8}`} role="img" aria-label={`Campo: ${mandante.nome} contra ${visitante.nome}`}>
        <defs>
          <pattern id="faixas-gramado" width="21" height={L} patternUnits="userSpaceOnUse">
            <rect width="10.5" height={L} className="gramado-a" />
            <rect x="10.5" width="10.5" height={L} className="gramado-b" />
          </pattern>
        </defs>
        <rect x="-4" y="-4" width={C + 8} height={L + 8} className="gramado-borda" />
        <rect width={C} height={L} fill="url(#faixas-gramado)" />
        <g className="linhas">
          <rect width={C} height={L} />
          <line x1={C / 2} y1="0" x2={C / 2} y2={L} />
          <circle cx={C / 2} cy={L / 2} r="9.15" />
          <circle cx={C / 2} cy={L / 2} r="0.4" className="ponto" />
          {[0, 1].map((lado) => {
            const x = (v: number) => (lado === 0 ? v : C - v);
            const w = (v: number) => (lado === 0 ? 0 : -v);
            return (
              <g key={lado}>
                <rect x={x(0) + w(16.5)} y={L / 2 - 20.16} width="16.5" height="40.32" />
                <rect x={x(0) + w(5.5)} y={L / 2 - 9.16} width="5.5" height="18.32" />
                <circle cx={x(11)} cy={L / 2} r="0.4" className="ponto" />
                <rect
                  x={x(0) + (lado === 0 ? -2 : 0)}
                  y={L / 2 - 3.66}
                  width="2"
                  height="7.32"
                  className={`gol${golNaRede !== undefined && golNaRede !== lado ? " balancando" : ""}`}
                />
              </g>
            );
          })}
        </g>
        {js.map((j) => {
          const p = e.pos.get(j.id) ?? alvo(j, e.bola, undefined, agora);
          const cor = cores[j.lado];
          const meu = (j.lado === 0 ? mandante.id : visitante.id) === meuTimeId;
          return (
            <g key={`${j.lado}:${j.id}`} transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`} className="jogador-campo">
              <title>{`${j.nome} (${j.pos})`}</title>
              <circle r="1.9" fill={j.pos === "GOL" ? COR_GOLEIRO[j.lado] : cor} className={meu ? "meu" : ""} />
              <text y="0.75" className="num" fill={claro(j.pos === "GOL" ? COR_GOLEIRO[j.lado] : cor) ? "#0b1324" : "#fff"}>
                {j.num}
              </text>
              {cartoes.has(j.id) && <rect x="1.4" y="-4.2" width="1.4" height="2" rx="0.2" className="amarelo" />}
            </g>
          );
        })}
        {nomeDono && (
          <text
            x={(e.pos.get(nomeDono.id)?.x ?? e.bola.x).toFixed(2)}
            y={((e.pos.get(nomeDono.id)?.y ?? e.bola.y) - 2.8).toFixed(2)}
            className="nome-dono"
          >
            {nomeDono.nome}
          </text>
        )}
        <circle cx={e.bola.x.toFixed(2)} cy={(e.bola.y + 0.35).toFixed(2)} r="0.85" className="sombra-bola" />
        <circle cx={e.bola.x.toFixed(2)} cy={e.bola.y.toFixed(2)} r="0.8" className="bola" />
      </svg>
      {faixa && (
        <div className={`faixa-campo ${faixa.classe}`} style={faixa.cor ? { background: faixa.cor, color: claro(faixa.cor) ? "#0b1324" : "#fff" } : undefined}>
          {faixa.texto}
        </div>
      )}
      <div className="legenda-campo">
        <span>
          <i style={{ background: corM }} /> {mandante.sigla} ataca para a direita
        </span>
        <span>
          <i style={{ background: corV }} /> {visitante.sigla}
        </span>
      </div>
    </div>
  );
}
