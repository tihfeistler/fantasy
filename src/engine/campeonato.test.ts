import { describe, expect, it } from "vitest";
import { montarTimesAtuais } from "../data/clubes";
import { calcularTabela, chaveJogo, gerarCalendario, novaTemporada, simularRodada } from "./campeonato";

const times = montarTimesAtuais();
const ids = times.map((t) => t.id);

describe("calendário", () => {
  const cal = gerarCalendario(ids, 42);
  it("tem 38 rodadas de 10 jogos e cada time joga uma vez por rodada", () => {
    expect(cal).toHaveLength(38);
    for (const r of cal) {
      expect(r).toHaveLength(10);
      expect(new Set(r.flat()).size).toBe(20);
    }
  });
  it("cada confronto acontece uma vez em cada mando", () => {
    const jogos = cal.flat().map(([m, v]) => `${m}>${v}`);
    expect(new Set(jogos).size).toBe(380);
    for (const a of ids) {
      expect(cal.flat().filter(([m]) => m === a)).toHaveLength(19);
    }
  });
  it("ninguém joga mais de 3 seguidas no mesmo mando", () => {
    for (let seed = 1; seed <= 30; seed++)
    for (const a of ids) {
      const cal = gerarCalendario(ids, seed);
      let seq = 0, ultimo = "";
      for (const r of cal) {
        const casa = r.find(([m]) => m === a) ? "C" : "F";
        seq = casa === ultimo ? seq + 1 : 1;
        ultimo = casa;
        expect(seq, a).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("temporada", () => {
  it("simula todas as rodadas e a tabela fecha as contas", () => {
    let t = novaTemporada(ids, 2026, 7);
    const mapa = new Map(times.map((x) => [x.id, x]));
    for (let r = 0; r < 38; r++) t = { ...simularRodada(t, mapa, r), rodadaAtual: r + 1 };
    expect(Object.keys(t.placares)).toHaveLength(380);
    const tab = calcularTabela(t, ids);
    expect(tab.every((l) => l.j === 38)).toBe(true);
    expect(tab.reduce((s, l) => s + l.gp, 0)).toBe(tab.reduce((s, l) => s + l.gc, 0));
    expect(tab.reduce((s, l) => s + l.v, 0)).toBe(tab.reduce((s, l) => s + l.d, 0));
    // Os favoritos terminam, em média, na parte de cima
    const pos = (id: string) => tab.findIndex((l) => l.id === id) + 1;
    expect(pos("flamengo")).toBeLessThan(pos("chapecoense"));
  });

  it("não refaz jogo que já tem placar", () => {
    const t0 = novaTemporada(ids, 2026, 1);
    const t1 = { ...t0, placares: { [chaveJogo(0, 0)]: [9, 9] as [number, number] } };
    const t2 = simularRodada(t1, new Map(times.map((x) => [x.id, x])));
    expect(t2.placares[chaveJogo(0, 0)]).toEqual([9, 9]);
    expect(Object.keys(t2.placares)).toHaveLength(10);
  });
});
