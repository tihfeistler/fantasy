import { useEffect, useRef, useState, type ReactNode } from "react";
import { PartidaAoVivo } from "../engine/match";
import type { ResultadoPartida, Time } from "../engine/types";
import { VistaPartida } from "./VistaPartida";

/** Milissegundos por minuto de jogo. Minutos com chance, gol ou defesa duram mais (lenta e normal) para o lance aparecer no campo. */
const VELOCIDADES = { lenta: 1400, normal: 650, rapida: 150 };
const LANCE_LONGO = 2.2;

interface Props {
  mandante: Time;
  visitante: Time;
  seed: number;
  /** Time controlado pelo técnico. */
  meuTimeId: string;
  /** Chamado uma vez no apito final; o retorno aparece abaixo do placar. */
  onFim: (r: ResultadoPartida) => ReactNode;
  /** Conteúdo à esquerda da barra (ex.: título da rodada). */
  titulo?: ReactNode;
  /** Botões que aparecem na barra depois do apito final. */
  depoisDoFim?: ReactNode;
  /** Conteúdo ao lado da narração depois do fim (ex.: outros jogos). */
  lateralFim?: ReactNode;
}

/** Partida contra a IA: o relógio é local, com velocidade, pausa e intervalo. */
export function PartidaInterativa(p: Props) {
  const [partida] = useState(() => new PartidaAoVivo(p.mandante, p.visitante, p.seed, [p.meuTimeId]));
  const [, setTick] = useState(0);
  const [velocidade, setVelocidade] = useState<keyof typeof VELOCIDADES>("normal");
  const [pausado, setPausado] = useState(false);
  const [fimTexto, setFimTexto] = useState<ReactNode>(null);
  const parouNoIntervalo = useRef(false);
  const pago = useRef(false);
  const atualizar = () => setTick((t) => t + 1);
  const temLance = partida.eventos.some(
    (e) => e.minuto === partida.minuto && (e.tipo === "gol" || e.tipo === "chance" || e.tipo === "defesa"),
  );
  const msPorMinuto = VELOCIDADES[velocidade] * (temLance && velocidade !== "rapida" ? LANCE_LONGO : 1);

  useEffect(() => {
    if (pausado || partida.encerrada) return;
    const id = setTimeout(() => {
      partida.avancar();
      // Pausa no intervalo para o técnico mexer no time.
      if (partida.minuto === 45 && !parouNoIntervalo.current) {
        parouNoIntervalo.current = true;
        setPausado(true);
      }
      atualizar();
    }, msPorMinuto);
    return () => clearTimeout(id);
  });
  useEffect(() => {
    if (partida.encerrada && !pago.current) {
      pago.current = true;
      setFimTexto(p.onFim(partida.resultado()));
    }
  });

  const irParaOFim = () => {
    while (!partida.encerrada) partida.avancar();
    atualizar();
  };
  const fim = partida.encerrada;

  return (
    <VistaPartida
      partida={partida}
      mandante={p.mandante}
      visitante={p.visitante}
      meuTimeId={p.meuTimeId}
      relogio={fim ? "Encerrado" : pausado ? (partida.minuto === 45 ? "Intervalo" : `Pausado ${partida.minuto}'`) : `${partida.minuto}'`}
      aoVivo={!fim && !pausado}
      travado={fim}
      fimTexto={fimTexto}
      lateralFim={p.lateralFim}
      msPorMinuto={msPorMinuto}
      onDecidir={(d) => {
        const e = partida.decidir(d);
        atualizar();
        return e;
      }}
      controles={
        <>
          {p.titulo}
          <div className="alternar" role="group" aria-label="Velocidade">
            {(["lenta", "normal", "rapida"] as const).map((v) => (
              <button key={v} className={velocidade === v ? "ativo" : ""} onClick={() => setVelocidade(v)}>
                {v === "rapida" ? "Rápida" : v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {!fim && (
            <>
              <button className="botao" onClick={() => setPausado((x) => !x)}>
                {pausado ? "Continuar" : "Pausar"}
              </button>
              <button className="botao" onClick={irParaOFim}>
                Ir para o fim
              </button>
            </>
          )}
          {fim && p.depoisDoFim}
        </>
      }
    />
  );
}
