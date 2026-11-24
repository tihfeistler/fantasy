import { describe, expect, it } from "vitest";
import { montarTimesAtuais, NIVEL } from "../data/clubes";
import {
  balancoDaRodada,
  criarOferta,
  detalharPreco,
  financasIniciais,
  folhaMensal,
  podeComprar,
  precoDeCompra,
  propostaPor,
  valorDeMercado,
} from "./mercado";

const times = montarTimesAtuais();
const time = (id: string) => times.find((t) => t.id === id)!;
const oferta = criarOferta(times);

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
    const d = detalharPreco(melhor, fla, oferta);
    expect(d.destaque).toBe(true);
    expect(d.preco).toBeCloseTo(valorDeMercado(melhor) * d.liga * d.clube * 1.6, -2);
    expect(detalharPreco(reserva, fla, oferta).destaque).toBe(false);
    expect(podeComprar(melhor, fla, time("remo"), 0, oferta)).toBe("caixa");
    expect(podeComprar(melhor, fla, time("remo"), 1e9, oferta)).toBeNull();
  });

  it("quanto mais jogadores parecidos na liga, mais barato", () => {
    const base = time("flamengo").elenco.find((j) => j.posicao === "ZAG")!;
    // Zagueiro 66 é comum; zagueiro 95 não existe na liga.
    const comum = oferta({ ...base, geral: 66 });
    const raro = oferta({ ...base, geral: 95 });
    expect(raro).toBe(1.2);
    expect(comum).toBeLessThan(1);
    expect(comum).toBeGreaterThanOrEqual(0.85);
  });

  it("sobra na posição barateia, carência encarece", () => {
    const fla = time("flamengo");
    const j = fla.elenco.find((x) => x.posicao === "ATA" && x.geral < 75)!;
    const comMuitos = { ...fla, elenco: [...fla.elenco, ...[1, 2, 3, 4, 5].map((i) => ({ ...j, id: `extra-${i}` }))] };
    const soEle = { ...fla, elenco: fla.elenco.filter((x) => x.posicao !== "ATA" || x.id === j.id) };
    expect(precoDeCompra(j, comMuitos, oferta)).toBeLessThan(precoDeCompra(j, soEle, oferta));
  });

  it("proposta é estável na rodada e muda entre rodadas", () => {
    const j = time("gremio").elenco[0];
    const a = propostaPor(j, "gremio", times, NIVEL, 3, 42, oferta);
    expect(propostaPor(j, "gremio", times, NIVEL, 3, 42, oferta)).toEqual(a);
    expect(a.clubeId).not.toBe("gremio");
    const outras = [4, 5, 6, 7].map((r) => propostaPor(j, "gremio", times, NIVEL, r, 42, oferta).valor);
    expect(new Set([a.valor, ...outras]).size).toBeGreaterThan(1);
  });

  it("transferências movem o jogador de clube", () => {
    const j = time("flamengo").elenco[0];
    const depois = montarTimesAtuais({ [j.id]: "remo" });
    expect(depois.find((t) => t.id === "remo")!.elenco.some((x) => x.id === j.id)).toBe(true);
    expect(depois.find((t) => t.id === "flamengo")!.elenco.some((x) => x.id === j.id)).toBe(false);
  });
});
