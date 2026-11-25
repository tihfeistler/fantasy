import { useState, type ReactNode } from "react";
import { estiloEscudo } from "../data/clubes";
import {
  campanha,
  faseAtual,
  nomesDasFases,
  jogoDoClube,
  premioDaFase,
  seedDoJogoCopa,
  vencedorDoJogo,
  type Copa,
  type JogoCopa,
} from "../engine/copas";
import { formatarDinheiro } from "../engine/mercado";
import { MAX_SUBSTITUICOES } from "../engine/match";
import type { ResultadoPartida, Time } from "../engine/types";
import { PartidaInterativa } from "./PartidaInterativa";

/** Título ganho pelo técnico (ou campanha de uma copa encerrada). */
export interface CampanhaCopa {
  ano: number;
  id: string;
  nome: string;
  campeao: string;
  /** Até onde o clube do técnico foi; sem valor, não disputou. */
  campanha?: string;
}

const placarTexto = (j: JogoCopa) =>
  j.placar ? `${j.placar[0]} × ${j.placar[1]}${j.penaltis ? ` (${j.penaltis[0]}–${j.penaltis[1]} pên.)` : ""}` : "–";

/** Jogo de copa do técnico: antes, durante e depois da partida. */
export function PartidaCopa(props: {
  copa: Copa;
  meuTime: Time;
  times: Map<string, Time>;
  /** Grava o jogo do técnico; devolve o texto do resultado (prêmio ou eliminação). */
  onFim: (r: ResultadoPartida) => ReactNode;
  /** Fecha a fase (simula os outros jogos) e volta para o calendário. */
  onContinuar: () => void;
}) {
  const { copa, meuTime, times } = props;
  const [jogando, setJogando] = useState(false);
  const fase = faseAtual(copa)!;
  const nFase = copa.fases.length - 1;
  const i = jogoDoClube(copa, meuTime.id);
  const jogo = fase.jogos[i];
  const mandante = jogo.mandante === meuTime.id ? meuTime : times.get(jogo.mandante)!;
  const visitante = jogo.visitante === meuTime.id ? meuTime : times.get(jogo.visitante)!;
  const premio = premioDaFase(copa, nFase);
  const titulo = (
    <div className="rodada-titulo">
      <span className="rotulo">
        {copa.nome} {copa.ano}
      </span>
      <b>{fase.nome}</b>
    </div>
  );
  const continuar = (
    <button className="botao primario" onClick={props.onContinuar}>
      Continuar
    </button>
  );
  const outros = <JogosDaFase copa={copa} fase={nFase} times={times} meuId={meuTime.id} />;

  if (jogando || jogo.placar) {
    return (
      <section className="tela partida">
        {jogando ? (
          <PartidaInterativa
            key={`${copa.id}-${nFase}`}
            mandante={mandante}
            visitante={visitante}
            seed={seedDoJogoCopa(copa, nFase, i)}
            meuTimeId={meuTime.id}
            titulo={titulo}
            depoisDoFim={continuar}
            lateralFim={outros}
            onFim={props.onFim}
          />
        ) : (
          <>
            <div className="barra">
              {titulo}
              {continuar}
            </div>
            <p className="vazio-partida">
              {mandante.nome} {placarTexto(jogo)} {visitante.nome}.{" "}
              {vencedorDoJogo(jogo) === meuTime.id ? "Você passou de fase." : "Você foi eliminado."}
            </p>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="tela partida">
      <div className="barra">
        {titulo}
        <button className="botao primario" onClick={() => setJogando(true)}>
          Jogar partida
        </button>
      </div>
      <div className="placar">
        <Lado time={mandante} rotulo="Mandante" meu={mandante.id === meuTime.id} />
        <div className="placar-centro">
          <div className="gols">
            <span>–</span>
            <span className="x">×</span>
            <span>–</span>
          </div>
          <div className="relogio">Mata-mata</div>
        </div>
        <Lado time={visitante} rotulo="Visitante" meu={visitante.id === meuTime.id} />
      </div>
      <div className="partida-corpo com-rodada">
        <p className="vazio-partida">
          Jogo único: quem vencer passa; empate vai para os pênaltis. Passar de fase vale{" "}
          <b>{formatarDinheiro(premio.valor)}</b> no caixa e <b>{premio.moedas} moedas</b>
          {premio.final ? " (com o prêmio do título)" : ""}. Durante o jogo você pode mudar a tática e fazer até{" "}
          {MAX_SUBSTITUICOES} substituições.
        </p>
        {outros}
      </div>
    </section>
  );
}

function JogosDaFase({ copa, fase, times, meuId }: { copa: Copa; fase: number; times: Map<string, Time>; meuId: string }) {
  const f = copa.fases[fase];
  return (
    <div className="outros-jogos">
      <h3>{f.nome}</h3>
      <ul>
        {f.jogos.map((j, k) => {
          const venc = vencedorDoJogo(j);
          const meu = j.mandante === meuId || j.visitante === meuId;
          return (
            <li key={k} className={meu ? "meu" : ""}>
              <span className={`oj-time${venc && venc !== j.mandante ? " eliminado" : ""}`}>
                {times.get(j.mandante)?.nome}
              </span>
              <b>{placarTexto(j)}</b>
              <span className={`oj-time dir${venc && venc !== j.visitante ? " eliminado" : ""}`}>
                {times.get(j.visitante)?.nome}
              </span>
            </li>
          );
        })}
      </ul>
      {f.folgas.length > 0 && (
        <p className="suave copa-folgas">
          {f.folgas.length} clubes entram direto na fase seguinte
          {f.folgas.includes(meuId) ? ", entre eles o seu" : ""}.
        </p>
      )}
    </div>
  );
}

/** Aba Copas da carreira: andamento, chaveamento e títulos. */
export function TelaCopas(props: {
  copas: Copa[];
  meuTime: Time;
  times: Map<string, Time>;
  /** Rodadas da liga já jogadas e o total (para mostrar as datas das fases). */
  rodadasJogadas: number;
  historico: CampanhaCopa[];
  onJogar: () => void;
  pendente: boolean;
}) {
  const { copas, meuTime, times } = props;
  const [verId, setVerId] = useState<string | null>(null);
  const copa = copas.find((c) => c.id === verId) ?? copas[0];
  const [verFase, setVerFase] = useState<number | null>(null);
  const titulos = props.historico.filter((h) => h.campeao === meuTime.id);

  if (!copa)
    return (
      <section className="tela">
        <p className="vazio-bloco">As copas começam na próxima temporada.</p>
      </section>
    );

  const fase = Math.min(verFase ?? copa.fases.length - 1, copa.fases.length - 1);
  const minha = campanha(copa, meuTime.id);
  const atual = faseAtual(copa);
  const proximaData = atual ? copa.datas[copa.fases.length - 1] : null;

  return (
    <section className="tela copas">
      {props.pendente && (
        <p className="aviso aviso-acao">
          <span>Você tem um jogo de copa marcado antes da próxima rodada.</span>
          <button className="botao primario" onClick={props.onJogar}>
            Ir para o jogo
          </button>
        </p>
      )}
      <div className="alternar" role="group" aria-label="Copa">
        {copas.map((c) => (
          <button
            key={c.id}
            className={c.id === copa.id ? "ativo" : ""}
            onClick={() => {
              setVerId(c.id);
              setVerFase(null);
            }}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <div className="copa-cabeca">
        <div>
          <span className="rotulo">
            {copa.tipo === "nacional" ? "Copa nacional" : "Copa continental"} · {copa.ano} · {copa.clubes.length} clubes
          </span>
          <h2>{copa.nome}</h2>
          <p className="suave">
            {minha ? (
              <>
                Seu time: <b className={minha.vivo || copa.campeao === meuTime.id ? "copa-vivo" : ""}>{minha.texto}</b>.
              </>
            ) : (
              <>Seu time não se classificou. A vaga sai da tabela da primeira divisão.</>
            )}{" "}
            {copa.campeao
              ? `Campeão: ${times.get(copa.campeao)?.nome}.`
              : proximaData !== null &&
                (proximaData > props.rodadasJogadas
                  ? `${atual!.nome} depois da rodada ${proximaData} da liga.`
                  : `${atual!.nome} nesta semana.`)}
          </p>
        </div>
        {copa.campeao && (
          <div className="copa-campeao">
            <span className="escudo grande" style={estiloEscudo(times.get(copa.campeao)!.cor)}>
              {times.get(copa.campeao)!.sigla}
            </span>
            <b>{times.get(copa.campeao)!.nome}</b>
          </div>
        )}
      </div>

      <div className="copa-corpo">
        <div>
          <div className="alternar copa-fases" role="group" aria-label="Fase">
            {copa.fases.map((f, k) => (
              <button key={k} className={k === fase ? "ativo" : ""} onClick={() => setVerFase(k)}>
                {f.nome}
              </button>
            ))}
          </div>
          {copa.fases.length > 0 && <JogosDaFase copa={copa} fase={fase} times={times} meuId={meuTime.id} />}
        </div>
        <div className="calendario">
          <h2>Prêmios por fase</h2>
          <ol>
            {copa.datas.map((d, k) => {
              const p = premioDaFase(copa, k);
              return (
                <li key={k} className={k === copa.fases.length - 1 && !copa.campeao ? "proximo" : ""}>
                  <span className="cal-rod">{d}</span>
                  <span className="cal-adv">{nomesDasFases(copa.clubes.length)[k]}</span>
                  <span className="suave">{formatarDinheiro(p.valor)}</span>
                  <span className="suave" title={`${p.moedas} moedas`}>
                    <span className="moeda" aria-hidden="true" /> {p.moedas.toLocaleString("pt-BR")}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="suave copa-nota">
            Número = rodada da liga depois da qual a fase é jogada. O prêmio cai no caixa a cada fase vencida; a final
            vencida paga também o título.
          </p>
        </div>
      </div>

      {props.historico.length > 0 && (
        <div className="copa-historico">
          <h2>
            Histórico <span className="suave">{titulos.length ? `${titulos.length} título${titulos.length > 1 ? "s" : ""}` : ""}</span>
          </h2>
          <ul>
            {[...props.historico].reverse().map((h, k) => (
              <li key={k} className={h.campeao === meuTime.id ? "meu" : ""}>
                <span className="cal-rod">{h.ano}</span>
                <span>{h.nome}</span>
                <span className="suave">{h.campanha ?? "Não disputou"}</span>
                <span>Campeão: {times.get(h.campeao)?.nome ?? h.campeao}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Lado({ time, rotulo, meu }: { time: Time; rotulo: string; meu: boolean }) {
  return (
    <div className={`lado${meu ? " meu" : ""}`}>
      <span className="escudo" style={estiloEscudo(time.cor)}>
        {time.sigla}
      </span>
      <span className="lado-nome">{time.nome}</span>
      <span className="rotulo">{meu ? "Seu time" : rotulo}</span>
    </div>
  );
}
