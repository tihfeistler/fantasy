import { nomeDaLiga } from "../engine/ligas";
import { useEffect, useState } from "react";
import { estiloEscudo } from "../data/clubes";
import { chaveJogo, seedDoJogo, type Temporada } from "../engine/campeonato";
import { MAX_SUBSTITUICOES } from "../engine/match";
import type { ResultadoPartida, Time } from "../engine/types";
import { PartidaInterativa } from "./PartidaInterativa";

interface Props {
  meuTime: Time;
  times: Map<string, Time>;
  temporada: Temporada;
  /** Chamado uma vez quando o jogo do manager termina; devolve as moedas ganhas. */
  onFim: (r: ResultadoPartida) => number;
  onAvancar: () => void;
}

/** O jogo do manager na rodada atual do campeonato. */
export function TelaPartida({ meuTime, times, temporada, onFim, onAvancar }: Props) {
  const [jogando, setJogando] = useState(false);

  const r = temporada.rodadaAtual;
  const jogos = temporada.rodadas[r] ?? [];
  const meuIndice = jogos.findIndex(([m, v]) => m === meuTime.id || v === meuTime.id);
  const [idM, idV] = jogos[meuIndice] ?? [meuTime.id, meuTime.id];
  // O meu time vem do estado da tela (com escalação e lendas); o outro, do mapa.
  const mandante = idM === meuTime.id ? meuTime : times.get(idM)!;
  const visitante = idV === meuTime.id ? meuTime : times.get(idV)!;
  const jaJogado = !!temporada.placares[chaveJogo(r, meuIndice)];

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
          seed={seedDoJogo(temporada, r, meuIndice)}
          meuTimeId={meuTime.id}
          titulo={titulo}
          depoisDoFim={avancar}
          lateralFim={outrosJogos}
          onFim={(res) => (
            <>
              <span className="moeda" aria-hidden="true" /> Você ganhou <b>{onFim(res)} moedas</b>. Use no Estoque para
              abrir pacotes de lendas.
            </>
          )}
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
          <button className="botao primario" onClick={() => setJogando(true)}>
            Jogar partida
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
      <span className="escudo" style={estiloEscudo(time.cor)}>
        {time.sigla}
      </span>
      <span className="lado-nome">{time.nome}</span>
      <span className="rotulo">{meu ? "Seu time" : rotulo}</span>
    </div>
  );
}
