import { useCallback, useEffect, useState } from "react";
import {
  nomeTemporada,
  online,
  type EstadoRanqueado,
  type PartidaServidor,
  type PerfilRanqueado,
  type Ranking,
  type SituacaoOnline,
} from "../data/online";
import { formatarDinheiro } from "../engine/mercado";
import { MAX_LENDAS_EM_CAMPO } from "../engine/pacotes";
import { escalar, FORMACOES, montarBanco } from "../engine/ratings";
import { ehLenda, type Time } from "../engine/types";
import { PartidaOnline, PREMIO_RANQUEADO } from "./PartidaOnline";
import { TelaElenco } from "./TelaElenco";

const LIGAS = ["bronze", "prata", "ouro", "platina", "diamante", "elite"];
/** Igual a PREMIO_TEMPORADA em api/online_lib.php. */
const PREMIO_TEMPORADA: [string, number][] = [
  ["Bronze", 300],
  ["Prata", 600],
  ["Ouro", 1000],
  ["Platina", 1500],
  ["Diamante", 2500],
  ["Elite", 4000],
];
const liga = (tier: number) => LIGAS[Math.min(5, Math.floor(tier / 4))];

interface Props {
  sit: SituacaoOnline;
  onSit: (s: SituacaoOnline) => void;
  secao: "ranqueado" | "time";
}

