import { describe, expect, it } from "vitest";
import { TIMES_EXEMPLO } from "../data/exemplo";
import { PartidaAoVivo } from "./match";
import { concluirJogo, type JogoEmAndamento } from "./jogoEmAndamento";

const [a, b] = TIMES_EXEMPLO;

describe("jogo em andamento", () => {
  it("sair no meio dá o mesmo placar de ficar na tela sem mexer mais (sem decisões)", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = new PartidaAoVivo(a, b, seed, [a.id]);
      while (!p.encerrada) p.avancar();
      const j: JogoEmAndamento = { tipo: "liga", ref: "x", mandante: a, visitante: b, seed, meuTimeId: a.id, decisoes: [] };
      expect(concluirJogo(j)).toEqual(p.resultado());
    }
  });

  it("as decisões tomadas antes de sair valem; e o time continua sem as trocas automáticas da IA", () => {
    const p = new PartidaAoVivo(a, b, 77, [a.id]);
    while (p.minuto < 30) p.avancar();
    p.decidir({ timeId: a.id, tipo: "tatica", tatica: "defensiva" });
    while (p.minuto < 55) p.avancar();
    const e = p.estado(a.id);
    p.decidir({ timeId: a.id, tipo: "sub", sai: e.emCampo[3].jogador.id, entra: e.banco[0].id });
    // O técnico "fecha o navegador" aqui; o que já foi salvo é a seed, os times e as decisões.
    const salvo: JogoEmAndamento = JSON.parse(
      JSON.stringify({ tipo: "liga", ref: "x", mandante: a, visitante: b, seed: 77, meuTimeId: a.id, decisoes: p.decisoes }),
    );
    while (!p.encerrada) p.avancar();
    expect(concluirJogo(salvo)).toEqual(p.resultado());
  });
});
