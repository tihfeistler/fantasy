import { useEffect, useRef, useState } from "react";
import { online, type PartidaServidor } from "../data/online";
import { formatarDinheiro } from "../engine/mercado";
import { PartidaAoVivo } from "../engine/match";
import { VistaPartida } from "./VistaPartida";

/** Bilheteria do mandante na partida ranqueada (igual a BILHETERIA_RANQUEADO em api/online_lib.php). */
export const BILHETERIA_RANQUEADO = 900;

interface Props {
  inicial: PartidaServidor;
  onVoltar: () => void;
}

/**
 * Partida ranqueada ao vivo. O relógio é do servidor; o cliente consulta a
 * cada segundo, recebe as decisões dos dois técnicos e roda o mesmo motor
 * determinístico. Só mostra minutos que o servidor já liberou, então os dois
 * técnicos veem a mesma partida.
 */
export function PartidaOnline({ inicial, onVoltar }: Props) {
  const [dados, setDados] = useState(inicial);
  const [, setTick] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const offset = useRef(inicial.agoraMs - Date.now());
  const motor = useRef<{ p: PartidaAoVivo; aplicadas: number } | null>(null);
  const relatando = useRef(0);

  const novaPartida = (d: PartidaServidor) => ({
    p: new PartidaAoVivo(d.mandante, d.visitante, d.seed, [d.mandante.id, d.visitante.id]),
    aplicadas: 0,
  });
  motor.current ??= novaPartida(inicial);

  // Consulta o servidor: a cada segundo durante o jogo, a cada 2 s esperando o resultado.
  const terminou = dados.status !== "ao_vivo";
  useEffect(() => {
    if (terminou) return;
    let vivo = true;
    const id = setInterval(async () => {
      const t0 = Date.now();
      try {
        const e = await online.estado(dados.id);
        if (!vivo || !e.partida) return;
        offset.current = e.partida.agoraMs - (t0 + Date.now()) / 2;
        setDados(e.partida);
      } catch (err) {
        if (vivo) setAviso((err as Error).message);
      }
    }, 1000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [dados.id, terminou]);

  // Relógio local, preso ao do servidor.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const ms = dados.segPorMinuto * 1000;
  const agora = Date.now() + offset.current;
  const liberado = Math.floor((dados.agoraMs - dados.inicioMs) / ms) + 1;
  const alvo = Math.max(0, Math.min(90, Math.floor((agora - dados.inicioMs) / ms), liberado));
  const antesDoInicio = agora < dados.inicioMs;

  // Avança o motor até o minuto liberado, aplicando as decisões nos seus minutos.
  let m = motor.current;
  const decs = dados.decisoes;
  if (decs.slice(m.aplicadas).some((d) => d.minuto < m.p.minuto)) m = motor.current = novaPartida(dados);
  for (;;) {
    while (m.aplicadas < decs.length && decs[m.aplicadas].minuto <= m.p.minuto) m.p.decidir(decs[m.aplicadas++]);
    if (m.p.minuto >= alvo || m.p.encerrada) break;
    m.p.avancar();
  }
  const p = m.p;

  // No apito final, relata o placar (de novo a cada 3 s até o servidor aceitar).
  useEffect(() => {
    if (!p.encerrada || dados.relatei || terminou || Date.now() - relatando.current < 3000) return;
    relatando.current = Date.now();
    const r = p.resultado();
    online
      .relatar(dados.id, [r.golsMandante, r.golsVisitante])
      .then((e) => e.partida && setDados(e.partida))
      .catch((err) => setAviso((err as Error).message));
  });

  const decidir = async (d: Parameters<PartidaAoVivo["decidir"]>[0]) => {
    const { timeId: _t, ...decisao } = d;
    try {
      const e = await online.decidir(dados.id, decisao);
      if (e.partida) setDados(e.partida);
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  };

  let fimTexto: React.ReactNode = null;
  if (dados.status === "anulada") {
    fimTexto =
      "Partida anulada: os placares dos dois técnicos não bateram ou ninguém relatou." +
      (dados.tipo === "amistoso" ? "" : " O salário foi devolvido.");
  } else if (dados.status === "encerrada" && dados.gols) {
    const meuMandante = dados.meuTimeId === dados.mandante.id;
    const [g1, g2] = meuMandante ? dados.gols : [dados.gols[1], dados.gols[0]];
    const chave = g1 > g2 ? "vitoria" : g1 === g2 ? "empate" : "derrota";
    const pdl = dados.pdl ?? 0;
    const titulo = <b>{chave === "vitoria" ? "Vitória!" : chave === "empate" ? "Empate." : "Derrota."}</b>;
    if (dados.tipo === "amistoso") {
      fimTexto = <>{titulo} Amistoso entre amigos: sem prêmio e sem pontos de liga.</>;
    } else {
      fimTexto = (
        <>
          {titulo} {pdl > 0 ? `+${pdl}` : pdl} pontos de liga.{" "}
          {meuMandante
            ? `Bilheteria do jogo em casa: ${formatarDinheiro(BILHETERIA_RANQUEADO)} no caixa.`
            : "Jogo fora de casa: sem bilheteria."}
        </>
      );
    }
  } else if (p.encerrada) {
    fimTexto = "Fim de jogo. Confirmando o placar com o servidor…";
  }

  const segundos = Math.ceil((dados.inicioMs - agora) / 1000);
  return (
    <VistaPartida
      partida={p}
      mandante={dados.mandante}
      visitante={dados.visitante}
      meuTimeId={dados.meuTimeId}
      relogio={antesDoInicio ? `Começa em ${segundos}s` : p.encerrada ? "Encerrado" : `${p.minuto}'`}
      aoVivo={!antesDoInicio && !p.encerrada}
      travado={p.encerrada || p.minuto >= 88}
      fimTexto={aviso ? <span className="aviso">{aviso}</span> : fimTexto}
      dica="Clique num jogador para substituir. A mudança vale para os dois técnicos a partir do próximo minuto."
      onDecidir={decidir}
      controles={
        <>
          <div className="rodada-titulo">
            <span className="rotulo">{dados.tipo === "amistoso" ? "Amistoso ao vivo" : "Ranqueado ao vivo"}</span>
            <b>
              {dados.mandante.nome} × {dados.visitante.nome}
            </b>
          </div>
          {terminou && (
            <button className="botao primario" onClick={onVoltar}>
              Voltar ao ranqueado
            </button>
          )}
        </>
      }
    />
  );
}
