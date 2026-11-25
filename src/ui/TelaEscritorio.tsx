import { estiloEscudo } from "../data/clubes";
import { chaveJogo, divisaoDe, nomeDaDivisao, zona, type LinhaTabela, type Temporada } from "../engine/campeonato";
import { formatarDinheiro, type Financas } from "../engine/mercado";
import { escalar } from "../engine/ratings";
import { ehLenda, type Time } from "../engine/types";
import { Icone, type NomeIcone } from "./Icones";

export type AbaCarreira = "escritorio" | "elenco" | "partida" | "campeonato" | "copas" | "mercado" | "financas";

interface Props {
  meuTime: Time;
  times: Map<string, Time>;
  temporada: Temporada;
  tabela: LinhaTabela[];
  financas: Financas;
  folha: number;
  noVermelho: number;
  /** Jogadores com contrato terminando nesta temporada. */
  terminando: number;
  propostasCartas: number;
  noEstoque: number;
  onIr: (aba: AbaCarreira) => void;
  onContratos: () => void;
  onColecao: () => void;
  /** Copa com jogo do técnico marcado antes da próxima rodada. */
  copaPendente?: string;
}

interface Aviso {
  icone: NomeIcone;
  texto: React.ReactNode;
  tipo?: "alerta" | "bom";
  acao?: { rotulo: string; onClick: () => void };
}

