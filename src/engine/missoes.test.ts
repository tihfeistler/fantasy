import { describe, expect, it } from "vitest";
import { chaveJogo, type Temporada } from "./campeonato";
import { missoesParaPagar, numerosDaTemporada, progressoDasMissoes, type ContextoMissoes } from "./missoes";

// Liga de 2 clubes: "eu" x "rival", ida e volta, repetida.
function temporada(placares: [number, number][], ano = 2026): Temporada {
  const rodadas = placares.map((_, r) => [r % 2 === 0 ? (["eu", "rival"] as [string, string]) : (["rival", "eu"] as [string, string])]);
  const t: Temporada = { ano, divisao: "A", seed: 1, rodadas, rodadaAtual: placares.length, placares: {} };
  placares.forEach((p, r) => (t.placares[chaveJogo(r, 0)] = p));
  return t;
}
const ctx = (t: Temporada, extra: Partial<ContextoMissoes> = {}): ContextoMissoes => ({
  temporada: t,
  meuTimeId: "eu",
  caixa: 100,
  extrato: [],
  ...extra,
});

describe("missões", () => {
  it("conta vitórias, gols, jogos sem sofrer gol, vitórias em casa e sequência", () => {
    // R1 casa 2x0, R2 fora (rival 0 x 1 eu), R3 casa 1x1, R4 fora (rival 3 x 0 eu), R5 casa 4x0
    const n = numerosDaTemporada(temporada([[2, 0], [0, 1], [1, 1], [3, 0], [4, 0]]), "eu");
    expect(n).toEqual({ vitorias: 3, gols: 8, semSofrer: 3, emCasa: 2, melhorSequencia: 2 });
  });
  it("paga cada missão da temporada uma vez por ano e as conquistas uma vez", () => {
    const vitorias = Array.from({ length: 6 }, (_, r): [number, number] => (r % 2 === 0 ? [1, 0] : [0, 1]));
    const t = temporada(vitorias);
    const c = ctx(t, { extrato: [{ rodada: 1, descricao: "x", valor: -10, tipo: "compra" }] });
    const pagar = missoesParaPagar(c, []).map((x) => x.chave);
    expect(pagar).toContain("2026:vitorias-5");
    expect(pagar).toContain("2026:sequencia-3");
    expect(pagar).toContain("2026:caixa-azul");
    expect(pagar).toContain("primeira-contratacao");
    expect(pagar).not.toContain("2026:vitorias-12");
    expect(missoesParaPagar(c, pagar)).toEqual([]);
    // Ano novo: as da temporada voltam a valer; a conquista não.
    const ano2 = missoesParaPagar({ ...c, temporada: temporada(vitorias, 2027) }, pagar).map((x) => x.chave);
    expect(ano2).toContain("2027:vitorias-5");
    expect(ano2).not.toContain("primeira-contratacao");
  });
  it("caixa positivo só conta no fim do campeonato", () => {
    const t = { ...temporada([[1, 0]]), rodadaAtual: 0 };
    expect(progressoDasMissoes(ctx(t))["caixa-azul"]).toBe(0);
    expect(progressoDasMissoes(ctx(temporada([[1, 0]]), { caixa: -5 }))["caixa-azul"]).toBe(0);
  });
  it("acesso quando a divisão atual é de nível acima da anterior", () => {
    const t = temporada([[1, 0]], 2027);
    const historico = [{ ano: 2026, posicao: 2, campeao: "x", divisao: "B" }];
    expect(progressoDasMissoes(ctx(t, { historico })).acesso).toBe(1);
    expect(progressoDasMissoes(ctx({ ...t, divisao: "B" }, { historico })).acesso).toBe(0);
  });
});
