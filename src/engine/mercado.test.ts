import { describe, expect, it } from "vitest";
import { montarTimesAtuais, NIVEL } from "../data/clubes";
import {
  balancoDaRodada,
  financasIniciais,
  folhaMensal,
  podeComprar,
  precoDeCompra,
  propostaPor,
  valorDeMercado,
} from "./mercado";

const times = montarTimesAtuais();
const time = (id: string) => times.find((t) => t.id === id)!;

describe("mercado", () => {
  it("valor cresce com o geral", () => {
    const j = time("flamengo").elenco[0];
    expect(valorDeMercado({ ...j, geral: 80 })).toBeGreaterThan(valorDeMercado({ ...j, geral: 70 }));
    expect(valorDeMercado({ ...j, geral: 60 })).toBe(2000);
  });

  it("receitas da carreira cobrem a folha inicial, com pequena sobra", () => {
    for (const t of times) {
      const f = financasIniciais(t);
      const casa = balancoDaRodada(f, t, 1, true).reduce((s, l) => s + l.valor, 0);
      const fora = balancoDaRodada(f, t, 2, false).reduce((s, l) => s + l.valor, 0);
      expect(casa + fora).toBeGreaterThan(0);
      expect(casa + fora).toBeLessThan(folhaMensal(t) / 2);
    }
  });

  it("os 3 melhores de um clube custam mais e o caixa limita a compra", () => {
    const fla = time("flamengo");
    const [melhor] = [...fla.elenco].sort((a, b) => b.geral - a.geral);
    const reserva = [...fla.elenco].sort((a, b) => a.geral - b.geral)[0];
    expect(precoDeCompra(melhor, fla)).toBeGreaterThan(valorDeMercado(melhor) * 1.5);
    expect(precoDeCompra(reserva, fla)).toBeLessThan(valorDeMercado(reserva) * 1.3);
    expect(podeComprar(melhor, fla, time("remo"), 0)).toBe("caixa");
    expect(podeComprar(melhor, fla, time("remo"), 1e9)).toBeNull();
  });

  it("proposta é estável na rodada e muda entre rodadas", () => {
    const j = time("gremio").elenco[0];
    const a = propostaPor(j, "gremio", times, NIVEL, 3, 42);
    expect(propostaPor(j, "gremio", times, NIVEL, 3, 42)).toEqual(a);
    expect(a.clubeId).not.toBe("gremio");
    const outras = [4, 5, 6, 7].map((r) => propostaPor(j, "gremio", times, NIVEL, r, 42).valor);
    expect(new Set([a.valor, ...outras]).size).toBeGreaterThan(1);
  });

  it("transferências movem o jogador de clube", () => {
    const j = time("flamengo").elenco[0];
    const depois = montarTimesAtuais({ [j.id]: "remo" });
    expect(depois.find((t) => t.id === "remo")!.elenco.some((x) => x.id === j.id)).toBe(true);
    expect(depois.find((t) => t.id === "flamengo")!.elenco.some((x) => x.id === j.id)).toBe(false);
  });
});
