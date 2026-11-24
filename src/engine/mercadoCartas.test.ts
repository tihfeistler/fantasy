import { describe, expect, it } from "vitest";
import { TIMES_EXEMPLO } from "../data/exemplo";
import {
  comTaxa,
  MERCADO_CARTAS_INICIAL,
  mercadoInicial,
  precoReferencia,
  respostaSimulada,
  rodadaDoMercado,
} from "./mercadoCartas";
import { VALOR_VENDA, faixa } from "./pacotes";
import { criarRng } from "./rng";

const todas = TIMES_EXEMPLO.flatMap((t) => t.elenco).filter((j) => (j.tipo ?? "classico") === "classico");
const lendas = new Map(todas.map((j) => [j.id, j]));

describe("mercado de cartas entre técnicos", () => {
  it("preço de referência fica acima do preço básico do sistema", () => {
    for (const j of todas) expect(precoReferencia(j)).toBeGreaterThan(VALOR_VENDA[faixa(j)]);
  });

  it("taxa de 5% sai do vendedor, arredondada para cima", () => {
    expect(comTaxa(1000)).toBe(950);
    expect(comTaxa(101)).toBe(95);
  });

  it("mercado inicial tem anúncios de outros técnicos e é determinístico", () => {
    const a = mercadoInicial(lendas, 7);
    expect(a.anuncios.length).toBe(14);
    expect(a.anuncios.every((x) => x.vendedor !== "voce" && lendas.has(x.jogadorId))).toBe(true);
    expect(mercadoInicial(lendas, 7)).toEqual(a);
  });

  it("anúncio barato vende mais que anúncio caro", () => {
    const j = todas[0];
    const ref = precoReferencia(j);
    let barato = 0;
    let caro = 0;
    for (let s = 1; s <= 200; s++) {
      const m = (preco: number) => ({ ...MERCADO_CARTAS_INICIAL, meus: [{ id: "x", vendedor: "voce", jogadorId: j.id, preco }] });
      if (rodadaDoMercado(m(Math.round(ref * 0.6)), lendas, 1, criarRng(s)).moedas > 0) barato++;
      if (rodadaDoMercado(m(ref * 3), lendas, 1, criarRng(s)).moedas > 0) caro++;
    }
    expect(barato).toBeGreaterThan(caro * 3);
  });

  it("venda simulada paga o preço menos a taxa e tira o anúncio", () => {
    const j = todas[0];
    for (let s = 1; s < 100; s++) {
      const r = rodadaDoMercado(
        { ...MERCADO_CARTAS_INICIAL, meus: [{ id: "x", vendedor: "voce", jogadorId: j.id, preco: 100 }] },
        lendas,
        1,
        criarRng(s),
      );
      if (r.moedas) {
        expect(r.moedas).toBe(comTaxa(100));
        expect(r.mercado.meus).toHaveLength(0);
        return;
      }
    }
    throw new Error("nenhuma venda em 100 rodadas");
  });

  it("técnico simulado aceita 90% ou mais e recusa abaixo de 75%", () => {
    const rng = criarRng(1);
    expect(respostaSimulada(1000, 900, rng)).toBe(true);
    expect(respostaSimulada(1000, 740, rng)).toBe(false);
  });
});
