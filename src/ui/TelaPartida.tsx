import { Escudo } from "./Emblema";
import { nomeDaLiga } from "../engine/ligas";
import { useEffect, useState } from "react";
import { chaveJogo, seedDoJogo, type Temporada } from "../engine/campeonato";
import { MAX_SUBSTITUICOES } from "../engine/match";
import type { ResultadoPartida, Time } from "../engine/types";
import { formatarDinheiro } from "../engine/mercado";
import { PartidaInterativa, type ControleJogo } from "./PartidaInterativa";
import { refJogoLiga } from "../engine/jogoEmAndamento";

interface Props {
  meuTime: Time;
  times: Map<string, Time>;
  temporada: Temporada;
  /** Chamado uma vez quando o jogo do manager termina; devolve a bilheteria que entrou no caixa (0 fora de casa). */
  onFim: (r: ResultadoPartida) => number;
  onAvancar: () => void;
  controle: ControleJogo;
}

/** O jogo do manager na rodada atual do campeonato. */
export function TelaPartida({ meuTime, times, temporada, onFim, onAvancar, controle }: Props) {
  const [jogando, setJogando] = useState(false);
  const [comecando, setComecando] = useState(false);

  const r = temporada.rodadaAtual;
  const jogos = temporada.rodadas[r] ?? [];
  const meuIndice = jogos.findIndex(([m, v]) => m === meuTime.id || v === meuTime.id);
  const [idM, idV] = jogos[meuIndice] ?? [meuTime.id, meuTime.id];
  // O meu time vem do estado da tela (com escalação e lendas); o outro, do mapa.
  const mandante = idM === meuTime.id ? meuTime : times.get(idM)!;
  const visitante = idV === meuTime.id ? meuTime : times.get(idV)!;
  const jaJogado = !!temporada.placares[chaveJogo(r, meuIndice)];
  const seed = seedDoJogo(temporada, r, meuIndice);
  /** O jogo fica salvo na conta antes de começar: sair no meio não deixa jogar de novo. */
  const comecar = async () => {
    setComecando(true);
    const ok = await controle.comecar({
      tipo: "liga",
      ref: refJogoLiga(temporada.ano, r, meuIndice),
      mandante,
      visitante,
      seed,
      meuTimeId: meuTime.id,
    });
    setComecando(false);
    if (ok) setJogando(true);
  };

  // Trocar de rodada limpa a tela.
  useEffect(() => setJogando(false), [r]);

  const incompleto = meuTime.titulares.length > 0 && meuTime.titulares.length < 11;
  const titulo = (
    <div className="rodada-titulo">
      <span className="rotulo">{nomeDaLiga(temporada.divisao)} {temporada.ano}</span>
      <b>
        Rodada {r + 1} de {temporada.rodadas.length}
      </b>
    </div>
  );
  const avancar = (
    <button className="botao primario" onClick={onAvancar}>
      {r + 1 < temporada.rodadas.length ? `Ir para a rodada ${r + 2}` : "Ver fim da temporada"}
    </button>
  );
  const outrosJogos = (
    <div className="outros-jogos">
      <h3>Rodada {r + 1}</h3>
      <ul>
        {jogos.map(([m, v], i) => {
          const p = temporada.placares[chaveJogo(r, i)];
          return (
            <li key={i} className={i === meuIndice ? "meu" : ""}>
              <span className="oj-time">{times.get(m)?.nome}</span>
              <b>{p ? `${p[0]} × ${p[1]}` : "–"}</b>
              <span className="oj-time dir">{times.get(v)?.nome}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (jogando) {
    return (
      <section className="tela partida">
        <PartidaInterativa
          key={r}
          mandante={mandante}
          visitante={visitante}
          seed={seed}
          meuTimeId={meuTime.id}
          controle={controle}
          titulo={titulo}
          depoisDoFim={avancar}
          lateralFim={outrosJogos}
          onFim={(res) => {
            const renda = onFim(res);
            return renda > 0 ? (
              <>
                Bilheteria do jogo em casa: <b>{formatarDinheiro(renda)}</b> no caixa.
              </>
            ) : (
              <>Jogo fora de casa: sem bilheteria. Moedas vêm das missões, dos desafios e do fim da temporada.</>
            );
          }}
        />
      </section>
    );
  }

  return (
    <section className="tela partida">
      <div className="barra">
        {titulo}
        {jaJogado ? (
          avancar
        ) : (
          <button className="botao primario" disabled={comecando} onClick={comecar}>
            {comecando ? "Começando…" : "Jogar partida"}
          </button>
        )}
      </div>

      {incompleto && (
        <p className="aviso">
          Seu time tem só {meuTime.titulares.length} titulares e vai jogar com menos gente. Complete a escalação na aba
          Elenco.
        </p>
      )}

      <div className="placar">
        <Lado time={mandante} rotulo="Mandante" meu={mandante.id === meuTime.id} />
        <div className="placar-centro">
          <div className="gols">
            <span>–</span>
            <span className="x">×</span>
            <span>–</span>
          </div>
          <div className="relogio">{jaJogado ? "Encerrado" : "Antes do jogo"}</div>
        </div>
        <Lado time={visitante} rotulo="Visitante" meu={visitante.id === meuTime.id} />
      </div>

      <div className={`partida-corpo${jaJogado ? " com-rodada" : ""}`}>
        <p className="vazio-partida">
          {jaJogado
            ? "Este jogo já foi disputado. Avance para a próxima rodada."
            : `Seu próximo jogo: ${mandante.nome} x ${visitante.nome}. Confira a escalação na aba Elenco e clique em Jogar partida. Durante o jogo você pode mudar a tática e fazer até ${MAX_SUBSTITUICOES} substituições.`}
        </p>
        {jaJogado && outrosJogos}
      </div>
    </section>
  );
}

function Lado({ time, rotulo, meu }: { time: Time; rotulo: string; meu: boolean }) {
  return (
    <div className={`lado${meu ? " meu" : ""}`}>
      <Escudo time={time} className="escudo" />
      <span className="lado-nome">{time.nome}</span>
      <span className="rotulo">{meu ? "Seu time" : rotulo}</span>
    </div>
  );
}
