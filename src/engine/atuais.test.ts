import { describe, expect, it } from "vitest";
import { montarTimesAtuais } from "../data/clubes";
import { escalar } from "./ratings";
import { simularPartida } from "./match";

const times = montarTimesAtuais();

describe("elencos atuais", () => {
  it("tem 40 clubes (Séries A e B) com elenco para escalar 11 com goleiro", () => {
    expect(times).toHaveLength(40);
    for (const t of times) {
      const v = escalar(t);
      expect(v, t.id).toHaveLength(11);
      expect(v.filter((x) => x.pos === "GOL" && x.jogador.posicao === "GOL"), t.id).toHaveLength(1);
    }
  });

  it("ids de jogador são únicos", () => {
    const ids = times.flatMap((t) => t.elenco.map((j) => j.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("favorito vence mais que o azarão", () => {
    const fla = times.find((t) => t.id === "flamengo")!;
    const cha = times.find((t) => t.id === "chapecoense")!;
    let v = 0, d = 0;
    for (let s = 1; s <= 1000; s++) {
      const r = simularPartida(fla, cha, s);
      if (r.golsMandante > r.golsVisitante) v++;
      else if (r.golsMandante < r.golsVisitante) d++;
    }
    expect(v).toBeGreaterThan(d * 3);
  });
});
