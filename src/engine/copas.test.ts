import { describe, expect, it } from "vitest";
import { CLUBES, DIVISOES_INICIAIS, montarTimesAtuais, NIVEL } from "../data/clubes";
import {
  avancarCopas,
  campanha,
  classificadosContinental,
  CONTINENTAIS,
  copaPendente,
  criarCopasDaTemporada,
  datasDasFases,
  disputaDePenaltis,
  estaVivo,
  faseAtual,
  jogoDoClube,
  premioDaFase,
  registrarJogo,
  totalDeFases,
  vencedorDoJogo,
  concluirFase,
  nomesDasFases,
} from "./copas";

const times = new Map(montarTimesAtuais().map((t) => [t.id, t]));
const dados = (minhaDivisao: string, extra = {}) => ({
  ano: 2026,
  seed: 1234,
  minhaDivisao,
  divisoes: DIVISOES_INICIAIS,
  forca: NIVEL,
  rodadas: 38,
  ...extra,
});

describe("formato", () => {
  it("conta as fases com e sem preliminar", () => {
    expect(totalDeFases(32)).toBe(5);
    expect(totalDeFases(9)).toBe(4);
    expect(totalDeFases(74)).toBe(7);
  });
  it("espalha as datas pela temporada, antes da última rodada", () => {
    const d = datasDasFases(7, 38);
    expect(d).toHaveLength(7);
    expect(Math.max(...d)).toBeLessThan(38);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });
  it("pênaltis nunca empatam", () => {
    for (let s = 0; s < 200; s++) {
      const [a, b] = disputaDePenaltis(s);
      expect(a).not.toBe(b);
    }
  });
});

describe("copas da temporada", () => {
  const [nacional, liberta] = criarCopasDaTemporada(dados("A"));
  it("Copa do Brasil com todos os clubes do país e preliminar para os mais fracos", () => {
    expect(nacional.nome).toBe("Copa do Brasil");
    const brasileiros = CLUBES.filter((c) => c.liga.startsWith("brasileirao")).length;
    expect(nacional.clubes).toHaveLength(brasileiros);
    const f = faseAtual(nacional)!;
    expect(f.nome).toBe("Fase preliminar");
    // Os da Série A entram direto.
    const serieA = CLUBES.filter((c) => c.liga === "brasileirao-a").map((c) => c.id);
    for (const id of serieA) expect(f.folgas).toContain(id);
    expect(f.folgas.length + f.jogos.length).toBe(64);
  });
  it("Libertadores com Brasil (6) e Argentina (3)", () => {
    expect(liberta.nome).toBe("Copa Libertadores");
    expect(liberta.clubes).toHaveLength(9);
    const paises = liberta.clubes.map((id) => DIVISOES_INICIAIS[id]);
    expect(paises.filter((d) => d === "A")).toHaveLength(6);
    expect(paises.filter((d) => d === "ARG")).toHaveLength(3);
  });
  it("Champions com 32 clubes europeus e classificação pela tabela do país do técnico", () => {
    const champions = CONTINENTAIS.find((c) => c.id === "champions")!;
    const tabelaIng = CLUBES.filter((c) => c.liga === "premier-league").map((c) => c.id).reverse();
    const ids = classificadosContinental(champions, dados("ING", { tabelas: { ING: tabelaIng } }));
    expect(ids).toHaveLength(32);
    for (const id of tabelaIng.slice(0, 4)) expect(ids).toContain(id);
  });
  it("Arábia Saudita só tem a copa nacional", () => {
    expect(criarCopasDaTemporada(dados("KSA")).map((c) => c.id)).toEqual(["copa-KSA"]);
  });
});

describe("andamento", () => {
  it("joga a copa inteira até o campeão, esperando o jogo do técnico", () => {
    let [c] = criarCopasDaTemporada(dados("A"));
    const meu = "flamengo";
    let rodada = 0;
    let jogosDoTecnico = 0;
    while (!c.campeao && rodada <= 38) {
      [c] = avancarCopas([c], rodada, times, meu);
      const pend = copaPendente([c], rodada, meu);
      if (pend) {
        const i = jogoDoClube(c, meu);
        const j = faseAtual(c)!.jogos[i];
        // O técnico sempre vence por 1 x 0.
        c = registrarJogo(c, i, j.mandante === meu ? 1 : 0, j.mandante === meu ? 0 : 1);
        expect(vencedorDoJogo(faseAtual(c)!.jogos[i])).toBe(meu);
        c = concluirFase(c, times);
        jogosDoTecnico++;
        continue;
      }
      rodada++;
    }
    expect(c.campeao).toBe(meu);
    expect(jogosDoTecnico).toBe(6); // Série A não joga a preliminar
    expect(campanha(c, meu)?.texto).toBe("Campeão");
    expect(estaVivo(c, meu)).toBe(true);
  });
  it("prêmio dobra a cada fase e a final paga o título", () => {
    const [c] = criarCopasDaTemporada(dados("A"));
    expect(premioDaFase(c, 0).valor).toBe(300);
    expect(premioDaFase(c, 1).valor).toBe(600);
    const final = premioDaFase(c, 6);
    expect(final.final).toBe(true);
    expect(final.valor).toBe(300 * 64 * 2);
  });
});

describe("nomes", () => {
  it("lista as fases com preliminar", () => {
    expect(nomesDasFases(74)).toEqual([
      "Fase preliminar", "Fase de 64", "Fase de 32", "Oitavas de final", "Quartas de final", "Semifinal", "Final",
    ]);
    expect(nomesDasFases(32)).toHaveLength(5);
  });
  it("clube com folga entra direto na fase seguinte", () => {
    const [c] = criarCopasDaTemporada(dados("A"));
    expect(campanha(c, "flamengo")?.texto).toBe("Entra direto na fase de 64");
  });
});
