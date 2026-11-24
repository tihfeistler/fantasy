import { estiloEscudo } from "../data/clubes";
import { useEffect, useMemo, useRef, useState } from "react";
import { simularPartida } from "../engine/match";
import type { ResultadoPartida, Time, TipoEvento } from "../engine/types";

interface Props {
  meuTime: Time;
  adversarios: Time[];
  /** Chamado uma vez quando a partida termina; devolve as moedas ganhas. */
  onFim?: (r: ResultadoPartida) => number;
}

const VELOCIDADES = { lenta: 400, normal: 150, rapida: 40 };
const ROTULO: Partial<Record<TipoEvento, string>> = {
  gol: "Gol",
  chance: "Chance",
  defesa: "Defesa",
  cartao: "Cartão",
};

export function TelaPartida({ meuTime, adversarios, onFim }: Props) {
  const [advId, setAdvId] = useState(adversarios[0]?.id);
  const [emCasa, setEmCasa] = useState(true);
  const [velocidade, setVelocidade] = useState<keyof typeof VELOCIDADES>("normal");
  const [resultado, setResultado] = useState<ResultadoPartida | null>(null);
  const [minuto, setMinuto] = useState(0);
  const [premio, setPremio] = useState<number | null>(null);
  const premiada = useRef<ResultadoPartida | null>(null);

  const adv = adversarios.find((t) => t.id === advId) ?? adversarios[0];
  const [mandante, visitante] = emCasa ? [meuTime, adv] : [adv, meuTime];

  useEffect(() => {
    if (!resultado || minuto >= 90) return;
    const id = setTimeout(() => setMinuto((m) => m + 1), VELOCIDADES[velocidade]);
    return () => clearTimeout(id);
  }, [resultado, minuto, velocidade]);

  useEffect(() => {
    if (resultado && minuto >= 90 && premiada.current !== resultado) {
      premiada.current = resultado;
      setPremio(onFim ? onFim(resultado) : null);
    }
  }, [resultado, minuto, onFim]);

  const visiveis = useMemo(
    () => (resultado ? resultado.eventos.filter((e) => e.minuto <= minuto) : []),
    [resultado, minuto],
  );
  const placar = (timeId: string) => visiveis.filter((e) => e.tipo === "gol" && e.timeId === timeId).length;
  const sigla = (id?: string) => (id === mandante.id ? mandante.sigla : id === visitante.id ? visitante.sigla : "");

  const jogar = () => {
    setResultado(simularPartida(mandante, visitante, Math.floor(Math.random() * 2 ** 31)));
    setMinuto(0);
    setPremio(null);
  };
  const emJogo = resultado && minuto < 90;

  return (
    <section className="tela partida">
      <div className="barra">
        <label className="campo-form">
          <span className="rotulo">Adversário</span>
          <select id="adversario" value={adv?.id} onChange={(e) => setAdvId(e.target.value)}>
            {adversarios.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="alternar" role="group" aria-label="Mando de campo">
          <button className={emCasa ? "ativo" : ""} onClick={() => setEmCasa(true)}>
            Em casa
          </button>
          <button className={!emCasa ? "ativo" : ""} onClick={() => setEmCasa(false)}>
            Fora
          </button>
        </div>
        <div className="alternar" role="group" aria-label="Velocidade">
          {(["lenta", "normal", "rapida"] as const).map((v) => (
            <button key={v} className={velocidade === v ? "ativo" : ""} onClick={() => setVelocidade(v)}>
              {v === "rapida" ? "Rápida" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <button className="botao primario" onClick={jogar}>
          {resultado ? "Jogar de novo" : "Iniciar partida"}
        </button>
        {emJogo && (
          <button className="botao" onClick={() => setMinuto(90)}>
            Ir para o fim
          </button>
        )}
      </div>

      {meuTime.titulares.length > 0 && meuTime.titulares.length < 11 && (
        <p className="aviso">
          Seu time tem só {meuTime.titulares.length} titulares e vai jogar com menos gente. Complete a escalação na aba
          Elenco.
        </p>
      )}

      <div className="placar">
        <Lado time={mandante} rotulo="Mandante" />
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
        <Lado time={visitante} rotulo="Visitante" />
      </div>
      <div className="progresso">
        <i style={{ width: `${(minuto / 90) * 100}%` }} />
      </div>

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
          Escolha o adversário e o mando de campo e clique em Iniciar partida. O jogo é narrado lance a lance.
        </p>
      )}
      {resultado && minuto >= 90 && premio !== null && (
        <p className="premio">
          <span className="moeda" aria-hidden="true" /> Você ganhou <b>{premio} moedas</b> nesta partida. Use no
          Estoque para abrir pacotes de lendas.
        </p>
      )}
      {resultado && minuto >= 90 && <p className="seed">Seed da partida: {resultado.seed}</p>}
    </section>
  );
}

function Lado({ time, rotulo }: { time: Time; rotulo: string }) {
  return (
    <div className="lado">
      <span className="escudo" style={estiloEscudo(time.cor)}>
        {time.sigla}
      </span>
      <span className="lado-nome">{time.nome}</span>
      <span className="rotulo">{rotulo}</span>
    </div>
  );
}
