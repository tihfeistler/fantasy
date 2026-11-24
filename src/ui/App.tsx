import { useEffect, useMemo, useState } from "react";
import { buscarJogadores, LENDAS_EMBUTIDAS } from "../data/api";
import { ATUAIS, estiloEscudo, montarTimesAtuais, NIVEL } from "../data/clubes";
import { DESAFIOS, kitInicial, montarTimeCartas, precoCartaBase, TIME_CARTAS_INICIAL, vendaCartaBase } from "../engine/desafios";
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
import {
  aceitaContraproposta,
  comTaxa,
  mercadoInicial,
  respostaSimulada,
  rodadaDoMercado,
  seedDoMercado,
} from "../engine/mercadoCartas";
import { criarRng } from "../engine/rng";
import { ehLenda, type Jogador, type ResultadoPartida, type Time } from "../engine/types";
import { TelaCampeonato } from "./TelaCampeonato";
import { TelaDesafios } from "./TelaDesafios";
import { TelaElenco } from "./TelaElenco";
import { TelaEstoque } from "./TelaEstoque";
import { TelaLendas } from "./TelaLendas";
import { TelaMercado } from "./TelaMercado";
import { TelaMercadoCartas } from "./TelaMercadoCartas";
import { TelaNovoManager } from "./TelaNovoManager";
import { TelaPartida } from "./TelaPartida";

type Aba = "elenco" | "partida" | "campeonato" | "mercado" | "desafios" | "estoque" | "lendas";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "elenco", nome: "Elenco" },
  { id: "partida", nome: "Partida" },
  { id: "campeonato", nome: "Campeonato" },
  { id: "mercado", nome: "Mercado" },
  { id: "desafios", nome: "Desafios" },
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