/** Escritório do técnico: o resumo da carreira e o que pede atenção. */
export function TelaEscritorio(p: Props) {
  const { meuTime, times, temporada: t, tabela } = p;
  const div = divisaoDe(t);
  const nomeDiv = nomeDaDivisao(div);
  const fim = t.rodadaAtual >= t.rodadas.length;
  const posicao = tabela.findIndex((l) => l.id === meuTime.id) + 1;
  const minha = tabela[posicao - 1];

  // Próximo jogo e último resultado.
  const jogo = fim ? null : t.rodadas[t.rodadaAtual].find(([m, v]) => m === meuTime.id || v === meuTime.id);
  const casa = jogo?.[0] === meuTime.id;
  const adv = jogo ? times.get(casa ? jogo[1] : jogo[0]) : null;
  let ultimo: { adv: Time; meus: number; deles: number; rodada: number } | null = null;
  for (let r = Math.min(t.rodadaAtual, t.rodadas.length - 1); r >= 0 && !ultimo; r--) {
    const i = t.rodadas[r].findIndex(([m, v]) => m === meuTime.id || v === meuTime.id);
    const pl = t.placares[chaveJogo(r, i)];
    if (!pl) continue;
    const [m, v] = t.rodadas[r][i];
    const emCasa = m === meuTime.id;
    ultimo = { adv: times.get(emCasa ? v : m)!, meus: emCasa ? pl[0] : pl[1], deles: emCasa ? pl[1] : pl[0], rodada: r + 1 };
  }

  // Força: média dos titulares (escalação salva ou automática).
  const onze = escalar(meuTime);
  const forca = Math.round(onze.reduce((s, x) => s + x.jogador.geral, 0) / Math.max(1, onze.length));
  const forcaAdv = adv ? Math.round(escalar(adv).reduce((s, x) => s + x.jogador.geral, 0) / 11) : 0;
  const destaques = [...meuTime.elenco].sort((a, b) => b.geral - a.geral).slice(0, 3);

  // Tabela resumida: 5 linhas em volta do seu clube.
  const ini = Math.max(0, Math.min(tabela.length - 5, posicao - 3));
  const trecho = tabela.slice(ini, ini + 5);

  const avisos: Aviso[] = [];
  if (p.copaPendente)
    avisos.push({
      icone: "copa",
      tipo: "bom",
      texto: <>Jogo da {p.copaPendente} nesta semana, antes da próxima rodada da liga.</>,
      acao: { rotulo: "Jogar", onClick: () => p.onIr("partida") },
    });
  if (fim)
    avisos.push({
      icone: "campeonato",
      tipo: "bom",
      texto: <>A {nomeDiv} {t.ano} acabou. Veja a tabela final e comece a próxima temporada.</>,
      acao: { rotulo: "Ver tabela", onClick: () => p.onIr("campeonato") },
    });
  if (p.financas.caixa < 0)
    avisos.push({
      icone: "alerta",
      tipo: "alerta",
      texto: (
        <>
          Caixa negativo há {p.noVermelho} rodada{p.noVermelho === 1 ? "" : "s"}. Na 4ª seguida, o clube perde 3 pontos.
        </>
      ),
      acao: { rotulo: "Vender jogadores", onClick: () => p.onIr("mercado") },
    });
  if (p.terminando > 0)
    avisos.push({
      icone: "elenco",
      tipo: "alerta",
      texto: (
        <>
          {p.terminando} contrato{p.terminando > 1 ? "s terminam" : " termina"} em {t.ano}. Sem renovação, o jogador sai
          de graça.
        </>
      ),
      acao: { rotulo: "Contratos", onClick: p.onContratos },
    });
  if (p.propostasCartas > 0)
    avisos.push({
      icone: "colecao",
      texto: (
        <>
          {p.propostasCartas} proposta{p.propostasCartas > 1 ? "s" : ""} por cartas suas no mercado de lendas.
        </>
      ),
      acao: { rotulo: "Ver", onClick: p.onColecao },
    });
  if (p.noEstoque > 0)
    avisos.push({
      icone: "estoque",
      texto: (
        <>
          {p.noEstoque} lenda{p.noEstoque > 1 ? "s" : ""} no estoque. Leve para o elenco e escale até 3 em campo.
        </>
      ),
      acao: { rotulo: "Estoque", onClick: p.onColecao },
    });
  if (ultimo)
    avisos.push({
      icone: "noticia",
      texto: (
        <>
          {ultimo.meus > ultimo.deles ? "Vitória" : ultimo.meus === ultimo.deles ? "Empate" : "Derrota"} por {ultimo.meus} a{" "}
          {ultimo.deles} contra o {ultimo.adv.nome} na rodada {ultimo.rodada}.
        </>
      ),
    });
  if (tabela[0] && tabela[0].j > 0)
    avisos.push({
      icone: "noticia",
      texto:
        tabela[0].id === meuTime.id ? (
          <>Seu time lidera a {nomeDiv} com {tabela[0].pts} pontos.</>
        ) : (
          <>
            {times.get(tabela[0].id)!.nome} lidera a {nomeDiv} com {tabela[0].pts} pontos, {tabela[0].pts - minha.pts} à sua
            frente.
          </>
        ),
    });

  return (
    <section className="tela escritorio">
      <div className="esc-cabeca">
        <div>
          <span className="rotulo">
            Escritório · {nomeDiv} {t.ano}
          </span>
          <h1>{fim ? "Fim de temporada" : `Rodada ${t.rodadaAtual + 1} de ${t.rodadas.length}`}</h1>
        </div>
      </div>

      <div className="esc-grade">
        <article className="esc-cartao esc-jogo">
          <h2>Próximo jogo</h2>
          {jogo && adv ? (
            <>
              <div className="confronto">
                <Lado time={casa ? meuTime : adv} forca={casa ? forca : forcaAdv} />
                <span className="versus">×</span>
                <Lado time={casa ? adv : meuTime} forca={casa ? forcaAdv : forca} />
              </div>
              <p className="suave centro">
                {casa ? "Em casa, com bilheteria" : "Fora de casa"} · força dos titulares
              </p>
              <button className="botao primario largo" onClick={() => p.onIr("partida")}>
                Ir para a partida
              </button>
            </>
          ) : (
            <>
              <p className="suave">Sem jogos até a próxima temporada.</p>
              <button className="botao primario largo" onClick={() => p.onIr("campeonato")}>
                Ver tabela final
              </button>
            </>
          )}
        </article>

        <article className="esc-cartao esc-tabela">
          <h2>
            {nomeDiv}
            <button className="link-nome" onClick={() => p.onIr("campeonato")}>
              Tabela completa
            </button>
          </h2>
          <ol className="mini-tabela">
            {trecho.map((l) => {
              const pos = tabela.indexOf(l) + 1;
              const z = zona(pos, div, tabela.length);
              const time = times.get(l.id)!;
              return (
                <li key={l.id} className={`${l.id === meuTime.id ? "meu" : ""} ${z ? `zona-${z}` : ""}`}>
                  <span className="pos-tab">{pos}</span>
                  <span className="escudo mini" style={estiloEscudo(time.cor)}>
                    {time.sigla}
                  </span>
                  <span className="mt-nome">{time.nome}</span>
                  <span className="mt-j suave">{l.j} J</span>
                  <b>{l.pts}</b>
                </li>
              );
            })}
          </ol>
          {minha && minha.forma.length > 0 && (
            <div className="esc-forma">
              <span className="rotulo">Últimos jogos</span>
              <span className="forma">
                {minha.forma.map((f, k) => (
                  <span key={k} className={`f f-${f}`}>
                    {f}
                  </span>
                ))}
              </span>
            </div>
          )}
        </article>

        <article className="esc-cartao esc-financas">
          <h2>
            Finanças
            <button className="link-nome" onClick={() => p.onIr("financas")}>
              Detalhes
            </button>
          </h2>
          <dl className="numeros">
            <div>
              <dt>Caixa</dt>
              <dd className={p.financas.caixa < 0 ? "baixa" : "alta"}>{formatarDinheiro(p.financas.caixa)}</dd>
            </div>
            <div>
              <dt>Folha mensal</dt>
              <dd>{formatarDinheiro(p.folha)}</dd>
            </div>
            <div>
              <dt>TV por rodada</dt>
              <dd>{formatarDinheiro(p.financas.receitaPorRodada)}</dd>
            </div>
          </dl>
        </article>

        <article className="esc-cartao esc-avisos">
          <h2>Caixa de entrada</h2>
          {avisos.length ? (
            <ul className="avisos">
              {avisos.map((a, i) => (
                <li key={i} className={a.tipo ?? ""}>
                  <span className="av-icone">
                    <Icone nome={a.icone} />
                  </span>
                  <span className="av-texto">{a.texto}</span>
                  {a.acao && (
                    <button className="botao discreto" onClick={a.acao.onClick}>
                      {a.acao.rotulo}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="suave">Nada novo por aqui. Bom trabalho, professor.</p>
          )}
        </article>

        <article className="esc-cartao esc-elenco">
          <h2>
            Elenco
            <button className="link-nome" onClick={() => p.onIr("elenco")}>
              Escalação
            </button>
          </h2>
          <dl className="numeros">
            <div>
              <dt>Força</dt>
              <dd>{forca}</dd>
            </div>
            <div>
              <dt>Jogadores</dt>
              <dd>{meuTime.elenco.filter((j) => !ehLenda(j)).length}</dd>
            </div>
            <div>
              <dt>Lendas</dt>
              <dd>{meuTime.elenco.filter(ehLenda).length}</dd>
            </div>
          </dl>
          <ul className="destaques">
            {destaques.map((j) => (
              <li key={j.id}>
                <b className="ml-geral">{j.geral}</b>
                <span>{j.nome}</span>
                <span className="suave">{j.posicao}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function Lado({ time, forca }: { time: Time; forca: number }) {
  return (
    <div className="lado">
      <span className="escudo grande" style={estiloEscudo(time.cor)}>
        {time.sigla}
      </span>
      <b>{time.nome}</b>
      <span className="suave">{forca}</span>
    </div>
  );
}
