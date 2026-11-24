import { useEffect, useMemo, useState } from "react";
import { buscarJogadores, LENDAS_EMBUTIDAS } from "../data/api";
import { estiloEscudo, montarTimesAtuais } from "../data/clubes";
import { calcularTabela, chaveJogo, novaTemporada, premioFinal, simularRodada, type Temporada } from "../engine/campeonato";
import { FORMACOES } from "../engine/ratings";
import {
  carregarProgresso,
  limiteCartas,
  PROGRESSO_INICIAL,
  salvarProgresso,
  totalCartas,
  type Progresso,
} from "../data/progresso";
import {
  abrirPacote,
  AMPLIACAO,
  CARTAS_POR_PACOTE,
  faixa,
  LIMITE_CARTAS_MAXIMO,
  PRECO_PACOTE,
  PREMIO,
  VALOR_VENDA,
} from "../engine/pacotes";
import { criarRng } from "../engine/rng";
import type { Jogador, ResultadoPartida, Time } from "../engine/types";
import { TelaCampeonato } from "./TelaCampeonato";
import { TelaElenco } from "./TelaElenco";
import { TelaEstoque } from "./TelaEstoque";
import { TelaLendas } from "./TelaLendas";
import { TelaNovoManager } from "./TelaNovoManager";
import { TelaPartida } from "./TelaPartida";

type Aba = "elenco" | "partida" | "campeonato" | "estoque" | "lendas";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "elenco", nome: "Elenco" },
  { id: "partida", nome: "Partida" },
  { id: "campeonato", nome: "Campeonato" },
  { id: "estoque", nome: "Estoque" },
  { id: "lendas", nome: "Lendas" },
];

