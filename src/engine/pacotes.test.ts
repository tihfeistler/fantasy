import { describe, expect, it } from "vitest";
import { TIMES_EXEMPLO } from "../data/exemplo";
import { abrirPacote, CHANCES, faixa } from "./pacotes";
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
