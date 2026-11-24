import { useEffect, useMemo, useRef, useState } from "react";
import { estiloEscudo } from "../data/clubes";
import { chaveJogo, seedDoJogo, type Temporada } from "../engine/campeonato";
import { simularPartida } from "../engine/match";
import type { ResultadoPartida, Time, TipoEvento } from "../engine/types";

interface Props {
  meuTime: Time;
  times: Map<string, Time>;
  temporada: Temporada;
  /** Chamado uma vez quando o jogo do manager termina; devolve as moedas ganhas. */
  onFim: (r: ResultadoPartida) => number;
  onAvancar: () => void;
}

const VELOCIDADES = { lenta: 400, normal: 150, rapida: 40 };
const ROTULO: Partial<Record<TipoEvento, string>> = {
  gol: "Gol",
  chance: "Chance",
  defesa: "Defesa",
  cartao: "Cartão",
};

/** O jogo do manager na rodada atual do campeonato. */
export function TelaPartida({ meuTime, times, temporada, onFim, onAvancar }: Props) {
  const [velocidade, setVelocidade] = useState<keyof typeof VELOCIDADES>("normal");
  const [resultado, setResultado] = useState<ResultadoPartida | null>(null);
  const [minuto, setMinuto] = useState(0);
  const [premio, setPremio] = useState<number | null>(null);
  const premiada = useRef<ResultadoPartida | null>(null);

  const r = temporada.rodadaAtual;
  const jogos = temporada.rodadas[r] ?? [];
  const meuIndice = jogos.findIndex(([m, v]) => m === meuTime.id || v === meuTime.id);
  const [idM, idV] = jogos[meuIndice] ?? [meuTime.id, meuTime.id];
  // O meu time vem do estado da tela (com escalação e lendas); o outro, do mapa.
  const mandante = idM === meuTime.id ? meuTime : times.get(idM)!;
  const visitante = idV === meuTime.id ? meuTime : times.get(idV)!;
  const jaJogado = !!temporada.placares[chaveJogo(r, meuIndice)];

  // Trocar de rodada limpa a tela.
  useEffect(() => {
    setResultado(null);
    setMinuto(0);
    setPremio(null);
  }, [r]);

  useEffect(() => {
    if (!resultado || minuto >= 90) return;
    const id = setTimeout(() => setMinuto((m) => m + 1), VELOCIDADES[velocidade]);
    return () => clearTimeout(id);
  }, [resultado, minuto, velocidade]);

  useEffect(() => {
    if (resultado && minuto >= 90 && premiada.current !== resultado) {
      premiada.current = resultado;
      setPremio(onFim(resultado));
    }
  }, [resultado, minuto, onFim]);

  const visiveis = useMemo(
    () => (resultado ? resultado.eventos.filter((e) => e.minuto <= minuto) : []),
    [resultado, minuto],
  );
  const placar = (timeId: string) => visiveis.filter((e) => e.tipo === "gol" && e.timeId === timeId).length;
  const sigla = (id?: string) => (id === mandante.id ? mandante.sigla : id === visitante.id ? visitante.sigla : "");

  const jogar = () => {
    setResultado(simularPartida(mandante, visitante, seedDoJogo(temporada, r, meuIndice)));
    setMinuto(0);
    setPremio(null);
  };
  const emJogo = !!resultado && minuto < 90;
  const encerrado = !!resultado && minuto >= 90;
  const incompleto = meuTime.titulares.length > 0 && meuTime.titulares.length < 11;

  return (
    <section className="tela partida">
      <div className="barra">
        <div className="rodada-titulo">
          <span className="rotulo">Brasileirão {temporada.ano}</span>
          <b>Rodada {r + 1} de {temporada.rodadas.length}</b>
        </div>
        <div className="alternar" role="group" aria-label="Velocidade">
          {(["lenta", "normal", "rapida"] as const).map((v) => (
            <button key={v} className={velocidade === v ? "ativo" : ""} onClick={() => setVelocidade(v)}>
              {v === "rapida" ? "Rápida" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {!resultado && !jaJogado && (
          <button className="botao primario" onClick={jogar}>
            Jogar partida
          </button>
        )}
        {emJogo && (
          <button className="botao" onClick={() => setMinuto(90)}>
            Ir para o fim
          </button>
        )}
        {(encerrado || (jaJogado && !resultado)) && (
          <button className="botao primario" onClick={onAvancar}>
            {r + 1 < temporada.rodadas.length ? `Ir para a rodada ${r + 2}` : "Ver fim da temporada"}
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
            <span>{resultado ? placar(resultado.mandanteId) : "–"}</span>
            <span className="x">×</span>
            <span>{resultado ? placar(resultado.visitanteId) : "–"}</span>
          </div>
          <div className={`relogio${emJogo ? " ao-vivo" : ""}`}>
            {!resultado ? "Antes do jogo" : minuto >= 90 ? "Encerrado" : `${minuto}'`}
          </div>
        </div>
        <Lado time={visitante} rotulo="Visitante" meu={visitante.id === meuTime.id} />
      </div>
      <div className="progresso">
        <i style={{ width: `${(minuto / 90) * 100}%` }} />
      </div>

      {encerrado && premio !== null && (
        <p className="premio">
          <span className="moeda" aria-hidden="true" /> Você ganhou <b>{premio} moedas</b>. Use no Estoque para abrir
          pacotes de lendas.
        </p>
      )}

      <div className={`partida-corpo${encerrado ? " com-rodada" : ""}`}>
        {resultado ? (
          <ol className="narracao">
            {[...visiveis].reverse().map((e, i) => (
              <li key={visiveis.length - i} className={`ev ev-${e.tipo}`}>
                <span className="min">{e.minuto}'</span>
                {ROTULO[e.tipo] ? (
                  <span className="chip">
                    {ROTULO[e.tipo]} {sigla(e.timeId)}
                  </span>
                ) : (
                  <span className="chip vazio" />
                )}
                <span className="texto">{e.texto}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="vazio-partida">
            {jaJogado
              ? "Este jogo já foi disputado. Avance para a próxima rodada."
              : `Seu próximo jogo: ${mandante.nome} x ${visitante.nome}. Confira a escalação na aba Elenco e clique em Jogar partida.`}
          </p>
        )}
        {(encerrado || jaJogado) && (
          <div className="outros-jogos">
            <h3>Rodada {r + 1}</h3>
            <ul>
              {jogos.map(([m, v], i) => {
                const p = temporada.placares[chaveJogo(r, i)];
                const meu = i === meuIndice;
                return (
                  <li key={i} className={meu ? "meu" : ""}>
                    <span className="oj-time">{times.get(m)?.nome}</span>
                    <b>{p ? `${p[0]} × ${p[1]}` : "–"}</b>
                    <span className="oj-time dir">{times.get(v)?.nome}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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