/** Time de cartas novo: caixa inicial e um kit de cartas base fracas. */
const timeCartasInicial = () => ({
  timeCartas: TIME_CARTAS_INICIAL,
  cartasBase: kitInicial(ATUAIS, (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0),
});

const financasDoClube = (clubeId: string): Financas =>
  financasIniciais(montarTimesAtuais().find((t) => t.id === clubeId)!);

export function App() {
  const [aba, setAba] = useState<Aba>("elenco");
  const [progresso, setProgresso] = useState<Progresso>(() => {
    let p = carregarProgresso();
    // Saves antigos ganham o que faltar: temporada e finanças.
    if (p.manager && !p.temporada) p = { ...p, temporada: criarTemporada(ANO_INICIAL) };
    if (p.manager && !p.financas) p = { ...p, financas: financasDoClube(p.manager.clubeId) };
    if (p.manager && !p.timeCartas) p = { ...p, ...timeCartasInicial() };
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
            banco: esc.banco,
          }
        : t,
    );
  }, [progresso.transferencias, progresso.escalacao, meuTimeId]);
  const [lendasLista, setLendasLista] = useState<Jogador[]>(LENDAS_EMBUTIDAS);
  const [pacoteAberto, setPacoteAberto] = useState<Jogador[] | null>(null);
  const [modoMercado, setModoMercado] = useState<"jogadores" | "cartas">("jogadores");
  const [avisoCartas, setAvisoCartas] = useState<string | null>(null);
  /** Contraproposta de um técnico simulado à sua oferta, esperando sua resposta. */
  const [contraDoVendedor, setContraDoVendedor] = useState<{ anuncioId: string; valor: number } | null>(null);
  const [avisoMercado, setAvisoMercado] = useState<string | null>(null);

  useEffect(() => salvarProgresso(progresso), [progresso]);
  // Sem lendas embutidas no build: busca na API PHP.
  useEffect(() => {
    if (lendasLista.length) return;
    buscarJogadores({ tipo: "classico" }).then(setLendasLista).catch(() => {});
  }, [lendasLista.length]);

  const lendas = useMemo(() => new Map(lendasLista.map((j) => [j.id, j])), [lendasLista]);
  // Mercado de cartas simulado: começa quando a carreira e as lendas existem.
  useEffect(() => {
    if (!progresso.manager || progresso.mercadoCartas || !lendas.size) return;
    setProgresso((p) =>
      p.mercadoCartas ? p : { ...p, mercadoCartas: mercadoInicial(lendas, p.temporada?.seed ?? Date.now() >>> 0) },
    );
  }, [progresso.manager, progresso.mercadoCartas, lendas]);

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

  // ---- Time de cartas e desafios ----
  const atuaisPorId = useMemo(() => new Map(ATUAIS.map((j) => [j.id, j])), []);
  const cartasBase = useMemo(() => new Set(progresso.cartasBase ?? []), [progresso.cartasBase]);
  const timeCartas = useMemo(() => {
    if (!progresso.timeCartas) return null;
    const base = [...cartasBase].map((id) => atuaisPorId.get(id)).filter(Boolean) as Jogador[];
    // Lendas suas: estoque e elenco do clube (cada lenda uma vez).
    const idsLendas = new Set([...progresso.estoque, ...(progresso.noElenco[meuTimeId] ?? [])]);
    const minhasLendas = [...idsLendas].map((id) => lendas.get(id)).filter(Boolean) as Jogador[];
    return montarTimeCartas(progresso.timeCartas, [...base, ...minhasLendas]);
  }, [progresso.timeCartas, progresso.estoque, progresso.noElenco, cartasBase, atuaisPorId, lendas, meuTimeId]);
  const mudarTimeCartas = (f: (tc: NonNullable<Progresso["timeCartas"]>) => NonNullable<Progresso["timeCartas"]>) =>
    mudar((p) => (p.timeCartas ? { ...p, timeCartas: f(p.timeCartas) } : p));
  const atualizarTimeCartas = (t: Time) =>
    mudarTimeCartas((tc) => ({ ...tc, formacao: t.formacao.nome, titulares: t.titulares, banco: t.banco }));
  const comprarBase = (id: string) =>
    mudar((p) => {
      const j = atuaisPorId.get(id);
      if (!j || (p.cartasBase ?? []).includes(id) || p.moedas < precoCartaBase(j)) return p;
      return { ...p, moedas: p.moedas - precoCartaBase(j), cartasBase: [...(p.cartasBase ?? []), id] };
    });
  const venderBase = (id: string) =>
    mudar((p) => {
      const j = atuaisPorId.get(id);
      if (!j || !(p.cartasBase ?? []).includes(id)) return p;
      return {
        ...p,
        moedas: p.moedas + vendaCartaBase(j),
        cartasBase: (p.cartasBase ?? []).filter((x) => x !== id),
        timeCartas: p.timeCartas && { ...p.timeCartas, titulares: p.timeCartas.titulares.filter((x) => x !== id) },
      };
    });
  const iniciarDesafio = (_id: string, custo: number) => {
    if (!progresso.timeCartas || progresso.timeCartas.caixa < custo) return false;
    mudarTimeCartas((tc) => ({ ...tc, caixa: tc.caixa - custo }));
    return true;
  };
  const concluirDesafio = (desafioId: string, r: ResultadoPartida, adversario: Time): string => {
    const d = DESAFIOS.find((x) => x.id === desafioId)!;
    const meus = r.mandanteId === "time-cartas" ? r.golsMandante : r.golsVisitante;
    const deles = r.mandanteId === "time-cartas" ? r.golsVisitante : r.golsMandante;
    const res = meus > deles ? "vitoria" : meus === deles ? "empate" : "derrota";
    const h = progresso.timeCartas?.desafios[desafioId];
    // Primeira vitória: uma lenda do adversário vai para o estoque.
    let carta: Jogador | null = null;
    if (res === "vitoria" && d.cartaNaPrimeiraVitoria && !h?.vitorias && totalCartas(progresso) < limiteCartas(progresso)) {
      const pool = adversario.elenco.filter(ehLenda);
      carta = pool[Math.floor(Math.random() * pool.length)] ?? null;
    }
    mudar((p) => ({
      ...p,
      moedas: p.moedas + d.moedas[res],
      estoque: carta ? [...p.estoque, carta.id] : p.estoque,
      timeCartas: p.timeCartas && {
        ...p.timeCartas,
        caixa: p.timeCartas.caixa + d.premio[res],
        desafios: {
          ...p.timeCartas.desafios,
          [desafioId]: {
            jogos: (p.timeCartas.desafios[desafioId]?.jogos ?? 0) + 1,
            vitorias: (p.timeCartas.desafios[desafioId]?.vitorias ?? 0) + (res === "vitoria" ? 1 : 0),
          },
        },
      },
    }));
    const titulo = res === "vitoria" ? "Vitória!" : res === "empate" ? "Empate." : "Derrota.";
    return `${titulo} Prêmio: ${formatarDinheiro(d.premio[res])} no caixa e ${d.moedas[res]} moedas.${
      carta ? ` E ${carta.nome} (${carta.geral}) foi para o seu estoque!` : ""
    }`;
  };

  const atualizar = (t: Time) =>
    setProgresso((p) => ({ ...p, escalacao: { formacao: t.formacao.nome, titulares: t.titulares, banco: t.banco } }));
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
  /** Pede mais do que a IA ofereceu. Uma tentativa por jogador por rodada. */
  const negociarVenda = (jogadorId: string, valor: number) => {
    const j = meuTime?.elenco.find((x) => x.id === jogadorId);
    const t = progresso.temporada;
    if (!j || !t || progresso.negociacoes?.[jogadorId] === t.rodadaAtual) return;
    const prop = propostaPor(j, meuTimeId, timesComLendas, NIVEL, t.rodadaAtual, t.seed, oferta);
    const comprador = mapaTimes.get(prop.clubeId)!;
    if (valor <= prop.teto) {
      setAvisoMercado(`O ${comprador.nome} aceitou: ${j.nome} vendido por ${formatarDinheiro(valor)}.`);
      venderJogador(jogadorId, valor);
    } else {
      setAvisoMercado(
        `O ${comprador.nome} não aceitou ${formatarDinheiro(valor)} por ${j.nome}. A proposta de ${formatarDinheiro(prop.valor)} continua até o fim da rodada.`,
      );
      mudar((p) => ({ ...p, negociacoes: { ...p.negociacoes, [jogadorId]: t.rodadaAtual } }));
    }
  };
  const venderJogador = (jogadorId: string, valorNegociado?: number) =>
    mudar((p) => {
      const j = meuTime?.elenco.find((x) => x.id === jogadorId);
      if (!j || !p.financas || !p.temporada) return p;
      const prop0 = propostaPor(j, meuTimeId, timesComLendas, NIVEL, p.temporada.rodadaAtual, p.temporada.seed, oferta);
      const prop = valorNegociado ? { ...prop0, valor: valorNegociado } : prop0;
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
  // ---- Mercado de cartas entre técnicos (simulado na prévia) ----
  const semEspacoCarta = totalCartas(progresso) >= limiteCartas(progresso);
  const rodadaAtual = (temporada?.rodadaAtual ?? 0) + 1;
  const anunciar = (i: number, preco: number) =>
    mudar((p) => {
      const m = p.mercadoCartas;
      const id = p.estoque[i];
      if (!m || !id) return p;
      return {
        ...p,
        estoque: p.estoque.filter((_, k) => k !== i),
        mercadoCartas: { ...m, meus: [...m.meus, { id: `m${m.proximoId}`, vendedor: "voce", jogadorId: id, preco }], proximoId: m.proximoId + 1 },
      };
    });
  const cancelarAnuncio = (anuncioId: string) =>
    mudar((p) => {
      const m = p.mercadoCartas;
      const a = m?.meus.find((x) => x.id === anuncioId);
      if (!m || !a) return p;
      return {
        ...p,
        estoque: [...p.estoque, a.jogadorId],
        mercadoCartas: {
          ...m,
          meus: m.meus.filter((x) => x.id !== anuncioId),
          recebidas: m.recebidas.filter((r) => r.anuncioId !== anuncioId),
        },
      };
    });
  /** Compra um anúncio de outro técnico, pelo preço anunciado ou pelo valor de uma proposta aceita. */
  const comprarCarta = (p: Progresso, anuncioId: string, valor: number, texto: string): Progresso => {
    const m = p.mercadoCartas!;
    const a = m.anuncios.find((x) => x.id === anuncioId)!;
    return {
      ...p,
      moedas: p.moedas - valor,
      estoque: [...p.estoque, a.jogadorId],
      mercadoCartas: {
        ...m,
        anuncios: m.anuncios.filter((x) => x.id !== anuncioId),
        movimentos: [{ rodada: rodadaAtual, texto, moedas: -valor }, ...m.movimentos].slice(0, 40),
      },
    };
  };
  const comprarAnuncio = (anuncioId: string) => {
    const a = progresso.mercadoCartas?.anuncios.find((x) => x.id === anuncioId);
    if (!a || progresso.moedas < a.preco || semEspacoCarta) return;
    const nome = lendas.get(a.jogadorId)?.nome ?? a.jogadorId;
    setAvisoCartas(`Você comprou ${nome} de ${a.vendedor} por ${a.preco} moedas. Ela está no seu estoque.`);
    mudar((p) => comprarCarta(p, anuncioId, a.preco, `Você comprou ${nome} de ${a.vendedor}`));
  };
  const propor = (anuncioId: string, valor: number) => {
    const p = progresso;
    const a = p.mercadoCartas?.anuncios.find((x) => x.id === anuncioId);
    if (!a || p.moedas < valor || totalCartas(p) >= limiteCartas(p)) return;
    const nome = lendas.get(a.jogadorId)?.nome ?? a.jogadorId;
    const r = respostaSimulada(a.preco, valor);
    setContraDoVendedor(null);
    if (r.tipo === "aceita") {
      setAvisoCartas(`${a.vendedor} aceitou sua proposta: ${nome} por ${valor} moedas.`);
      mudar((q) => comprarCarta(q, anuncioId, valor, `${a.vendedor} aceitou ${valor} por ${nome}`));
    } else if (r.tipo === "contra") {
      setAvisoCartas(null);
      setContraDoVendedor({ anuncioId, valor: r.valor });
    } else {
      setAvisoCartas(`${a.vendedor} recusou ${valor} moedas por ${nome}: muito abaixo dos ${a.preco} do anúncio.`);
    }
  };
  const responderContra = (aceitar: boolean) => {
    const c = contraDoVendedor;
    setContraDoVendedor(null);
    if (!c) return;
    const a = progresso.mercadoCartas?.anuncios.find((x) => x.id === c.anuncioId);
    if (!a) return;
    const nome = lendas.get(a.jogadorId)?.nome ?? a.jogadorId;
    if (!aceitar) {
      setAvisoCartas(`Você recusou a contraproposta de ${a.vendedor}. O anúncio continua em ${a.preco}.`);
      return;
    }
    if (progresso.moedas < c.valor || semEspacoCarta) return;
    setAvisoCartas(`Negócio fechado: ${nome} por ${c.valor} moedas.`);
    mudar((q) => comprarCarta(q, c.anuncioId, c.valor, `Você comprou ${nome} de ${a.vendedor} na contraproposta`));
  };
  /** Sua contraproposta a uma proposta recebida por carta anunciada. */
  const contrapropor = (propostaId: string, valor: number) => {
    const pr = progresso.mercadoCartas?.recebidas.find((x) => x.id === propostaId);
    if (!pr) return;
    const nome = lendas.get(pr.jogadorId)?.nome ?? pr.jogadorId;
    if (aceitaContraproposta(pr, valor)) {
      setAvisoCartas(`${pr.de} aceitou sua contraproposta: ${nome} vendido por ${valor} (você recebe ${comTaxa(valor)}).`);
      mudar((p) => venderPorProposta(p, propostaId, valor, `Você vendeu ${nome} para ${pr.de} por ${valor} na contraproposta (taxa de 5%)`));
    } else {
      setAvisoCartas(`${pr.de} achou ${valor} caro e desistiu de ${nome}. A carta continua anunciada.`);
      recusarProposta(propostaId);
    }
  };
  const venderPorProposta = (p: Progresso, propostaId: string, valor: number, texto: string): Progresso => {
    const m = p.mercadoCartas;
    const pr = m?.recebidas.find((x) => x.id === propostaId);
    if (!m || !pr) return p;
    const liquido = comTaxa(valor);
    return {
      ...p,
      moedas: p.moedas + liquido,
      mercadoCartas: {
        ...m,
        meus: m.meus.filter((x) => x.id !== pr.anuncioId),
        recebidas: m.recebidas.filter((x) => x.anuncioId !== pr.anuncioId),
        movimentos: [{ rodada: rodadaAtual, texto, moedas: liquido }, ...m.movimentos].slice(0, 40),
      },
    };
  };
  const aceitarProposta = (propostaId: string) => {
    const pr = progresso.mercadoCartas?.recebidas.find((x) => x.id === propostaId);
    if (!pr) return;
    const nome = lendas.get(pr.jogadorId)?.nome ?? pr.jogadorId;
    mudar((p) => venderPorProposta(p, propostaId, pr.valor, `Você vendeu ${nome} para ${pr.de} por ${pr.valor} (taxa de 5%)`));
  };
  const recusarProposta = (propostaId: string) =>
    mudar((p) =>
      p.mercadoCartas
        ? { ...p, mercadoCartas: { ...p.mercadoCartas, recebidas: p.mercadoCartas.recebidas.filter((x) => x.id !== propostaId) } }
        : p,
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
      // Os outros técnicos mexem no mercado de cartas a cada rodada.
      let moedasMercado = 0;
      let mercadoCartas = p.mercadoCartas;
      if (mercadoCartas && lendas.size) {
        const r = rodadaDoMercado(mercadoCartas, lendas, t.rodadaAtual + 1, criarRng(seedDoMercado(t.seed, t.rodadaAtual + 1)));
        mercadoCartas = r.mercado;
        moedasMercado = r.moedas;
      }
      p = { ...p, mercadoCartas, moedas: p.moedas + moedasMercado };
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
      ...timeCartasInicial(),
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
          <section className="tela">
            <div className="alternar mercado-modos" role="group" aria-label="Tipo de mercado">
              <button className={modoMercado === "jogadores" ? "ativo" : ""} onClick={() => setModoMercado("jogadores")}>
                Jogadores atuais
              </button>
              <button className={modoMercado === "cartas" ? "ativo" : ""} onClick={() => setModoMercado("cartas")}>
                Cartas de lendas
                {(progresso.mercadoCartas?.recebidas.length ?? 0) > 0 && (
                  <span className="contador">{progresso.mercadoCartas!.recebidas.length}</span>
                )}
              </button>
            </div>
            {modoMercado === "jogadores" ? (
              <TelaMercado
                meuTime={meuTime}
                times={timesComLendas}
                financas={progresso.financas}
                temporada={temporada}
                onComprar={comprarJogador}
                onVender={(id) => venderJogador(id)}
                onNegociar={negociarVenda}
                negociados={progresso.negociacoes ?? {}}
                aviso={avisoMercado}
              />
            ) : progresso.mercadoCartas ? (
              <TelaMercadoCartas
                mercado={progresso.mercadoCartas}
                lendas={lendas}
                moedas={progresso.moedas}
                semEspaco={semEspacoCarta}
                aviso={avisoCartas}
                onComprar={comprarAnuncio}
                onPropor={propor}
                onCancelar={cancelarAnuncio}
                onAceitar={aceitarProposta}
                onRecusar={recusarProposta}
                onContrapropor={contrapropor}
                contra={contraDoVendedor}
                onResponderContra={responderContra}
              />
            ) : (
              <p className="vazio-bloco">Carregando o mercado de cartas…</p>
            )}
          </section>
        )}
        {aba === "desafios" && timeCartas && progresso.timeCartas && (
          <section className="tela">
            <TelaDesafios
              timeCartas={progresso.timeCartas}
              meuTime={timeCartas}
              atuais={ATUAIS}
              lendas={lendasLista}
              cartasBase={cartasBase}
              moedas={progresso.moedas}
              onAtualizarTime={atualizarTimeCartas}
              onComprarBase={comprarBase}
              onVenderBase={venderBase}
              onIniciar={iniciarDesafio}
              onConcluir={concluirDesafio}
            />
          </section>
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
            onAnunciar={anunciar}
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
