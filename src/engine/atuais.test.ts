import { describe, expect, it } from "vitest";
import { DIVISOES_INICIAIS, montarTimesAtuais } from "../data/clubes";
import { LIGAS } from "./ligas";
import { escalar } from "./ratings";
import { simularPartida } from "./match";

const times = montarTimesAtuais();

describe("elencos atuais", () => {
  it("tem as 9 ligas (Séries A e B + 7 estrangeiras) com elenco para escalar 11 com goleiro", () => {
    const tamanho = (d: string) => times.filter((t) => DIVISOES_INICIAIS[t.id] === d).length;
    expect(LIGAS.map((l) => [l.id, tamanho(l.id)])).toEqual([
      ["A", 20], ["B", 20], ["ING", 20], ["ESP", 20], ["ITA", 20], ["ALE", 18], ["FRA", 18], ["POR", 18], ["ARG", 30],
    ]);
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

  it("os grandes da Europa são mais fortes que os do Brasil", () => {
    const forca = (id: string) => {
      const v = escalar(times.find((t) => t.id === id)!);
      return v.reduce((s, x) => s + x.jogador.geral, 0) / v.length;
    };
    expect(forca("real-madrid")).toBeGreaterThan(forca("flamengo"));
    expect(forca("flamengo")).toBeGreaterThan(forca("aldosivi"));
  });
});
