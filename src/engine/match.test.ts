import { describe, expect, it } from "vitest";
import { TIMES_EXEMPLO } from "../data/exemplo";
import { escalar } from "./ratings";
import { simularPartida } from "./match";
import type { Time } from "./types";

const [a, b] = TIMES_EXEMPLO;

describe("simularPartida", () => {
  it("é determinística pela seed", () => {
    expect(simularPartida(a, b, 42)).toEqual(simularPartida(a, b, 42));
  });

  it("gera placar coerente com os eventos de gol", () => {
    const r = simularPartida(a, b, 7);
    const gols = r.eventos.filter((e) => e.tipo === "gol");
    expect(gols.filter((e) => e.timeId === a.id).length).toBe(r.golsMandante);
    expect(gols.filter((e) => e.timeId === b.id).length).toBe(r.golsVisitante);
  });

  it("média de gols realista entre times parecidos", () => {
    let total = 0;
    const n = 2000;
    for (let s = 1; s <= n; s++) {
      const r = simularPartida(a, b, s);
      total += r.golsMandante + r.golsVisitante;
    }
    const media = total / n;
    expect(media).toBeGreaterThan(2);
    expect(media).toBeLessThan(3.5);
  });

  it("time muito mais forte vence a maioria", () => {
    const fraco: Time = {
      ...b,
      id: "fraco",
      elenco: b.elenco.map((j) => ({
        ...j,
        geral: Math.round(j.geral * 0.6),
        atributos: Object.fromEntries(
          Object.entries(j.atributos).map(([k, v]) => [k, Math.round(v * 0.6)]),
        ) as unknown as typeof j.atributos,
      })),
    };
    let vitorias = 0;
    for (let s = 1; s <= 500; s++) {
      const r = simularPartida(a, fraco, s);
      if (r.golsMandante > r.golsVisitante) vitorias++;
    }
    expect(vitorias / 500).toBeGreaterThan(0.75);
  });
});

describe("escalar", () => {
  it("com titulares escolhidos, usa só eles e deixa a vaga vazia", () => {
    const auto = escalar(a).map((v) => v.jogador.id);
    const semUm = { ...a, titulares: auto.slice(1) };
    const v = escalar(semUm);
    expect(v).toHaveLength(10);
    expect(v.map((x) => x.jogador.id)).not.toContain(auto[0]);
  });

  it("escala 11 com um goleiro", () => {
    const v = escalar(a);
    expect(v).toHaveLength(11);
    expect(v.filter((x) => x.pos === "GOL")).toHaveLength(1);
    expect(new Set(v.map((x) => x.jogador.id)).size).toBe(11);
  });
});
