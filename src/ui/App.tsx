import { useEffect, useMemo, useState } from "react";
import { buscarJogadores, LENDAS_EMBUTIDAS } from "../data/api";
import { estiloEscudo, montarTimesAtuais, NIVEL } from "../data/clubes";
import { calcularTabela, chaveJogo, novaTemporada, premioFinal, simularRodada, type Temporada } from "../engine/campeonato";
import { FORMACOES } from "../engine/ratings";
import {
  carregarProgresso,
  copias,
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
  LIMITE_CARTAS_MAXIMO,
  PRECO_PACOTE,
  PREMIO,
  valorDeVenda,
} from "../engine/pacotes";
import {
  balancoDaRodada,
  criarOferta,
  financasIniciais,
  formatarDinheiro,
  lancar,
  podeComprar,
  precoDeCompra,
  premiacaoEmDinheiro,
  propostaPor,
  type Financas,
} from "../engine/mercado";
import { criarRng } from "../engine/rng";
import type { Jogador, ResultadoPartida, Time } from "../engine/types";
import { TelaCampeonato } from "./TelaCampeonato";
import { TelaElenco } from "./TelaElenco";
import { TelaEstoque } from "./TelaEstoque";
import { TelaLendas } from "./TelaLendas";
import { TelaMercado } from "./TelaMercado";
import { TelaNovoManager } from "./TelaNovoManager";
import { TelaPartida } from "./TelaPartida";

type Aba = "elenco" | "partida" | "campeonato" | "mercado" | "estoque" | "lendas";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "elenco", nome: "Elenco" },
  { id: "partida", nome: "Partida" },
  { id: "campeonato", nome: "Campeonato" },
  { id: "mercado", nome: "Mercado" },
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

const financasDoClube = (clubeId: string): Financas =>
  financasIniciais(montarTimesAtuais().find((t) => t.id === clubeId)!);

export function App() {
  const [aba, setAba] = useState<Aba>("elenco");
  const [progresso, setProgresso] = useState<Progresso>(() => {
    let p = carregarProgresso();
    // Saves antigos ganham o que faltar: temporada e finanças.
    if (p.manager && !p.temporada) p = { ...p, temporada: criarTemporada(ANO_INICIAL) };
    if (p.manager && !p.financas) p = { ...p, financas: financasDoClube(p.manager.clubeId) };
    return p;
  });
  const [confirmarNova, setConfirmarNova] = useState(false);
  const meuTimeId = progresso.manager?.clubeId ?? "";
  // Times atuais com as transferências da carreira; o do manager recebe a escalação salva.
  const times = useMemo(() => {
    const esc = progresso.escalacao;
    return montarTimesAtuais(progresso.transferencias).map((t) =>
      t.id === meuTimeId && esc
        ? {
            ...t,
            formacao: FORMACOES.find((f) => f.nome === esc.formacao) ?? t.formacao,
            titulares: esc.titulares,
          }
        : t,
    );
  }, [progresso.transferencias, progresso.escalacao, meuTimeId]);
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
  const oferta = useMemo(() => criarOferta(timesComLendas), [timesComLendas]);

  const atualizar = (t: Time) =>
    setProgresso((p) => ({ ...p, escalacao: { formacao: t.formacao.nome, titulares: t.titulares } }));
  /** Tira um jogador da escalação escolhida à mão (vendido ou devolvido ao estoque). */
  const semTitular = (p: Progresso, id: string): Progresso =>
    p.escalacao ? { ...p, escalacao: { ...p.escalacao, titulares: p.escalacao.titulares.filter((x) => x !== id) } } : p;

  const comprarJogador = (jogadorId: string) =>
    mudar((p) => {
      const dono = timesComLendas.find((t) => t.elenco.some((j) => j.id === jogadorId));
      const j = dono?.elenco.find((x) => x.id === jogadorId);
      if (!dono || !j || !p.financas || !meuTime || dono.id === meuTimeId) return p;
      if (podeComprar(j, dono, meuTime, p.financas.caixa, oferta)) return p;
      const preco = precoDeCompra(j, dono, oferta);
      const rodada = (p.temporada?.rodadaAtual ?? 0) + 1;
      return {
        ...p,
        transferencias: { ...p.transferencias, [jogadorId]: meuTimeId },
        financas: lancar(p.financas, [{ rodada, descricao: `Compra de ${j.nome} (${dono.sigla})`, valor: -preco }]),
      };
    });
  const venderJogador = (jogadorId: string) =>
    mudar((p) => {
      const j = meuTime?.elenco.find((x) => x.id === jogadorId);
      if (!j || !p.financas || !p.temporada) return p;
      const prop = propostaPor(j, meuTimeId, timesComLendas, NIVEL, p.temporada.rodadaAtual, p.temporada.seed, oferta);
      const comprador = mapaTimes.get(prop.clubeId)!;
      return semTitular(
        {
          ...p,
          transferencias: { ...p.transferencias, [jogadorId]: prop.clubeId },
          financas: lancar(p.financas, [
            { rodada: p.temporada.rodadaAtual + 1, descricao: `Venda de ${j.nome} (${comprador.sigla})`, valor: prop.valor },
          ]),
        },
        jogadorId,
      );
    });

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
        moedas: p.moedas + (j ? valorDeVenda(j, copias(p, j.id)) : 0),
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
    // Se era titular escolhido à mão, sai da escalação.
    mudar((p) =>
      semTitular(
        {
          ...p,
          estoque: [...p.estoque, id],
          noElenco: { ...p.noElenco, [meuTimeId]: (p.noElenco[meuTimeId] ?? []).filter((x) => x !== id) },
        },
        id,
      ),
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
      // Dinheiro da rodada: receitas, bilheteria em casa e salários.
      const emCasa = t.rodadas[t.rodadaAtual].some(([m]) => m === meuTimeId);
      let financas = p.financas && meuTime
        ? lancar(p.financas, balancoDaRodada(p.financas, meuTime, t.rodadaAtual + 1, emCasa))
        : p.financas;
      if (prox.rodadaAtual < prox.rodadas.length) return { ...p, temporada: prox, financas };
      const tabela = calcularTabela(prox, [...mapaTimes.keys()], new Map(timesComLendas.map((x) => [x.id, x.nome])));
      const posicao = tabela.findIndex((l) => l.id === meuTimeId) + 1;
      if (financas)
        financas = lancar(financas, [
          { rodada: 38, descricao: `Premiação: ${posicao}º lugar`, valor: premiacaoEmDinheiro(financas, posicao) },
        ]);
      return {
        ...p,
        temporada: prox,
        financas,
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
      financas: financasDoClube(clubeId),
    });
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
        <div className="moedas caixa" title="Caixa do clube, para contratar jogadores">
          <b>{formatarDinheiro(progresso.financas?.caixa ?? 0)}</b>
          <span className="suave">caixa</span>
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
          <span>Começar uma nova carreira apaga esta: campeonato, caixa, contratações, moedas, estoque e lendas.</span>
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
        {aba === "mercado" && progresso.financas && (
          <TelaMercado
            meuTime={meuTime}
            times={timesComLendas}
            financas={progresso.financas}
            temporada={temporada}
            onComprar={comprarJogador}
            onVender={venderJogador}
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
