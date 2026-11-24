import { useEffect, useMemo, useState } from "react";
import { simularPartida } from "../engine/match";
import type { ResultadoPartida, Time } from "../engine/types";

interface Props {
  meuTime: Time;
  adversarios: Time[];
}

const VELOCIDADES = { lenta: 400, normal: 150, rapida: 40 };

export function TelaPartida({ meuTime, adversarios }: Props) {
  const [advId, setAdvId] = useState(adversarios[0]?.id);
  const [emCasa, setEmCasa] = useState(true);
  const [velocidade, setVelocidade] = useState<keyof typeof VELOCIDADES>("normal");
  const [resultado, setResultado] = useState<ResultadoPartida | null>(null);
  const [minuto, setMinuto] = useState(0);

  const adv = adversarios.find((t) => t.id === advId) ?? adversarios[0];
  const [mandante, visitante] = emCasa ? [meuTime, adv] : [adv, meuTime];

  useEffect(() => {
    if (!resultado || minuto >= 90) return;
    const id = setTimeout(() => setMinuto((m) => m + 1), VELOCIDADES[velocidade]);
    return () => clearTimeout(id);
  }, [resultado, minuto, velocidade]);

  const visiveis = useMemo(
    () => (resultado ? resultado.eventos.filter((e) => e.minuto <= minuto) : []),
    [resultado, minuto],
  );
  const placar = (timeId: string) =>
    visiveis.filter((e) => e.tipo === "gol" && e.timeId === timeId).length;

  const jogar = () => {
    const seed = Math.floor(Math.random() * 2 ** 31);
    setResultado(simularPartida(mandante, visitante, seed));
    setMinuto(0);
  };

  return (
    <section className="tela partida">
      <div className="barra">
        <label>
          Adversário{" "}
          <select value={adv?.id} onChange={(e) => setAdvId(e.target.value)}>
            {adversarios.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={emCasa} onChange={(e) => setEmCasa(e.target.checked)} /> Jogar em
          casa
        </label>
        <label>
          Velocidade{" "}
          <select value={velocidade} onChange={(e) => setVelocidade(e.target.value as keyof typeof VELOCIDADES)}>
            <option value="lenta">Lenta</option>
            <option value="normal">Normal</option>
            <option value="rapida">Rápida</option>
          </select>
        </label>
        <button className="primario" onClick={jogar}>
          {resultado ? "Jogar de novo" : "Iniciar partida"}
        </button>
        {resultado && minuto < 90 && <button onClick={() => setMinuto(90)}>Pular para o fim</button>}
      </div>

      <div className="placar">
        <div className="lado" style={{ borderColor: mandante.cor }}>{mandante.nome}</div>
        <div className="gols">
          {resultado ? `${placar(resultado.mandanteId)} x ${placar(resultado.visitanteId)}` : "– x –"}
        </div>
        <div className="lado" style={{ borderColor: visitante.cor }}>{visitante.nome}</div>
      </div>
      <div className="relogio">
        <div className="progresso" style={{ width: `${(minuto / 90) * 100}%` }} />
        <span>{resultado ? `${minuto}'` : "Aguardando início"}</span>
      </div>

      <ol className="narracao">
        {[...visiveis].reverse().map((e, i) => (
          <li key={visiveis.length - i} className={`ev-${e.tipo}`}>
            <span className="min">{e.minuto}'</span> {e.texto}
          </li>
        ))}
      </ol>
      {resultado && minuto >= 90 && <p className="seed">Seed da partida: {resultado.seed}</p>}
    </section>
  );
}
