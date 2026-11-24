import { estiloEscudo } from "../data/clubes";
import { calcularTabela, chaveJogo, premioFinal, zona, type Temporada } from "../engine/campeonato";
import type { Time } from "../engine/types";

interface Props {
  meuTime: Time;
  times: Map<string, Time>;
  temporada: Temporada;
  onNovaTemporada: () => void;
}

const NOME_ZONA = {
  libertadores: "Libertadores",
  pre: "Pré-Libertadores",
  sula: "Sul-Americana",
  rebaixamento: "Rebaixamento",
};

export function TelaCampeonato({ meuTime, times, temporada, onNovaTemporada }: Props) {
  const ids = [...times.keys()];
  const nomes = new Map([...times.values()].map((t) => [t.id, t.nome]));
  const tabela = calcularTabela(temporada, ids, nomes);
  const minhaPos = tabela.findIndex((l) => l.id === meuTime.id) + 1;
  const fim = temporada.rodadaAtual >= temporada.rodadas.length;
  const disputadas = temporada.rodadas.filter((jogos, r) =>
    jogos.every((_, i) => temporada.placares[chaveJogo(r, i)]),
  ).length;
  const campeao = times.get(tabela[0].id)!;

  const meusJogos = temporada.rodadas.map((jogos, r) => {
    const i = jogos.findIndex(([m, v]) => m === meuTime.id || v === meuTime.id);
    const [m, v] = jogos[i];
    const casa = m === meuTime.id;
    const p = temporada.placares[chaveJogo(r, i)];
    const meus = p ? (casa ? p[0] : p[1]) : null;
    const deles = p ? (casa ? p[1] : p[0]) : null;
    const res = meus === null ? null : meus > deles! ? "V" : meus === deles ? "E" : "D";
    return { r, adv: times.get(casa ? v : m)!, casa, meus, deles, res };
  });

  return (
    <section className="tela">
      {fim && (
        <div className="fim-temporada">
          <div>
            <span className="rotulo">Fim do Brasileirão {temporada.ano}</span>
            <h2>
              {campeao.id === meuTime.id ? `${meuTime.nome} campeão!` : `${campeao.nome} é o campeão`}
            </h2>
            <p>
              Você terminou em <b>{minhaPos}º lugar</b>
              {zona(minhaPos) ? ` (${NOME_ZONA[zona(minhaPos)!]})` : ""} e recebeu{" "}
              <b>{premioFinal(minhaPos)} moedas</b> de premiação.
            </p>
          </div>
          <button className="botao primario" onClick={onNovaTemporada}>
            Começar temporada {temporada.ano + 1}
          </button>
        </div>
      )}

      <div className="campeonato">
        <div className="classificacao">
          <h2>
            Classificação <span className="suave">{disputadas} de {temporada.rodadas.length} rodadas</span>
          </h2>
          <div className="rolagem">
            <table className="tabela-classif">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="nome">Clube</th>
                  <th title="Pontos">P</th>
                  <th title="Jogos">J</th>
                  <th title="Vitórias">V</th>
                  <th title="Empates">E</th>
                  <th title="Derrotas">D</th>
                  <th className="col-extra" title="Gols pró">GP</th>
                  <th className="col-extra" title="Gols contra">GC</th>
                  <th title="Saldo de gols">SG</th>
                  <th className="col-extra">Últimos</th>
                </tr>
              </thead>
              <tbody>
                {tabela.map((l, i) => {
                  const t = times.get(l.id)!;
                  const z = zona(i + 1);
                  return (
                    <tr key={l.id} className={`${l.id === meuTime.id ? "meu" : ""} ${z ? `zona-${z}` : ""}`}>
                      <td className="pos-tab">{i + 1}</td>
                      <td className="nome">
                        <span className="escudo mini" style={estiloEscudo(t.cor)}>
                          {t.sigla}
                        </span>
                        {t.nome}
                      </td>
                      <td className="pts">{l.pts}</td>
                      <td>{l.j}</td>
                      <td>{l.v}</td>
                      <td>{l.e}</td>
                      <td>{l.d}</td>
                      <td className="col-extra">{l.gp}</td>
                      <td className="col-extra">{l.gc}</td>
                      <td>{l.sg > 0 ? `+${l.sg}` : l.sg}</td>
                      <td className="col-extra">
                        <span className="forma">
                        {l.forma.map((f, k) => (
                          <span key={k} className={`f f-${f}`} title={f === "V" ? "Vitória" : f === "E" ? "Empate" : "Derrota"}>
                            {f}
                          </span>
                        ))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="legenda-zonas">
            {(Object.keys(NOME_ZONA) as (keyof typeof NOME_ZONA)[]).map((z) => (
              <li key={z}>
                <i className={`zona-cor zona-${z}`} /> {NOME_ZONA[z]}
              </li>
            ))}
          </ul>
        </div>

        <div className="calendario">
          <h2>Seus jogos</h2>
          <ol>
            {meusJogos.map((j) => (
              <li key={j.r} className={j.r === temporada.rodadaAtual ? "proximo" : ""}>
                <span className="cal-rod">{j.r + 1}</span>
                <span className={`cal-mando ${j.casa ? "casa" : "fora"}`}>{j.casa ? "Casa" : "Fora"}</span>
                <span className="cal-adv">{j.adv.nome}</span>
                {j.res ? (
                  <span className={`cal-res f f-${j.res}`}>
                    {j.meus}–{j.deles}
                  </span>
                ) : (
                  <span className="cal-res suave">{j.r === temporada.rodadaAtual ? "Próximo" : ""}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
