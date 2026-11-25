import { describe, expect, it } from "vitest";
import { ATUAIS } from "../data/clubes";
import { TIMES_EXEMPLO } from "../data/exemplo";
import {
  custoDaPartida,
  custoPorPartida,
  DESAFIOS,
  forcaMedia,
  kitInicial,
  montarTimeCartas,
  precoCartaBase,
  TIME_CARTAS_INICIAL,
  timeDoDesafio,
  vendaCartaBase,
} from "./desafios";
import { escalar } from "./ratings";
import { ehLenda } from "./types";

const lendas = TIMES_EXEMPLO.flatMap((t) => t.elenco).filter(ehLenda);
const porId = new Map(ATUAIS.map((j) => [j.id, j]));

describe("time de cartas e desafios", () => {
  it("kit inicial tem 16 cartas fracas e escala 11", () => {
    const ids = kitInicial(ATUAIS, 3);
    expect(ids).toHaveLength(16);
    const cartas = ids.map((id) => porId.get(id)!);
    expect(cartas.every((j) => j.geral <= 68)).toBe(true);
    const t = montarTimeCartas(TIME_CARTAS_INICIAL, cartas);
    expect(escalar(t)).toHaveLength(11);
  });

  it("carta base: preço sobe com o geral e venda ao sistema paga menos", () => {
    const [a, b] = [ATUAIS.find((j) => j.geral === 65)!, ATUAIS.find((j) => j.geral === 80)!];
    expect(precoCartaBase(b)).toBeGreaterThan(precoCartaBase(a));
    expect(vendaCartaBase(b)).toBeLessThan(precoCartaBase(b));
  });

  it("lenda cobra cachê em dobro de um atual do mesmo geral", () => {
    const atual = ATUAIS.find((j) => j.geral === 80)!;
    const lenda = { ...atual, tipo: "classico" as const };
    expect(custoPorPartida(lenda)).toBe(custoPorPartida(atual) * 2);
  });

  it("treino é de graça e, nos desafios pagos, a vitória cobre o custo do time inicial", () => {
    const t = montarTimeCartas(TIME_CARTAS_INICIAL, kitInicial(ATUAIS, 3).map((id) => porId.get(id)!));
    const custo = custoDaPartida(t);
    expect(DESAFIOS.find((d) => d.id === "treino")!.gratis).toBe(true);
    for (const d of DESAFIOS.filter((x) => !x.gratis)) expect(d.premio.vitoria).toBeGreaterThan(custo);
  });

  it("desafios de atuais têm 11 ou mais jogadores e dificuldade crescente na força", () => {
    const atuais = DESAFIOS.filter((d) => ["treino", "nordeste", "flamengo", "brasileirao"].includes(d.id)).map((d) =>
      timeDoDesafio(d, ATUAIS, lendas),
    );
    for (const t of atuais) expect(t.elenco.length).toBeGreaterThanOrEqual(11);
    const forcas = atuais.map(forcaMedia);
    expect([...forcas].sort((a, b) => a - b)).toEqual(forcas);
  });
});
