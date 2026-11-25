import { describe, expect, it } from "vitest";
import { coresDosTimes, posicoesBase } from "./CampoPartida";

describe("campo 2D", () => {
  it("põe cada vaga da formação no seu setor, dentro do campo", () => {
    const b = posicoesBase(["GOL", "ZAG", "ZAG", "LAT", "LAT", "VOL", "VOL", "MEI", "MEI", "ATA", "ATA"]);
    expect(b).toHaveLength(11);
    expect(b[0]).toEqual({ ax: 0.035, ay: 0.5 });
    for (const p of b) {
      expect(p.ay).toBeGreaterThan(0);
      expect(p.ay).toBeLessThan(1);
    }
    // Laterais abertos, zagueiros por dentro.
    expect(b[3].ay).toBeLessThan(b[1].ay);
    expect(b[4].ay).toBeGreaterThan(b[2].ay);
  });

  it("troca camisa verde (some no gramado) e cores parecidas", () => {
    const [m, v] = coresDosTimes("#006437", "#0b3d1f");
    expect(m).not.toBe("#006437");
    expect(v).not.toBe(m);
    expect(coresDosTimes("#d62828", "#1d4ed8")).toEqual(["#d62828", "#1d4ed8"]);
    const [a, c] = coresDosTimes("#ffffff", "#fafafa");
    expect(a).toBe("#ffffff");
    expect(c).not.toBe("#fafafa");
  });
});
