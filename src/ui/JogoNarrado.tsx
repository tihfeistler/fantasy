import { useEffect, useMemo, useRef, useState } from "react";
import { estiloEscudo } from "../data/clubes";
import { simularPartida } from "../engine/match";
import type { ResultadoPartida, Time, TipoEvento } from "../engine/types";

const VELOCIDADES = { lenta: 400, normal: 150, rapida: 40 };
const ROTULO: Partial<Record<TipoEvento, string>> = { gol: "Gol", chance: "Chance", defesa: "Defesa", cartao: "Cartão" };

interface Props {
  mandante: Time;
  visitante: Time;
  seed: number;
  /** Chamado uma vez no apito final. Devolve o texto do prêmio. */
  onFim: (r: ResultadoPartida) => string;
  onVoltar: () => void;
}

/** Partida avulsa narrada minuto a minuto (desafios). */
export function JogoNarrado({ mandante, visitante, seed, onFim, onVoltar }: Props) {
  const resultado = useMemo(() => simularPartida(mandante, visitante, seed), [mandante, visitante, seed]);
  const [velocidade, setVelocidade] = useState<keyof typeof VELOCIDADES>("normal");
  const [minuto, setMinuto] = useState(0);
  const [premio, setPremio] = useState<string | null>(null);
  const pago = useRef(false);

  useEffect(() => {
    if (minuto >= 90) return;
    const id = setTimeout(() => setMinuto((m) => m + 1), VELOCIDADES[velocidade]);
    return () => clearTimeout(id);
  }, [minuto, velocidade]);
  useEffect(() => {
    if (minuto >= 90 && !pago.current) {
      pago.current = true;
      setPremio(onFim(resultado));
    }
  }, [minuto, resultado, onFim]);

  const visiveis = resultado.eventos.filter((e) => e.minuto <= minuto);
  const gols = (id: string) => visiveis.filter((e) => e.tipo === "gol" && e.timeId === id).length;
  const sigla = (id?: string) => (id === mandante.id ? mandante.sigla : id === visitante.id ? visitante.sigla : "");
  const fim = minuto >= 90;

  return (
    <div className="jogo-narrado">
      <div className="barra">
        <div className="alternar" role="group" aria-label="Velocidade">
          {(["lenta", "normal", "rapida"] as const).map((v) => (
            <button key={v} className={velocidade === v ? "ativo" : ""} onClick={() => setVelocidade(v)}>
              {v === "rapida" ? "Rápida" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {!fim ? (
          <button className="botao" onClick={() => setMinuto(90)}>
            Ir para o fim
          </button>
        ) : (
          <button className="botao primario" onClick={onVoltar}>
            Voltar aos desafios
          </button>
        )}
      </div>
      <div className="placar">
        {[mandante, visitante].map((t, i) => (
          <div key={t.id} className={`lado${i === 0 ? " meu" : ""}`} style={{ order: i * 2 }}>
            <span className="escudo" style={estiloEscudo(t.cor)}>
              {t.sigla}
            </span>
            <span className="lado-nome">{t.nome}</span>
          </div>
        ))}
        <div className="placar-centro" style={{ order: 1 }}>
          <div className="gols">
            <span>{gols(mandante.id)}</span>
            <span className="x">×</span>
            <span>{gols(visitante.id)}</span>
          </div>
          <div className={`relogio${fim ? "" : " ao-vivo"}`}>{fim ? "Encerrado" : `${minuto}'`}</div>
        </div>
      </div>
      <div className="progresso">
        <i style={{ width: `${(minuto / 90) * 100}%` }} />
      </div>
      {premio && <p className="premio">{premio}</p>}
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
    </div>
  );
}
