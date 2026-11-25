import { describe, expect, it } from "vitest";
import atuaisJson from "../../data/atuais.json";
import clubesJson from "../../data/clubes.json";
import lendasJson from "../../data/jogadores.json";
import { criarRng } from "./rng";
import {
  CHANCES_DRAFT,
  GRUPOS,
  grupoDaEscolha,
  IDENTIDADE_TESTE,
  nacionalidadesDisponiveis,
  problemaNaIdentidade,
  raridadeDraft,
  sortearOpcoes,
  sortearRaridade,
  TOTAL_DRAFT,
  vagaDoTimeProprio,
} from "./timeProprio";
import type { Jogador } from "./types";

const ATUAIS = atuaisJson as Jogador[];
const LENDAS = lendasJson as Jogador[];

describe("time próprio", () => {
  it("draft tem 30 escolhas na ordem dos grupos", () => {
    expect(TOTAL_DRAFT).toBe(30);
    expect(GRUPOS.map((g) => g.vagas)).toEqual([2, 4, 4, 12, 8]);
    expect(grupoDaEscolha(0)!.id).toBe("gol");
    expect(grupoDaEscolha(2)!.id).toBe("lat");
    expect(grupoDaEscolha(10)!.id).toBe("mei");
    expect(grupoDaEscolha(29)!.id).toBe("ata");
    expect(grupoDaEscolha(30)).toBeNull();
  });

  it("chances somam 100% e o sorteio respeita as faixas", () => {
    expect(Object.values(CHANCES_DRAFT).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(sortearRaridade(0)).toBe("lenda");
    expect(sortearRaridade(0.005)).toBe("especial");
    expect(sortearRaridade(0.1)).toBe("ouro");
    expect(sortearRaridade(0.5)).toBe("prata");
    expect(sortearRaridade(0.99)).toBe("bronze");
  });

  it("sorteia 5 jogadores diferentes da posição e da nacionalidade", () => {
    const rng = criarRng(42);
    const ops = sortearOpcoes(ATUAIS, LENDAS, "PD", "BRA", new Set(), rng);
    expect(ops).toHaveLength(5);
    expect(new Set(ops.map((j) => j.id)).size).toBe(5);
    for (const j of ops) {
      expect(j.posicao).toBe("ATA");
      expect(j.nacionalidade).toBe("BRA");
    }
  });

  it("não repete quem já foi escolhido", () => {
    const rng = criarRng(7);
    const goleirosBra = ATUAIS.filter((j) => j.posicao === "GOL" && j.nacionalidade === "BRA");
    const fora = new Set(goleirosBra.slice(0, goleirosBra.length - 3).map((j) => j.id));
    const ops = sortearOpcoes(ATUAIS, [], "GOL", "BRA", fora, rng);
    expect(ops).toHaveLength(3);
    for (const j of ops) expect(fora.has(j.id)).toBe(false);
  });

  it("na média segue as chances (prata é a mais comum)", () => {
    const rng = criarRng(1);
    const cont: Record<string, number> = {};
    for (let i = 0; i < 400; i++)
      for (const j of sortearOpcoes(ATUAIS, LENDAS, "ZAG", "BRA", new Set(), rng))
        cont[raridadeDraft(j)] = (cont[raridadeDraft(j)] ?? 0) + 1;
    expect(cont.prata).toBeGreaterThan(cont.bronze);
    expect(cont.bronze).toBeGreaterThan(cont.ouro);
    expect((cont.ouro ?? 0) / 2000).toBeGreaterThan(0.1);
  });

  it("nacionalidades oferecidas têm pelo menos 5 jogadores", () => {
    const n = nacionalidadesDisponiveis(ATUAIS, "GOL", new Set());
    expect(n[0].nac).toBe("BRA");
    expect(n.every((x) => x.quantidade >= 5)).toBe(true);
  });

  it("vaga é o clube mais fraco da divisão", () => {
    const clubes = clubesJson as { id: string; liga: string; nivel: number }[];
    const vaga = vagaDoTimeProprio(clubes, "brasileirao-d");
    const serieD = clubes.filter((c) => c.liga === "brasileirao-d");
    expect(serieD.some((c) => c.id === vaga)).toBe(true);
    expect(Math.min(...serieD.map((c) => c.nivel))).toBe(clubes.find((c) => c.id === vaga)!.nivel);
  });

  it("confere a identidade", () => {
    expect(problemaNaIdentidade(IDENTIDADE_TESTE)).toBeNull();
    expect(problemaNaIdentidade({ ...IDENTIDADE_TESTE, sigla: "AB" })).toMatch(/sigla/);
    expect(problemaNaIdentidade({ ...IDENTIDADE_TESTE, corSecundaria: IDENTIDADE_TESTE.cor })).toMatch(/cores/);
    expect(problemaNaIdentidade({ ...IDENTIDADE_TESTE, estadio: "maracana" })).toMatch(/estádio/);
    expect(problemaNaIdentidade({ ...IDENTIDADE_TESTE, divisao: "ING" })).toMatch(/divisão/);
  });
});
