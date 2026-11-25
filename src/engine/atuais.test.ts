import { describe, expect, it } from "vitest";
import { DIVISOES_INICIAIS, montarTimesAtuais } from "../data/clubes";
import { LIGAS } from "./ligas";
import { escalar } from "./ratings";
import { simularPartida } from "./match";

const times = montarTimesAtuais();

describe("elencos atuais", () => {
  it("todas as ligas têm número par de clubes, com elenco para escalar 11 com goleiro", () => {
    const tamanho = (d: string) => times.filter((t) => DIVISOES_INICIAIS[t.id] === d).length;
    expect(LIGAS).toHaveLength(36);
    for (const l of LIGAS) {
      expect(tamanho(l.id), l.id).toBeGreaterThanOrEqual(10);
      expect(tamanho(l.id) % 2, l.id).toBe(0);
    }
    expect(["A", "B", "ING", "ESP", "ITA"].map(tamanho)).toEqual([20, 20, 20, 20, 20]);
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
