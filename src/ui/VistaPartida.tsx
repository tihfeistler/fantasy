import { Escudo } from "./Emblema";
import { useEffect, useState, type ReactNode } from "react";
import { MAX_SUBSTITUICOES, type NovaDecisao, type PartidaAoVivo, type Tatica } from "../engine/match";
import type { Time, TipoEvento } from "../engine/types";
import { setor } from "./CartaJogador";

const ROTULO: Partial<Record<TipoEvento, string>> = {
  gol: "Gol",
  chance: "Chance",
  defesa: "Defesa",
  cartao: "Cartão",
  sub: "Troca",
  tatica: "Tática",
};
const TATICAS: { id: Tatica; nome: string; dica: string }[] = [
  { id: "defensiva", nome: "Defensiva", dica: "Defesa +12%, ataque -12%" },
  { id: "equilibrada", nome: "Equilibrada", dica: "Sem ajuste" },
  { id: "ofensiva", nome: "Ofensiva", dica: "Ataque +12%, defesa -12%" },
];

interface Props {
  partida: PartidaAoVivo;
  mandante: Time;
  visitante: Time;
  meuTimeId: string;
  /** Botões da barra (velocidade, pausa, etc.). */
  controles: ReactNode;
  /** Texto do relógio ("37'", "Intervalo", "Encerrado"). */
  relogio: string;
  aoVivo: boolean;
  /** Painel do técnico travado (jogo acabou ou ainda não começou). */
  travado: boolean;
  fimTexto?: ReactNode;
  lateralFim?: ReactNode;
  /** Envia a decisão; devolve o motivo se não valer. */
  onDecidir: (d: NovaDecisao) => string | null | Promise<string | null>;
  /** Mensagem fixa no painel (ex.: "Tática enviada, vale no próximo minuto"). */
  dica?: string;
}

/**
 * Placar, narração e painel do técnico de uma partida (offline ou online).
 * A partida ocupa a tela inteira: menu, saldos e o resto do jogo ficam
 * escondidos até o técnico sair pelo botão da barra depois do apito final.
 */
export function VistaPartida(p: Props) {
  const [trocando, setTrocando] = useState<string | null>(null);
  // Trava a rolagem da página por trás enquanto a partida está aberta.
  useEffect(() => {
    document.body.classList.add("com-partida");
    return () => document.body.classList.remove("com-partida");
  }, []);
  const [erro, setErro] = useState<string | null>(null);
  const { partida } = p;
  const decidir = async (d: NovaDecisao) => {
    setTrocando(null);
    setErro(await p.onDecidir(d));
  };
  const meu = partida.estado(p.meuTimeId);
  const fim = partida.encerrada;
  const eventos = partida.eventos;
  const gols = (id: string) => partida.estado(id).gols;
  const sigla = (id?: string) => (id === p.mandante.id ? p.mandante.sigla : id === p.visitante.id ? p.visitante.sigla : "");

  return (
    <div className="partida-tela" role="dialog" aria-modal="true" aria-label={`${p.mandante.nome} x ${p.visitante.nome}`}>
    <div className="partida-interativa">
      <div className="barra">{p.controles}</div>

      <div className="placar">
        {[p.mandante, p.visitante].map((t, i) => (
          <div key={t.id} className={`lado${t.id === p.meuTimeId ? " meu" : ""}`} style={{ order: i * 2 }}>
            <Escudo time={t} className="escudo" />
            <span className="lado-nome">{t.nome}</span>
            <span className="rotulo">{t.id === p.meuTimeId ? "Seu time" : i === 0 ? "Mandante" : "Visitante"}</span>
          </div>
        ))}
        <div className="placar-centro" style={{ order: 1 }}>
          <div className="gols">
            <span>{gols(p.mandante.id)}</span>
            <span className="x">×</span>
            <span>{gols(p.visitante.id)}</span>
          </div>
          <div className={`relogio${p.aoVivo ? " ao-vivo" : ""}`}>{p.relogio}</div>
        </div>
      </div>
      <div className="progresso">
        <i style={{ width: `${(partida.minuto / 90) * 100}%` }} />
      </div>
      {p.fimTexto && <div className="premio">{p.fimTexto}</div>}

      <div className="partida-grade">
        <ol className="narracao">
          {[...eventos].reverse().map((e, i) => (
            <li key={eventos.length - i} className={`ev ev-${e.tipo}`}>
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

        {fim && p.lateralFim ? (
          p.lateralFim
        ) : (
          <aside className="painel-tecnico" aria-label="Painel do técnico">
            <h3>Tática</h3>
            <div className="taticas" role="group" aria-label="Tática">
              {TATICAS.map((t) => (
                <button
                  key={t.id}
                  className={meu.tatica === t.id ? "ativo" : ""}
                  disabled={p.travado}
                  title={t.dica}
                  onClick={() => decidir({ timeId: p.meuTimeId, tipo: "tatica", tatica: t.id })}
                >
                  {t.nome}
                </button>
              ))}
            </div>
            <h3>
              Em campo{" "}
              <span className="suave">
                substituições {meu.subs} de {MAX_SUBSTITUICOES}
              </span>
            </h3>
            {erro && <p className="aviso">{erro}</p>}
            <ul className="em-campo">
              {meu.emCampo.map((v) => (
                <li key={v.jogador.id} className={trocando === v.jogador.id ? "trocando" : ""}>
                  <button
                    disabled={p.travado || meu.subs >= MAX_SUBSTITUICOES || !meu.banco.length}
                    onClick={() => setTrocando(trocando === v.jogador.id ? null : v.jogador.id)}
                    title="Substituir"
                  >
                    <span className={`pos setor-${setor(v.pos)}`}>{v.pos}</span>
                    <span className="ec-nome">{v.jogador.nome}</span>
                    <span className="ec-geral">{v.jogador.geral}</span>
                    <span className="energia" title={`Energia ${Math.round(v.energia * 100)}%`}>
                      <i
                        className={v.energia > 0.9 ? "alta" : v.energia > 0.8 ? "media" : "baixa"}
                        style={{ width: `${Math.round(((v.energia - 0.6) / 0.4) * 100)}%` }}
                      />
                    </span>
                  </button>
                  {trocando === v.jogador.id && (
                    <ul className="opcoes-banco">
                      <li className="rotulo">Quem entra no lugar de {v.jogador.nome}?</li>
                      {[...meu.banco]
                        .sort((a, b) => Number(b.posicao === v.pos) - Number(a.posicao === v.pos) || b.geral - a.geral)
                        .map((j) => (
                          <li key={j.id}>
                            <button
                              onClick={() => decidir({ timeId: p.meuTimeId, tipo: "sub", sai: v.jogador.id, entra: j.id })}
                            >
                              <span className={`pos setor-${setor(j.posicao)}`}>{j.posicao}</span>
                              <span className="ec-nome">{j.nome}</span>
                              <span className="ec-geral">{j.geral}</span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            {!fim && <p className="dica">{p.dica ?? "Clique num jogador para substituir. A mudança vale a partir do próximo minuto."}</p>}
          </aside>
        )}
      </div>
    </div>
    </div>
  );
}
