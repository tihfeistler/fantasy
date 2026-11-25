import { useState } from "react";
import { estiloEscudo } from "../data/clubes";
import {
  calcularTabela,
  chaveJogo,
  divisaoDe,
  idsDaTemporada,
  nomeDaDivisao,
  nomeDaZona,
  premioFinal,
  trocarDivisoes,
  zona,
  type Temporada,
} from "../engine/campeonato";
import { ligaDe } from "../engine/ligas";
import type { Jogador, Time } from "../engine/types";

interface Props {
  meuTime: Time;
  times: Map<string, Time>;
  temporada: Temporada;
  /** As outras divisões do país, simuladas junto. */
  outrasTemporadas: Temporada[];
  /** Quem sai de graça no fim desta temporada (contrato terminando). */
  saidas: Jogador[];
  onRenovar: () => void;
  onNovaTemporada: () => void;
  /** Copa com jogo do técnico ainda por disputar (a temporada só vira depois). */
  copaPendente?: string;
}


export function TelaCampeonato(props: Props) {
  const { meuTime, times, temporada, outrasTemporadas, saidas, onRenovar, onNovaTemporada } = props;
  const [verDiv, setVerDiv] = useState<string | null>(null);
  const nomes = new Map([...times.values()].map((t) => [t.id, t.nome]));
  const minhaDiv = divisaoDe(temporada);
  const tabela = calcularTabela(temporada, idsDaTemporada(temporada), nomes);
  const minhaPos = tabela.findIndex((l) => l.id === meuTime.id) + 1;
  const fim = temporada.rodadaAtual >= temporada.rodadas.length;
  // Tabela mostrada: a sua divisão ou a outra.
  const todas = [temporada, ...outrasTemporadas].sort(
    (a, b) => ligaDe(divisaoDe(a)).nivel - ligaDe(divisaoDe(b)).nivel,
  );
  const vista = todas.find((t) => divisaoDe(t) === verDiv) ?? temporada;
  const vistaDiv = divisaoDe(vista);
  const tabelaVista = vista === temporada ? tabela : calcularTabela(vista, idsDaTemporada(vista), nomes);
  const disputadasVista = vista.rodadas.filter((jogos, r) => jogos.every((_, i) => vista.placares[chaveJogo(r, i)])).length;
  // Fim das duas divisões: quem sobe e quem cai.
  const fimTodas = todas.every((t) => t.rodadaAtual >= t.rodadas.length);
  const novaDiv = fim && fimTodas ? (trocarDivisoes(...todas)[meuTime.id] ?? minhaDiv) : minhaDiv;
  const subiu = ligaDe(novaDiv).nivel < ligaDe(minhaDiv).nivel;
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
            <span className="rotulo">Fim da {nomeDaDivisao(minhaDiv)} {temporada.ano}</span>
            <h2>
              {campeao.id === meuTime.id ? `${meuTime.nome} campeão!` : `${campeao.nome} é o campeão`}
            </h2>
            <p>
              Você terminou a {nomeDaDivisao(minhaDiv)} em <b>{minhaPos}º lugar</b>
              {nomeDaZona(minhaPos, minhaDiv, tabela.length) ? ` (${nomeDaZona(minhaPos, minhaDiv, tabela.length)})` : ""} e recebeu{" "}
              <b>{premioFinal(minhaPos, minhaDiv, tabela.length)} moedas</b> de premiação.
            </p>
            {novaDiv !== minhaDiv && (
              <p className={subiu ? "acesso" : "queda"}>
                {subiu
                  ? `Acesso! Em ${temporada.ano + 1} o ${meuTime.nome} joga a ${nomeDaDivisao(novaDiv)}, e a receita de TV dobra.`
                  : `Rebaixado. Em ${temporada.ano + 1} o ${meuTime.nome} joga a ${nomeDaDivisao(novaDiv)}, com metade da receita de TV.`}
              </p>
            )}
            {saidas.length > 0 && (
              <p className="saidas">
                <b>
                  {saidas.length} {saidas.length > 1 ? "jogadores saem" : "jogador sai"} de graça
                </b>{" "}
                quando a temporada {temporada.ano + 1} começar, porque o contrato termina em {temporada.ano}:{" "}
                {saidas.map((j) => j.nome).join(", ")}.{" "}
                <button className="link-nome" onClick={onRenovar}>
                  Renovar contratos
                </button>
              </p>
            )}
          </div>
          <button className="botao primario" onClick={onNovaTemporada}>
            {props.copaPendente ? `Jogar a ${props.copaPendente}` : `Começar temporada ${temporada.ano + 1}`}
          </button>
        </div>
      )}

      <div className="campeonato">
        <div className="classificacao">
          <h2>
            {nomeDaDivisao(vistaDiv)}{" "}
            <span className="suave">
              {disputadasVista} de {vista.rodadas.length} rodadas
            </span>
          </h2>
          {todas.length > 1 && (
            <div className="alternar" role="group" aria-label="Divisão">
              {todas.map((t) => {
                const d = divisaoDe(t);
                return (
                  <button key={d} className={d === vistaDiv ? "ativo" : ""} onClick={() => setVerDiv(d)}>
                    {nomeDaDivisao(d)}
                    {d === minhaDiv ? " (sua)" : ""}
                  </button>
                );
              })}
            </div>
          )}
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
                {tabelaVista.map((l, i) => {
                  const t = times.get(l.id)!;
                  const z = zona(i + 1, vistaDiv, tabelaVista.length);
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
            {ligaDe(vistaDiv).zonas.map((z) => (
              <li key={z.nome}>
                <i className={`zona-cor zona-${z.classe}`} /> {z.nome}
              </li>
            ))}
            {!ligaDe(vistaDiv).vagas && ligaDe(vistaDiv).nivel === 1 && (
              <li className="suave">Ninguém cai: a segunda divisão deste país não está no jogo.</li>
            )}
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