/** Ranqueado: fila, partida ao vivo, amistosos, ranking e o time de cartas da conta. */
export function TelaOnline({ sit, onSit, secao }: Props) {
  const [estado, setEstado] = useState<EstadoRanqueado | null>(null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [partida, setPartida] = useState<PartidaServidor | null>(null);
  const [amigo, setAmigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const setSit = onSit;

  const falhou = (e: unknown) => setErro((e as Error).message);

  const carregar = useCallback(async () => {
    try {
      const e = await online.estado();
      setEstado(e);
      if (e.partida?.status === "ao_vivo") setPartida(e.partida);
      setRanking(await online.ranking());
      onSit(await online.situacao());
    } catch (e) {
      falhou(e);
    }
  }, [onSit]);
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No saguão, consulta o servidor (2 s na fila, 3 s fora): pareamento, convites e partida que começou.
  const noSaguao = !!estado && !partida;
  useEffect(() => {
    if (!noSaguao) return;
    const id = setInterval(async () => {
      try {
        const e = await online.estado();
        setEstado(e);
        if (e.partida?.status === "ao_vivo") setPartida(e.partida);
      } catch (err) {
        falhou(err);
      }
    }, estado?.fila ? 2000 : 3000);
    return () => clearInterval(id);
  }, [noSaguao, estado?.fila]);

  const noEstado = async (f: () => Promise<EstadoRanqueado>) => {
    setErro(null);
    try {
      const e = await f();
      setEstado(e);
      if (e.partida?.status === "ao_vivo") setPartida(e.partida);
    } catch (err) {
      falhou(err);
    }
  };

  const acao = async (f: () => Promise<SituacaoOnline>) => {
    setErro(null);
    try {
      const s = await f();
      setSit(s);
      return s;
    } catch (e) {
      falhou(e);
    }
  };

  if (partida) {
    return (
      <section className="tela partida">
        <PartidaOnline
          key={partida.id}
          inicial={partida}
          onVoltar={() => {
            setPartida(null);
            carregar();
          }}
        />
      </section>
    );
  }

  const time = timeDe(sit);
  const titulares = escalar(time);
  const lendasEmCampo = titulares.filter((v) => ehLenda(v.jogador)).length;

  if (secao === "time")
    return (
      <section className="tela online">
        {erro && <p className="aviso">{erro}</p>}
        <p className="suave">
          O time de cartas é o mesmo no ranqueado e nos desafios: cartas base e lendas da sua conta. {lendasEmCampo} de{" "}
          {MAX_LENDAS_EM_CAMPO} lendas em campo. Salário por partida: <b>{formatarDinheiro(sit.time.custo)}</b>, pago do
          caixa único.
        </p>
        <TelaElenco
          time={time}
          onChange={(t: Time) => {
            // A escalação automática (titulares ou banco vazios) é salva já preenchida.
            const [tit, banco] = completa(t);
            acao(() => online.escalar(t.formacao.nome, tit, banco));
          }}
        />
      </section>
    );

  if (!estado) return <p className="suave">Carregando o ranqueado…</p>;
  const perfil = estado.perfil;

  return (
    <section className="tela online">
      {erro && <p className="aviso">{erro}</p>}
      {(
        <div className="ranqueado">
          <div className="ranq-perfil">
            <Emblema perfil={perfil} />
            <div className="ranq-info">
              <span className="rotulo">Temporada {nomeTemporada(perfil.temporada)}</span>
              <h2>{perfil.divisao}</h2>
              <div className="pdl" aria-label={`${perfil.pdl} pontos de liga`}>
                <i style={{ width: `${perfil.tier >= 20 ? 100 : perfil.pdl}%` }} />
              </div>
              <span className="suave">
                {perfil.pdl} PDL{perfil.tier < 20 ? " de 100 para subir" : ""} · {perfil.vitorias}V {perfil.empates}E{" "}
                {perfil.derrotas}D
                {ranking && ranking.top.length > 0 ? ` · ${ranking.minhaPosicao}º no ranking` : ""}
              </span>
            </div>
            <div className="ranq-acao">
              {estado.fila ? (
                <>
                  <span className="procurando">Procurando adversário… {estado.espera}s</span>
                  <button className="botao" onClick={async () => setEstado(await online.sairFila().catch(() => estado))}>
                    Cancelar busca
                  </button>
                </>
              ) : (
                <button
                  className="botao primario"
                  disabled={!!estado.impedimento}
                  onClick={async () => {
                    setErro(null);
                    try {
                      const e = await online.entrarFila();
                      setEstado(e);
                      if (e.partida?.status === "ao_vivo") setPartida(e.partida);
                    } catch (err) {
                      falhou(err);
                    }
                  }}
                >
                  Procurar partida · {formatarDinheiro(sit.time.custo)}
                </button>
              )}
            </div>
          </div>
          {estado.impedimento && <p className="aviso">{estado.impedimento}</p>}
          {estado.ultimaTemporada && (
            <p className="premio">
              Temporada {nomeTemporada(estado.ultimaTemporada.temporada)} encerrada: você chegou a{" "}
              <b>{estado.ultimaTemporada.divisaoMax}</b> e ganhou <b>{estado.ultimaTemporada.moedas} moedas</b>.
            </p>
          )}

          <div className="ranq-colunas">
            <div className="amistoso">
              <h3>Amistoso com um amigo</h3>
              <p className="suave">
                Convide pelo nome de técnico e joguem ao vivo, só pela diversão: o amistoso não cobra salário, não dá prêmio
                e não mexe nos pontos de liga. O convite vale 5 minutos.
              </p>
              <form
                className="proposta-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (amigo.trim()) noEstado(() => online.convidar(amigo.trim())).then(() => setAmigo(""));
                }}
              >
                <input
                  id="online-amigo"
                  placeholder="Nome do amigo"
                  aria-label="Nome do amigo"
                  value={amigo}
                  onChange={(e) => setAmigo(e.target.value)}
                />
                <button className="botao" disabled={!amigo.trim()}>
                  Convidar
                </button>
              </form>
              {estado.convites.recebidos.map((c) => (
                <div key={c.id} className="convite">
                  <span>
                    <b>{c.nome}</b> chamou você para um amistoso.
                  </span>
                  <button className="botao primario" onClick={() => noEstado(() => online.responderConvite(c.id, true))}>
                    Aceitar amistoso
                  </button>
                  <button className="botao discreto" onClick={() => noEstado(() => online.responderConvite(c.id, false))}>
                    Recusar
                  </button>
                </div>
              ))}
              {estado.convites.enviados.map((c) => (
                <div key={c.id} className="convite">
                  <span className="suave">
                    Esperando {c.nome} aceitar o amistoso…
                  </span>
                  <button className="botao discreto" onClick={() => noEstado(() => online.cancelarConvite(c.id))}>
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
            <div className="temporada-premio">
              <h3>Prêmio de fim de temporada</h3>
              <p className="suave">
                Pela maior divisão que você alcançar na temporada. Sua maior até agora: <b>{perfil.divisaoMax}</b>, que
                vale <b>{perfil.premioPrevisto} moedas</b> se a temporada acabasse hoje. Na virada, todos descem 4
                divisões.
              </p>
              <ul className="premios-temporada">
                {PREMIO_TEMPORADA.map(([nome, moedas], i) => (
                  <li key={nome} className={perfil.divisaoMax.startsWith(nome) ? "atual" : ""}>
                    <span className={`rk-liga liga-${LIGAS[i]}`} /> {nome} <b>{moedas}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="suave">
            Vitória vale de 12 a 30 pontos de liga, derrota tira de 12 a 28 e empate não mexe. Com 100 pontos você sobe de
            divisão; abaixo de 0, desce. Prêmio por jogo: vitória {formatarDinheiro(PREMIO_RANQUEADO.vitoria[0])} e{" "}
            {PREMIO_RANQUEADO.vitoria[1]} moedas, empate {formatarDinheiro(PREMIO_RANQUEADO.empate[0])} e{" "}
            {PREMIO_RANQUEADO.empate[1]}, derrota {formatarDinheiro(PREMIO_RANQUEADO.derrota[0])} e{" "}
            {PREMIO_RANQUEADO.derrota[1]}.
          </p>

          {ranking && (
            <div className="ranq-colunas">
              <div>
                <h3>Ranking da temporada</h3>
                {ranking.top.length ? (
                  <ol className="ranking">
                    {ranking.top.map((r, i) => (
                      <li key={i} className={r.eu ? "eu" : ""}>
                        <span className="rk-pos">{i + 1}</span>
                        <span className={`rk-liga liga-${liga(r.tier)}`} />
                        <span className="rk-nome">{r.nome}</span>
                        <span className="rk-div">
                          {r.divisao} · {r.pdl} PDL
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="suave">Ninguém jogou nesta temporada ainda.</p>
                )}
              </div>
              <div>
                <h3>Seus últimos jogos</h3>
                {ranking.historico.length ? (
                  <ul className="ranking">
                    {ranking.historico.map((h) => (
                      <li key={h.id}>
                        <span className="rk-nome">{h.adversario}</span>
                        <span className="rk-div">
                          {h.status === "anulada"
                            ? "anulada"
                            : h.tipo === "amistoso"
                              ? `${h.meus} × ${h.deles} · amistoso`
                              : `${h.meus} × ${h.deles} · ${h.pdl! > 0 ? "+" : ""}${h.pdl} PDL`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="suave">Nenhum jogo ainda.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </section>
  );
}

/** Titulares e banco a salvar: o que o técnico escolheu ou, se vazio, a escolha automática. */
export function completa(t: Time): [string[], string[]] {
  const tit = t.titulares.length ? t.titulares : escalar(t).map((v) => v.jogador.id);
  const banco = montarBanco(t, new Set(tit)).map((j) => j.id);
  return [tit, banco];
}

export function timeDe(s: SituacaoOnline): Time {
  return {
    id: s.usuario.timeId,
    nome: s.usuario.nome,
    sigla: "EU",
    cor: "#ffc93c",
    elenco: s.cartas,
    formacao: FORMACOES.find((f) => f.nome === s.time.formacao) ?? FORMACOES[0],
    titulares: s.time.titulares,
    banco: s.time.banco,
    maxLendas: MAX_LENDAS_EM_CAMPO,
  };
}

function Emblema({ perfil }: { perfil: PerfilRanqueado }) {
  const numeral = perfil.tier >= 20 ? "★" : ["IV", "III", "II", "I"][perfil.tier % 4];
  return (
    <span className={`emblema liga-${liga(perfil.tier)}`} aria-hidden="true">
      {numeral}
    </span>
  );
}

