import { describe, expect, it } from "vitest";
import { ATUAIS } from "../data/clubes";
import { contratoPadrao, contratosTerminando, destinoDaSaida, folhaComContratos, negociarContrato, pedidaSalarial } from "./contratos";
import { dividaDaRodada, salarioMensal } from "./mercado";

const j = ATUAIS.find((x) => x.geral >= 75)!;

describe("contratos", () => {
  it("quem sai de graça vai para um clube fixo, nunca o do técnico", () => {
    const clubes = ["a", "b", "c", "d"];
    const d = destinoDaSaida(j, clubes, "b", 2026);
    expect(d).not.toBe("b");
    expect(destinoDaSaida(j, clubes, "b", 2026)).toBe(d);
  });
  it("contrato padrão termina entre o ano inicial e +3, com salário de tabela", () => {
    for (const x of ATUAIS.slice(0, 50)) {
      const c = contratoPadrao(x, 2026);
      expect(c.ate).toBeGreaterThanOrEqual(2026);
      expect(c.ate).toBeLessThanOrEqual(2029);
      expect(c.salario).toBe(salarioMensal(x));
    }
  });
  it("contrato longo custa mais e o humor fica entre 95% e 120%", () => {
    const base = salarioMensal(j);
    for (let m = 0; m < 30; m++) {
      const p1 = pedidaSalarial(j, 1, m);
      expect(p1).toBeGreaterThanOrEqual(base * 0.94);
      expect(p1).toBeLessThanOrEqual(base * 1.21);
      expect(pedidaSalarial(j, 5, m)).toBeGreaterThan(p1);
    }
  });
  it("aceita no pedido, contrapropõe acima de 80% e recusa abaixo", () => {
    const pedida = pedidaSalarial(j, 3, 7);
    const ok = negociarContrato(j, pedida, 3, 2027, 7);
    expect(ok).toEqual({ tipo: "aceita", contrato: { ate: 2029, salario: pedida } });
    expect(negociarContrato(j, pedida * 0.85, 3, 2027, 7)).toEqual({ tipo: "contraproposta", pedida });
    expect(negociarContrato(j, pedida * 0.5, 3, 2027, 7).tipo).toBe("recusa");
  });
  it("folha usa o salário de contrato e lista quem termina", () => {
    const elenco = ATUAIS.slice(0, 5);
    const contratos = { [elenco[0].id]: { ate: 2026, salario: 999 } };
    const padrao = elenco.slice(1).reduce((s, x) => s + salarioMensal(x), 0);
    expect(folhaComContratos(elenco, contratos, 2026)).toBe(999 + padrao);
    expect(contratosTerminando(elenco, contratos, 2026, 2026).map((x) => x.id)).toContain(elenco[0].id);
  });
});

describe("caixa negativo", () => {
  it("cobra juros e tira pontos na quarta rodada seguida no vermelho", () => {
    expect(dividaDaRodada(100, 5, 2)).toEqual({ lancamentos: [], noVermelho: 0, perdePontos: false });
    const r1 = dividaDaRodada(-10000, 5, 0);
    expect(r1.lancamentos[0].valor).toBe(-200);
    expect(r1.noVermelho).toBe(1);
    expect(dividaDaRodada(-10000, 8, 3)).toMatchObject({ noVermelho: 0, perdePontos: true });
  });
});