const ANO_INICIAL = 2026;
const criarTemporada = (ano: number) =>
  novaTemporada(
    montarTimesAtuais().map((t) => t.id),
    ano,
    (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0,
  );

export function App() {
  // Times atuais; o do manager recebe a escalação salva.
  const [times, setTimes] = useState<Time[]>(() => {
    const p = carregarProgresso();
    return montarTimesAtuais().map((t) =>
      t.id === p.manager?.clubeId && p.escalacao
        ? {
            ...t,
            formacao: FORMACOES.find((f) => f.nome === p.escalacao!.formacao) ?? t.formacao,
            titulares: p.escalacao.titulares,
          }
        : t,
    );
  });
  const [aba, setAba] = useState<Aba>("elenco");
  const [progresso, setProgresso] = useState<Progresso>(() => {
    const p = carregarProgresso();
    // Saves antigos (sem campeonato) ganham uma temporada nova.
    return p.manager && !p.temporada ? { ...p, temporada: criarTemporada(ANO_INICIAL) } : p;
  });
  const [confirmarNova, setConfirmarNova] = useState(false);
  const meuTimeId = progresso.manager?.clubeId ?? "";
  const [lendasLista, setLendasLista] = useState<Jogador[]>(LENDAS_EMBUTIDAS);
  const [pacoteAberto, setPacoteAberto] = useState<Jogador[] | null>(null);

  useEffect(() => salvarProgresso(progresso), [progresso]);
  // Sem lendas embutidas no build: busca na API PHP.
  useEffect(() => {
    if (lendasLista.length) return;
    buscarJogadores({ tipo: "classico" }).then(setLendasLista).catch(() => {});
  }, [lendasLista.length]);

  const lendas = useMemo(() => new Map(lendasLista.map((j) => [j.id, j])), [lendasLista]);

  // O elenco de cada clube = jogadores atuais + lendas levadas do estoque.
  const timesComLendas = useMemo(
    () =>
      times.map((t) => {
        const extras = (progresso.noElenco[t.id] ?? []).map((id) => lendas.get(id)).filter(Boolean) as Jogador[];
        return extras.length ? { ...t, elenco: [...t.elenco, ...extras] } : t;
      }),
    [times, progresso.noElenco, lendas],
  );
  const meuTime = timesComLendas.find((t) => t.id === meuTimeId);
  const mapaTimes = useMemo(() => new Map(timesComLendas.map((t) => [t.id, t])), [timesComLendas]);
  const temporada = progresso.temporada;

  const atualizar = (t: Time) => {
    setTimes((ts) => ts.map((x) => (x.id === t.id ? { ...t, elenco: x.elenco } : x)));
    setProgresso((p) => ({ ...p, escalacao: { formacao: t.formacao.nome, titulares: t.titulares } }));
  };

  const mudar = (f: (p: Progresso) => Progresso) => setProgresso((p) => f(p));

  const comprarPacote = () => {
    if (progresso.moedas < PRECO_PACOTE || !lendasLista.length) return;
    if (totalCartas(progresso) + CARTAS_POR_PACOTE > limiteCartas(progresso)) return;
    const cartas = abrirPacote(lendasLista, criarRng(Date.now() ^ (Math.random() * 2 ** 31)));
    mudar((p) => ({ ...p, moedas: p.moedas - PRECO_PACOTE, estoque: [...p.estoque, ...cartas.map((c) => c.id)] }));
    setPacoteAberto(cartas);
  };
  const ampliar = () =>
    mudar((p) =>
      p.moedas < AMPLIACAO.preco || limiteCartas(p) >= LIMITE_CARTAS_MAXIMO
        ? p
        : { ...p, moedas: p.moedas - AMPLIACAO.preco, limiteCartas: limiteCartas(p) + AMPLIACAO.cartas },
    );
  const vender = (i: number) =>
    mudar((p) => {
      const j = lendas.get(p.estoque[i]);
      return {
        ...p,
        moedas: p.moedas + (j ? VALOR_VENDA[faixa(j)] : 0),
        estoque: p.estoque.filter((_, k) => k !== i),
      };
    });
  const levar = (i: number) =>
    mudar((p) => {
      const id = p.estoque[i];
      const atual = p.noElenco[meuTimeId] ?? [];
      if (atual.includes(id)) return p;
      return {
        ...p,
        estoque: p.estoque.filter((_, k) => k !== i),
        noElenco: { ...p.noElenco, [meuTimeId]: [...atual, id] },
      };
    });
  const devolver = (id: string) => {
    mudar((p) => ({
      ...p,
      estoque: [...p.estoque, id],
      noElenco: { ...p.noElenco, [meuTimeId]: (p.noElenco[meuTimeId] ?? []).filter((x) => x !== id) },
    }));
    // Se era titular escolhido à mão, sai da escalação.
    setTimes((ts) =>
      ts.map((t) => (t.id === meuTimeId ? { ...t, titulares: t.titulares.filter((x) => x !== id) } : t)),
    );
  };
  /** Fim do jogo do manager: grava o placar, simula o resto da rodada e paga o prêmio. */
  const fimDoJogo = (r: ResultadoPartida) => {
    const premio = premiar(r);
    mudar((p) => {
      const t = p.temporada;
      if (!t) return p;
      const i = t.rodadas[t.rodadaAtual].findIndex(([m, v]) => m === r.mandanteId && v === r.visitanteId);
      if (i < 0) return p;
      const comMeu: Temporada = {
        ...t,
        placares: { ...t.placares, [chaveJogo(t.rodadaAtual, i)]: [r.golsMandante, r.golsVisitante] },
      };
      return { ...p, temporada: simularRodada(comMeu, mapaTimes) };
    });
    return premio;
  };
  const avancar = () => {
    mudar((p) => {
      const t = p.temporada;
      if (!t) return p;
      // Garante a rodada completa mesmo que algo tenha ficado sem placar.
      const feita = simularRodada(t, mapaTimes);
      const prox = { ...feita, rodadaAtual: feita.rodadaAtual + 1 };
      if (prox.rodadaAtual < prox.rodadas.length) return { ...p, temporada: prox };
      const tabela = calcularTabela(prox, [...mapaTimes.keys()], new Map(timesComLendas.map((x) => [x.id, x.nome])));
      const posicao = tabela.findIndex((l) => l.id === meuTimeId) + 1;
      return {
        ...p,
        temporada: prox,
        moedas: p.moedas + premioFinal(posicao),
        historico: [...(p.historico ?? []), { ano: prox.ano, posicao, campeao: tabela[0].id }],
      };
    });
    // Fim do campeonato: mostra a tabela final.
    if (temporada && temporada.rodadaAtual + 1 >= temporada.rodadas.length) setAba("campeonato");
  };
  const novaTemporadaDoManager = () => {
    mudar((p) => ({ ...p, temporada: criarTemporada((p.temporada?.ano ?? ANO_INICIAL - 1) + 1) }));
    setAba("partida");
  };

  const premiar = (r: ResultadoPartida) => {
    const meus = r.mandanteId === meuTimeId ? r.golsMandante : r.golsVisitante;
    const deles = r.mandanteId === meuTimeId ? r.golsVisitante : r.golsMandante;
    const premio = meus > deles ? PREMIO.vitoria : meus === deles ? PREMIO.empate : PREMIO.derrota;
    mudar((p) => ({ ...p, moedas: p.moedas + premio }));
    return premio;
  };

  const criarManager = (nome: string, clubeId: string) => {
    setProgresso({
      ...PROGRESSO_INICIAL,
      manager: { nome, clubeId, criadoEm: new Date().toISOString().slice(0, 10) },
      temporada: criarTemporada(ANO_INICIAL),
    });
    setTimes(montarTimesAtuais());
    setAba("elenco");
  };
  const novaCarreira = () => {
    setProgresso(PROGRESSO_INICIAL);
    setConfirmarNova(false);
  };

  if (!progresso.manager || !meuTime || !temporada) {
    return (
      <div className="app">
        <TelaNovoManager times={times} onCriar={criarManager} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          Fantasy<span>Manager</span>
        </div>
        <div className="clube">
          <span className="escudo" style={estiloEscudo(meuTime.cor)}>
            {meuTime.sigla}
          </span>
          <span className="clube-info">
            <b>{meuTime.nome}</b>
            <span className="suave">Técnico: {progresso.manager.nome}</span>
          </span>
        </div>
        <div className="moedas" title="Moedas para abrir pacotes">
          <span className="moeda" aria-hidden="true" />
          <b>{progresso.moedas.toLocaleString("pt-BR")}</b>
          <span className="suave">moedas</span>
        </div>
        <nav>
          {ABAS.map((a) => (
            <button key={a.id} className={aba === a.id ? "ativo" : ""} onClick={() => setAba(a.id)}>
              {a.nome}
              {a.id === "estoque" && progresso.estoque.length > 0 && (
                <span className="contador">{progresso.estoque.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>
      {confirmarNova && (
        <div className="aviso aviso-acao">
          <span>Começar uma nova carreira apaga esta: moedas, estoque e lendas no elenco.</span>
          <button className="botao" onClick={() => setConfirmarNova(false)}>
            Cancelar
          </button>
          <button className="botao perigo" onClick={novaCarreira}>
            Apagar e começar de novo
          </button>
        </div>
      )}
      <main>
        {aba === "elenco" && <TelaElenco time={meuTime} onChange={atualizar} />}
        {aba === "partida" &&
          (temporada.rodadaAtual < temporada.rodadas.length ? (
            <TelaPartida
              meuTime={meuTime}
              times={mapaTimes}
              temporada={temporada}
              onFim={fimDoJogo}
              onAvancar={avancar}
            />
          ) : (
            <section className="tela">
              <p className="vazio-partida">
                O Brasileirão {temporada.ano} acabou.{" "}
                <button className="link-nome" onClick={() => setAba("campeonato")}>
                  Veja a tabela final
                </button>{" "}
                e comece a próxima temporada.
              </p>
            </section>
          ))}
        {aba === "campeonato" && (
          <TelaCampeonato
            meuTime={meuTime}
            times={mapaTimes}
            temporada={temporada}
            onNovaTemporada={novaTemporadaDoManager}
          />
        )}
        {aba === "estoque" && (
          <TelaEstoque
            progresso={progresso}
            lendas={lendas}
            meuTime={meuTime}
            pacoteAberto={pacoteAberto}
            onFecharPacote={() => setPacoteAberto(null)}
            onComprar={comprarPacote}
            onAmpliar={ampliar}
            onVender={vender}
            onLevar={levar}
            onDevolver={devolver}
          />
        )}
        {aba === "lendas" && <TelaLendas />}
      </main>
      <footer className="rodape">
        Carreira de {progresso.manager.nome} no {meuTime.nome}, desde {progresso.manager.criadoEm.split("-").reverse().join("/")}.
        {!confirmarNova && (
          <button className="link-nome" onClick={() => setConfirmarNova(true)}>
            Nova carreira
          </button>
        )}
      </footer>
    </div>
  );
}
