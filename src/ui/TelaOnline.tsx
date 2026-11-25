import { useCallback, useEffect, useMemo, useState } from "react";
import { ATUAIS } from "../data/clubes";
import {
  nomeTemporada,
  online,
  type EstadoRanqueado,
  type PartidaServidor,
  type PerfilRanqueado,
  type Ranking,
  type SituacaoOnline,
  type Usuario,
} from "../data/online";
import { precoCartaBase } from "../engine/desafios";
import { formatarDinheiro } from "../engine/mercado";
import { MAX_LENDAS_EM_CAMPO, PRECO_PACOTE } from "../engine/pacotes";
import { escalar, FORMACOES, montarBanco } from "../engine/ratings";
import { ehLenda, type Jogador, type Time } from "../engine/types";
import { LojaCartasBase } from "./LojaCartasBase";
import { PartidaOnline, PREMIO_RANQUEADO } from "./PartidaOnline";
import { TelaElenco } from "./TelaElenco";
import { TelaMercadoOnline } from "./TelaMercadoOnline";

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

/** Modo online: conta, time de cartas no servidor, fila do ranqueado e ranking. */
export function TelaOnline() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [fora, setFora] = useState(false);
  const [sit, setSit] = useState<SituacaoOnline | null>(null);
  const [estado, setEstado] = useState<EstadoRanqueado | null>(null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [partida, setPartida] = useState<PartidaServidor | null>(null);
  const [modo, setModo] = useState<"ranqueado" | "time" | "cartas" | "mercado">("ranqueado");
  const [amigo, setAmigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [novas, setNovas] = useState<Jogador[] | null>(null);

  const falhou = (e: unknown) => {
    const err = e as { status?: number; message: string };
    if (err.status === 0) setFora(true);
    else if (err.status === 401) setUsuario(null);
    else setErro(err.message);
  };

  useEffect(() => {
    online.eu().then(setUsuario, falhou);
  }, []);

  const carregar = useCallback(async () => {
    try {
      let s = await online.situacao();
      // Primeira vez (ou escalação vazia): salva a escalação automática.
      if (s.time.titulares.length === 0 && s.cartas.length) {
        const t = timeDe(s);
        const [tit, banco] = completa({ ...t, titulares: [], banco: undefined });
        s = await online.escalar(t.formacao.nome, tit, banco);
      }
      setSit(s);
      const e = await online.estado();
      setEstado(e);
      if (e.partida?.status === "ao_vivo") setPartida(e.partida);
      setRanking(await online.ranking());
    } catch (e) {
      falhou(e);
    }
  }, []);
  useEffect(() => {
    if (usuario) carregar();
  }, [usuario, carregar]);

  // No saguão, consulta o servidor (2 s na fila, 3 s fora): pareamento, convites e partida que começou.
  const noSaguao = !!usuario && !!estado && !partida;
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

  if (fora) {
    return (
      <section className="tela online">
        <div className="aviso-online">
          <h2>Online precisa do servidor</h2>
          <p>
            O ranqueado roda no servidor PHP com MySQL (XAMPP), que guarda contas, cartas, a fila e as partidas. Esta
            prévia não tem servidor, então o modo online não funciona aqui. Para testar, siga o passo a passo de{" "}
            <code>docs/XAMPP.md</code> no repositório.
          </p>
        </div>
      </section>
    );
  }
  if (usuario === undefined) return <p className="suave">Conectando ao servidor…</p>;
  if (usuario === null) return <Entrar onEntrou={setUsuario} />;

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

  if (!sit || !estado) return <p className="suave">Carregando seu time online…</p>;
  const time = timeDe(sit);
  const titulares = escalar(time);
  const lendasEmCampo = titulares.filter((v) => ehLenda(v.jogador)).length;
  const perfil = estado.perfil;

  return (
    <section className="tela online">
      <div className="financas">
        <div className="indicador destaque">
          <span className="rotulo">Caixa do time online</span>
          <b>{formatarDinheiro(sit.time.caixa)}</b>
        </div>
        <div className="indicador">
          <span className="rotulo">Salário por partida</span>
          <b>{formatarDinheiro(sit.time.custo)}</b>
        </div>
        <div className="indicador">
          <span className="rotulo">Moedas online</span>
          <b>{sit.moedas}</b>
        </div>
        <div className="indicador">
          <span className="rotulo">Técnico</span>
          <b className="online-nome">{usuario.nome}</b>
          <button
            className="link"
            onClick={async () => {
              await online.sair().catch(() => null);
              setUsuario(null);
              setSit(null);
            }}
          >
            Sair da conta
          </button>
        </div>
      </div>
      <p className="suave nota-financas">
        O time online fica no servidor e é separado da carreira: cartas base e lendas compradas aqui, caixa e moedas
        próprios. Cada partida cobra o salário dos titulares (lendas em dobro); sem caixa, não joga.
      </p>
      {erro && <p className="aviso">{erro}</p>}

      <div className="alternar mercado-modos" role="group" aria-label="Seção">
        <button className={modo === "ranqueado" ? "ativo" : ""} onClick={() => setModo("ranqueado")}>
          Ranqueado
        </button>
        <button className={modo === "time" ? "ativo" : ""} onClick={() => setModo("time")}>
          Meu time
        </button>
        <button className={modo === "cartas" ? "ativo" : ""} onClick={() => setModo("cartas")}>
          Cartas
        </button>
        <button className={modo === "mercado" ? "ativo" : ""} onClick={() => setModo("mercado")}>
          Mercado
        </button>
      </div>

      {modo === "ranqueado" && (
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
                Convide pelo nome de técnico. Mesma partida ao vivo e mesmo salário, sem pontos de liga e com metade do
                prêmio. O convite vale 5 minutos.
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
                <button className="botao" disabled={!amigo.trim() || !!estado.impedimento}>
                  Convidar
                </button>
              </form>
              {estado.convites.recebidos.map((c) => (
                <div key={c.id} className="convite">
                  <span>
                    <b>{c.nome}</b> chamou você para um amistoso.
                  </span>
                  <button className="botao primario" onClick={() => noEstado(() => online.responderConvite(c.id, true))}>
                    Aceitar · {formatarDinheiro(sit.time.custo)}
                  </button>
                  <button className="botao discreto" onClick={() => noEstado(() => online.responderConvite(c.id, false))}>
                    Recusar
                  </button>
                </div>
              ))}
              {estado.convites.enviados.map((c) => (
                <div key={c.id} className="convite">
                  <span className="suave">Esperando {c.nome} aceitar…</span>
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

      {modo === "time" && (
        <>
          <p className="suave">
            {lendasEmCampo} de {MAX_LENDAS_EM_CAMPO} lendas em campo. Custo desta escalação por partida:{" "}
            <b>{formatarDinheiro(sit.time.custo)}</b>. As mudanças são salvas no servidor.
          </p>
          <TelaElenco
            time={time}
            onChange={(t: Time) => {
              // A escalação automática (titulares ou banco vazios) é salva já preenchida.
              const [tit, banco] = completa(t);
              acao(() => online.escalar(t.formacao.nome, tit, banco));
            }}
          />
        </>
      )}

      {modo === "mercado" && (
        <TelaMercadoOnline
          onMudou={() =>
            online
              .situacao()
              .then(setSit)
              .catch(() => null)
          }
        />
      )}

      {modo === "cartas" && (
        <>
          <div className="pacote-online">
            <div>
              <h3>Pacote de lendas</h3>
              <p className="suave">5 lendas: 70% comum, 25% rara, 5% ícone. Vão direto para o seu time online.</p>
            </div>
            <button
              className="botao primario"
              disabled={sit.moedas < PRECO_PACOTE}
              onClick={async () => {
                const s = await acao(() => online.abrirPacote());
                if (s?.novas) setNovas(s.novas);
              }}
            >
              Abrir pacote · {PRECO_PACOTE} moedas
            </button>
          </div>
          {novas && (
            <p className="premio">
              Saiu: {novas.map((j) => `${j.nome} (${j.geral})`).join(", ")}.
            </p>
          )}
          <LojaCartasBase
            atuais={ATUAIS}
            tenho={new Set(sit.cartas.filter((j) => !ehLenda(j)).map((j) => j.id))}
            moedas={sit.moedas}
            onComprar={(id) => {
              const j = ATUAIS.find((x) => x.id === id);
              if (j && sit.moedas >= precoCartaBase(j)) acao(() => online.comprarBase(id));
            }}
            onVender={(id) => acao(() => online.venderBase(id))}
          />
        </>
      )}
    </section>
  );
}

/** Titulares e banco a salvar: o que o técnico escolheu ou, se vazio, a escolha automática. */
function completa(t: Time): [string[], string[]] {
  const tit = t.titulares.length ? t.titulares : escalar(t).map((v) => v.jogador.id);
  const banco = montarBanco(t, new Set(tit)).map((j) => j.id);
  return [tit, banco];
}

function timeDe(s: SituacaoOnline): Time {
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

function Entrar({ onEntrou }: { onEntrou: (u: Usuario) => void }) {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [criar, setCriar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valido = useMemo(() => nome.trim().length >= 3 && senha.length >= 6, [nome, senha]);
  return (
    <section className="tela online">
      <form
        className="entrar"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          try {
            onEntrou(await (criar ? online.registrar(nome.trim(), senha) : online.entrar(nome.trim(), senha)));
          } catch (err) {
            setErro((err as Error).message);
          }
        }}
      >
        <h2>{criar ? "Criar conta online" : "Entrar no modo online"}</h2>
        <p className="suave">
          O ranqueado coloca o seu time de cartas contra técnicos reais, ao vivo. Divisões de Bronze a Diamante e a
          Elite, com temporadas.
        </p>
        <label>
          Nome de técnico
          <input id="online-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="username" />
        </label>
        <label>
          Senha
          <input
            id="online-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={criar ? "new-password" : "current-password"}
          />
        </label>
        {erro && <p className="aviso">{erro}</p>}
        <button className="botao primario" disabled={!valido}>
          {criar ? "Criar conta" : "Entrar"}
        </button>
        <button type="button" className="link" onClick={() => setCriar((c) => !c)}>
          {criar ? "Já tenho conta" : "Não tenho conta: criar uma"}
        </button>
      </form>
    </section>
  );
}
