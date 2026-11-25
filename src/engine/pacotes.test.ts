import { describe, expect, it } from "vitest";
import { TIMES_EXEMPLO } from "../data/exemplo";
import { abrirPacote, CHANCES, faixa, valorDeVenda, VALOR_VENDA } from "./pacotes";
import { criarRng } from "./rng";

const lendas = TIMES_EXEMPLO.flatMap((t) => t.elenco);

describe("abrirPacote", () => {
  it("dá 5 cartas e é determinístico pela seed", () => {
    expect(abrirPacote(lendas, criarRng(1))).toHaveLength(5);
    expect(abrirPacote(lendas, criarRng(9))).toEqual(abrirPacote(lendas, criarRng(9)));
  });

  it("respeita mais ou menos as chances de cada faixa", () => {
    const rng = criarRng(3);
    const cont = { comum: 0, rara: 0, icone: 0 };
    for (let i = 0; i < 2000; i++) for (const j of abrirPacote(lendas, rng)) cont[faixa(j)]++;
    const total = cont.comum + cont.rara + cont.icone;
    expect(cont.icone / total).toBeGreaterThan(CHANCES.icone * 0.6);
    expect(cont.icone / total).toBeLessThan(CHANCES.icone * 1.6);
  });
});

describe("limite de lendas em campo", () => {
  it("a escalação automática usa no máximo maxLendas clássicos", async () => {
    const { escalar } = await import("./ratings");
    const { montarTimesAtuais } = await import("../data/clubes");
    const { ehLenda } = await import("./types");
    const base = montarTimesAtuais()[0];
    // Seis lendas fortes de linha, mais fortes que todo o elenco atual.
    const lendas = ["ZAG", "LAT", "VOL", "MEI", "ATA", "ATA"].map((posicao, i) => ({
      ...base.elenco.find((j) => j.posicao === posicao)!,
      id: `lenda-${i}`,
      tipo: "classico" as const,
      geral: 99,
    }));
    const time = { ...base, elenco: [...base.elenco, ...lendas] };
    const vagas = escalar(time);
    expect(vagas).toHaveLength(11);
    expect(vagas.filter((v) => ehLenda(v.jogador))).toHaveLength(3);
    expect(escalar({ ...time, maxLendas: undefined }).filter((v) => ehLenda(v.jogador)).length).toBeGreaterThan(3);
  });
});

describe("valor de venda das cartas", () => {
  it("cai 15% por cópia repetida, até a metade", () => {
    const j = TIMES_EXEMPLO[0].elenco[0];
    const cheio = VALOR_VENDA[faixa(j)];
    expect(valorDeVenda(j, 1)).toBe(cheio);
    expect(valorDeVenda(j, 2)).toBeLessThan(cheio);
    expect(valorDeVenda(j, 3)).toBeLessThan(valorDeVenda(j, 2));
    expect(valorDeVenda(j, 20)).toBe(cheio / 2);
  });
});
