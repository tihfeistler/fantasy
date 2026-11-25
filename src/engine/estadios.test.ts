import { describe, expect, it } from "vitest";
import clubesJson from "../../data/clubes.json";
import { fatorBilheteria, fatorCasa, publicoMedio, type Estadio } from "./estadios";
import { ESTADIOS, fatorDaCarta, IDENTIDADE_TESTE, problemaNaIdentidade, uniformesDoTimeProprio } from "./timeProprio";
import { PARAMS } from "./match";

const CLUBES = clubesJson as unknown as {
  id: string;
  cor: string;
  corSecundaria: string;
  estadio: Estadio;
  camisas: { modelo: string; cor: string; cor2: string }[];
  emblema: { forma: string };
}[];
const porId = new Map(CLUBES.map((c) => [c.id, c]));

describe("estádios dos clubes", () => {
  it("todo clube tem estádio, duas camisas e escudo", () => {
    for (const c of CLUBES) {
      expect(c.estadio.nome.length, c.id).toBeGreaterThan(2);
      expect(c.estadio.capacidade, c.id).toBeGreaterThanOrEqual(1000);
      for (const n of [c.estadio.atmosfera, c.estadio.qualidade]) expect(n, c.id).toBeGreaterThan(0);
      expect(c.camisas, c.id).toHaveLength(2);
      expect(c.camisas[0].cor, c.id).not.toBe(c.camisas[1].cor);
      expect(c.cor.toLowerCase(), c.id).not.toBe(c.corSecundaria.toLowerCase());
      expect(c.emblema.forma, c.id).toBeTruthy();
    }
  });

  it("La Bombonera tem a atmosfera máxima", () => {
    const max = Math.max(...CLUBES.map((c) => c.estadio.atmosfera));
    expect(porId.get("boca-juniors")!.estadio.atmosfera).toBe(max);
    expect(porId.get("boca-juniors")!.estadio.nome).toBe("La Bombonera");
  });

  it("bilheteria fica entre 0,8 e 1,3 e cresce com o estádio", () => {
    for (const c of CLUBES) {
      const f = fatorBilheteria(c.estadio);
      expect(f).toBeGreaterThanOrEqual(0.8);
      expect(f).toBeLessThanOrEqual(1.3);
    }
    expect(fatorBilheteria(porId.get("real-madrid")!.estadio)).toBe(1.3);
    expect(fatorBilheteria(porId.get("queen-s-park")!.estadio)).toBe(0.8);
    const base = { nome: "x", capacidade: 20000, atmosfera: 60, qualidade: 60 };
    expect(fatorBilheteria({ ...base, qualidade: 90 })).toBeGreaterThan(fatorBilheteria(base));
    expect(fatorBilheteria({ ...base, atmosfera: 90 })).toBeGreaterThan(fatorBilheteria(base));
    expect(publicoMedio({ ...base, atmosfera: 100 })).toBe(19000);
  });

  it("atmosfera 50 dá a vantagem padrão do mandante; a Bombonera, a maior", () => {
    expect(fatorCasa({ atmosfera: 50 })).toBe(PARAMS.vantagemMandante);
    expect(fatorCasa(porId.get("boca-juniors")!.estadio)).toBeCloseTo(1.099, 3);
  });
});

describe("cartas de estádio do time próprio", () => {
  it("carta melhor rende mais bilheteria e custa mais", () => {
    for (let i = 1; i < ESTADIOS.length; i++) {
      expect(fatorDaCarta(ESTADIOS[i])).toBeGreaterThan(fatorDaCarta(ESTADIOS[i - 1]));
      expect(ESTADIOS[i].custo).toBeGreaterThan(ESTADIOS[i - 1].custo);
    }
  });

  it("camisa reserva: padrão invertido e validação", () => {
    const sem = { ...IDENTIDADE_TESTE, camisaReserva: undefined };
    const [p, r] = uniformesDoTimeProprio(sem);
    expect(r).toEqual({ modelo: p.modelo, cor: p.cor2, cor2: p.cor });
    expect(problemaNaIdentidade(sem)).toBeNull();
    const ok = { ...IDENTIDADE_TESTE, camisaReserva: { modelo: "faixa-peito" as const, cor: "#000000", cor2: "#f2c500" } };
    expect(problemaNaIdentidade(ok)).toBeNull();
    expect(problemaNaIdentidade({ ...ok, camisaReserva: { ...ok.camisaReserva, cor: IDENTIDADE_TESTE.cor } })).toMatch(
      /reserva/,
    );
    expect(problemaNaIdentidade({ ...ok, camisaReserva: { ...ok.camisaReserva, cor2: "#000000" } })).toMatch(/reserva/);
  });
});
