import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buscarJogadores, LENDAS_EMBUTIDAS } from "../data/api";
import {
  ATUAIS,
  CLUBES,
  clubesDaDivisao,
  DIVISOES_INICIAIS,
  estiloEscudo,
  montarTimesAtuais,
  NIVEL,
} from "../data/clubes";
import {
  DESAFIOS,
  kitInicial,
  montarTimeCartas,
  precoCartaBase,
  TIME_CARTAS_INICIAL,
  vendaCartaBase,
} from "../engine/desafios";
import {
  calcularTabela,
  chaveJogo,
  divisaoDe,
  idsDaTemporada,
  jogarRodada,
  novaTemporada,
  premioFinal,
  simularRodada,
  trocarDivisoes,
  type Divisao,
  type Temporada,
} from "../engine/campeonato";
import { FORMACOES } from "../engine/ratings";
import {
  contratosTerminando,
  destinoDaSaida,
  folhaComContratos,
  negociarContrato,
  type Contrato,
} from "../engine/contratos";
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
  dividaDaRodada,
  financasAoMudarDeDivisao,
  PONTOS_DE_PUNICAO,
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
import {
  ehLenda,
  type Jogador,
  type ResultadoPartida,
  type Time,
} from "../engine/types";
import { Icone, type NomeIcone } from "./Icones";
import { Lobby, type Modo } from "./Lobby";
import { TelaCampeonato } from "./TelaCampeonato";
import { TelaEscritorio, type AbaCarreira } from "./TelaEscritorio";
import { TelaFinancas } from "./TelaFinancas";
import { TelaDesafios } from "./TelaDesafios";
import { TelaElenco } from "./TelaElenco";
import { TelaEstoque } from "./TelaEstoque";
import { TelaLendas } from "./TelaLendas";
import {
  TelaMercado,
  type ModoMercado,
  type RespostaDoJogador,
} from "./TelaMercado";
import { TelaMercadoCartas } from "./TelaMercadoCartas";
import { TelaNovoManager } from "./TelaNovoManager";
import { TelaInicio } from "./TelaInicio";
import { completa, Entrar, TelaOnline, timeDe } from "./TelaOnline";
import { LojaCartasBase } from "./LojaCartasBase";
import { TelaMercadoOnline } from "./TelaMercadoOnline";
import { conta, pendentes, type EstadoCarreira } from "../data/conta";
import { online, type SituacaoOnline, type Usuario } from "../data/online";
import { TelaPartida } from "./TelaPartida";

type AbaColecao = "estoque" | "base" | "cartas" | "lendas";
type AbaRanqueado = "ranqueado" | "time";
const ABAS_RANQUEADO: { id: AbaRanqueado; nome: string; icone: NomeIcone }[] = [
  { id: "ranqueado", nome: "Ranqueado", icone: "online" },
  { id: "time", nome: "Time de cartas", icone: "elenco" },
];
const ABAS_CARREIRA: { id: AbaCarreira; nome: string; icone: NomeIcone }[] = [
  { id: "escritorio", nome: "Escritório", icone: "escritorio" },
  { id: "elenco", nome: "Elenco e tática", icone: "elenco" },
  { id: "partida", nome: "Partida", icone: "partida" },
  { id: "campeonato", nome: "Campeonato", icone: "campeonato" },
  { id: "mercado", nome: "Mercado", icone: "mercado" },
  { id: "financas", nome: "Finanças", icone: "financas" },
];
const ABAS_COLECAO: { id: AbaColecao; nome: string; icone: NomeIcone }[] = [
  { id: "estoque", nome: "Estoque e pacotes", icone: "estoque" },
  { id: "base", nome: "Cartas base", icone: "colecao" },
  { id: "cartas", nome: "Mercado de lendas", icone: "mercado" },
  { id: "lendas", nome: "Álbum de lendas", icone: "lendas" },
];
const TITULO_MODO: Record<Modo, string> = {
  carreira: "Carreira",
  desafios: "Desafios",
  ranqueado: "Ranqueado",
  colecao: "Coleção",
};

const ANO_INICIAL = 2026;
const novaSeed = () => (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0;
const criarTemporada = (
  ano: number,
  divisoes: Record<string, Divisao>,
  d: Divisao,
) => novaTemporada(clubesDaDivisao(divisoes, d), ano, novaSeed(), d);
const outraDivisao = (d: Divisao): Divisao => (d === "A" ? "B" : "A");

/** Time de cartas novo: caixa inicial e um kit de cartas base fracas. */
const timeCartasInicial = () => ({
  timeCartas: TIME_CARTAS_INICIAL,
  cartasBase: kitInicial(
    ATUAIS,
    (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0,
  ),
});

const financasDoClube = (clubeId: string): Financas =>
  financasIniciais(montarTimesAtuais().find((t) => t.id === clubeId)!);

/** Lendas da conta que não estão no elenco da carreira (uma entrada por cópia). */
function estoqueDaConta(s: SituacaoOnline, noElenco: string[] = []): string[] {
  const usadas = [...noElenco];
  const r: string[] = [];
  for (const j of s.cartas)
    if (ehLenda(j))
      for (let k = 0; k < j.copias; k++) {
        const i = usadas.indexOf(j.id);
        if (i >= 0) usadas.splice(i, 1);
        else r.push(j.id);
      }
  return r;
}
const somaPendente = (p: Progresso, seq: number) =>
  pendentes(p, seq).reduce(
    (a, l) => ({ caixa: a.caixa + l.valor, moedas: a.moedas + (l.moedas ?? 0) }),
    { caixa: 0, moedas: 0 },
  );
/** Carreira vinda do servidor, com o caixa, as moedas e o estoque da conta. */
function daConta(c: EstadoCarreira, s: SituacaoOnline | null): Progresso {
  const d = c.dados!;
  const clube = d.manager?.clubeId ?? "";
  return {
    ...PROGRESSO_INICIAL,
    ...d,
    moedas: c.moedas,
    financas: d.financas && { ...d.financas, caixa: c.caixa },
    estoque: s ? estoqueDaConta(s, d.noElenco?.[clube]) : [],
    limiteCartas: s?.limiteCartas,
    mercadoCartas: undefined,
    noElenco: d.noElenco && !Array.isArray(d.noElenco) ? d.noElenco : {},
  };
}

export function App() {
  const [aba, setAbaCarreira] = useState<AbaCarreira>("escritorio");
  const [modo, setModo] = useState<Modo | "menu">("menu");
  const [abaColecao, setAbaColecao] = useState<AbaColecao>("estoque");
  const [abaRanqueado, setAbaRanqueado] = useState<AbaRanqueado>("ranqueado");
  // ---- Conta: o jogo todo fica no servidor; sem servidor, só a demonstração local ----
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [servidorFora, setServidorFora] = useState(false);
  // A prévia publicada (sem servidor) liga a demonstração direto.
  const [demo, setDemo] = useState(() => !!(globalThis as { FANTASY_DEMO?: boolean }).FANTASY_DEMO);
  const [sit, setSit] = useState<SituacaoOnline | null>(null);
  const [avisoConta, setAvisoConta] = useState<string | null>(null);
  /** Último lançamento que o servidor confirmou. */
  const seqConfirmado = useRef(0);
  const ultimoEnvio = useRef("");
  const naConta = !!usuario && !demo;
  /** Abre uma tela da carreira (de qualquer lugar). */
  const setAba = (a: AbaCarreira) => {
    setModo("carreira");
    setAbaCarreira(a);
    window.scrollTo?.(0, 0);
  };
  const irColecao = (a: AbaColecao) => {
    setModo("colecao");
    setAbaColecao(a);
  };
  const [progresso, setProgresso] = useState<Progresso>(() => {
    let p = carregarProgresso();
    // Saves antigos ganham o que faltar: temporada, a outra divisão e finanças.
    if (p.manager && !p.temporada)
      p = {
        ...p,
        temporada: criarTemporada(
          ANO_INICIAL,
          DIVISOES_INICIAIS,
          DIVISOES_INICIAIS[p.manager.clubeId],
        ),
      };
    if (p.manager && p.temporada && !p.outraTemporada)
      p = {
        ...p,
        // Começa na rodada 0 e alcança a do manager na próxima rodada jogada.
        outraTemporada: criarTemporada(
          p.temporada.ano,
          p.divisoes ?? DIVISOES_INICIAIS,
          outraDivisao(divisaoDe(p.temporada)),
        ),
      };
    if (p.manager && !p.financas)
      p = { ...p, financas: financasDoClube(p.manager.clubeId) };
    if (p.manager && !p.timeCartas) p = { ...p, ...timeCartasInicial() };
    // Caixa único: o caixa do antigo time de cartas entra no do clube, uma vez.
    if (p.manager && p.financas && !p.caixaUnico)
      p = {
        ...p,
        caixaUnico: true,
        financas: { ...p.financas, caixa: p.financas.caixa + (p.timeCartas?.caixa ?? 0) },
      };
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
            formacao:
              FORMACOES.find((f) => f.nome === esc.formacao) ?? t.formacao,
            titulares: esc.titulares,
            banco: esc.banco,
          }
        : t,
    );
  }, [progresso.transferencias, progresso.escalacao, meuTimeId]);
  const [lendasLista, setLendasLista] = useState<Jogador[]>(LENDAS_EMBUTIDAS);
  const [pacoteAberto, setPacoteAberto] = useState<Jogador[] | null>(null);
  const [modoMercadoJogadores, setModoMercadoJogadores] =
    useState<ModoMercado>("comprar");
  const [avisoCartas, setAvisoCartas] = useState<string | null>(null);
  /** Contraproposta de um técnico simulado à sua oferta, esperando sua resposta. */
  const [contraDoVendedor, setContraDoVendedor] = useState<{
    anuncioId: string;
    valor: number;
  } | null>(null);
  const [avisoMercado, setAvisoMercado] = useState<string | null>(null);

  useEffect(() => {
    if (demo) salvarProgresso(progresso);
  }, [progresso, demo]);

  /** Situação da conta (moedas, cartas, time de cartas) e o estoque da carreira que sai dela. */
  const aplicarSit = useCallback((s: SituacaoOnline) => {
    setSit(s);
    setProgresso((p) => ({
      ...p,
      moedas: s.moedas + somaPendente(p, seqConfirmado.current).moedas,
      estoque: estoqueDaConta(s, p.noElenco[p.manager?.clubeId ?? ""]),
      limiteCartas: s.limiteCartas,
    }));
  }, []);
  const entrarNaConta = useCallback(async (u: Usuario) => {
    try {
      const [s, c] = await Promise.all([online.situacao(), conta.carregar()]);
      seqConfirmado.current = c.seq;
      ultimoEnvio.current = "";
      setSit(s);
      setProgresso(c.dados ? daConta(c, s) : { ...PROGRESSO_INICIAL, moedas: c.moedas });
      setUsuario(u);
      setModo("menu");
    } catch (e) {
      setAvisoConta((e as Error).message);
      setUsuario(null);
    }
  }, []);
  useEffect(() => {
    if (demo) return;
    online.eu().then(
      (u) => (u ? entrarNaConta(u) : setUsuario(null)),
      (e) => (e.status === 0 ? setServidorFora(true) : setUsuario(null)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrarNaConta]);
  /** Atualiza caixa, moedas e cartas que mudaram fora da carreira (ranqueado, mercado). */
  const atualizarConta = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([online.situacao(), conta.carregar()]);
      setSit(s);
      setProgresso((p) => {
        if (!p.manager || c.seq > seqConfirmado.current) return c.dados ? daConta(c, s) : p;
        const pend = somaPendente(p, seqConfirmado.current);
        return {
          ...p,
          moedas: c.moedas + pend.moedas,
          financas: p.financas && { ...p.financas, caixa: c.caixa + pend.caixa },
          estoque: estoqueDaConta(s, p.noElenco[p.manager.clubeId]),
          limiteCartas: s.limiteCartas,
        };
      });
    } catch {
      /* tenta de novo na próxima troca de tela */
    }
  }, []);
  useEffect(() => {
    if (naConta) atualizarConta();
  }, [modo, naConta, atualizarConta]);
  // Salva a carreira na conta e manda os lançamentos novos; o servidor devolve o caixa e as moedas que valem.
  useEffect(() => {
    if (!naConta || !progresso.manager || !progresso.financas) return;
    const id = setTimeout(async () => {
      const novos = pendentes(progresso, seqConfirmado.current);
      const chave = JSON.stringify({ ...progresso, moedas: 0, estoque: [], financas: { ...progresso.financas, caixa: 0 } });
      if (!novos.length && chave === ultimoEnvio.current) return;
      ultimoEnvio.current = chave;
      try {
        const r = await conta.salvar(progresso, novos);
        seqConfirmado.current = Math.max(seqConfirmado.current, r.seq);
        if (r.recusados.length)
          setAvisoConta(
            `O servidor não aceitou ${r.recusados.length} lançamento${r.recusados.length > 1 ? "s" : ""} e corrigiu o caixa.`,
          );
        if (novos.some((l) => l.carta)) atualizarConta();
        if (r.corrigido) {
          const c = await conta.carregar();
          setProgresso(daConta(c, sit));
          return;
        }
        setProgresso((p) => {
          const pend = somaPendente(p, seqConfirmado.current);
          return {
            ...p,
            moedas: r.moedas + pend.moedas,
            financas: p.financas && { ...p.financas, caixa: r.caixa + pend.caixa },
          };
        });
      } catch (e) {
        ultimoEnvio.current = "";
        setAvisoConta(`Não deu para salvar na conta: ${(e as Error).message}`);
      }
    }, 700);
    return () => clearTimeout(id);
  }, [progresso, naConta, sit, atualizarConta]);
  // Sem lendas embutidas no build: busca na API PHP.
  useEffect(() => {
    if (lendasLista.length) return;
    buscarJogadores({ tipo: "classico" })
      .then(setLendasLista)
      .catch(() => {});
  }, [lendasLista.length]);

  const lendas = useMemo(
    () => new Map(lendasLista.map((j) => [j.id, j])),
    [lendasLista],
  );
  // Mercado de cartas simulado: começa quando a carreira e as lendas existem.
  useEffect(() => {
    if (!demo || !progresso.manager || progresso.mercadoCartas || !lendas.size) return;
    setProgresso((p) =>
      p.mercadoCartas
        ? p
        : {
            ...p,
            mercadoCartas: mercadoInicial(
              lendas,
              p.temporada?.seed ?? Date.now() >>> 0,
            ),
          },
    );
  }, [progresso.manager, progresso.mercadoCartas, lendas, demo]);

  // O elenco de cada clube = jogadores atuais + lendas levadas do estoque.
  const timesComLendas = useMemo(
    () =>
      times.map((t) => {
        const extras = (progresso.noElenco[t.id] ?? [])
          .map((id) => lendas.get(id))
          .filter(Boolean) as Jogador[];
        return extras.length ? { ...t, elenco: [...t.elenco, ...extras] } : t;
      }),
    [times, progresso.noElenco, lendas],
  );
  const meuTime = timesComLendas.find((t) => t.id === meuTimeId);
  const mapaTimes = useMemo(
    () => new Map(timesComLendas.map((t) => [t.id, t])),
    [timesComLendas],
  );
  const temporada = progresso.temporada;
  const oferta = useMemo(() => criarOferta(timesComLendas), [timesComLendas]);

  // ---- Time de cartas e desafios ----
  const atuaisPorId = useMemo(() => new Map(ATUAIS.map((j) => [j.id, j])), []);
  const cartasBase = useMemo(
    () => new Set(progresso.cartasBase ?? []),
    [progresso.cartasBase],
  );
  const timeCartas = useMemo(() => {
    if (!progresso.timeCartas) return null;
    const base = [...cartasBase]
      .map((id) => atuaisPorId.get(id))
      .filter(Boolean) as Jogador[];
    // Lendas suas: estoque e elenco do clube (cada lenda uma vez).
    const idsLendas = new Set([
      ...progresso.estoque,
      ...(progresso.noElenco[meuTimeId] ?? []),
    ]);
    const minhasLendas = [...idsLendas]
      .map((id) => lendas.get(id))
      .filter(Boolean) as Jogador[];
    return montarTimeCartas(progresso.timeCartas, [...base, ...minhasLendas]);
  }, [
    progresso.timeCartas,
    progresso.estoque,
    progresso.noElenco,
    cartasBase,
    atuaisPorId,
    lendas,
    meuTimeId,
  ]);
  const mudarTimeCartas = (
    f: (
      tc: NonNullable<Progresso["timeCartas"]>,
    ) => NonNullable<Progresso["timeCartas"]>,
  ) => mudar((p) => (p.timeCartas ? { ...p, timeCartas: f(p.timeCartas) } : p));
  const atualizarTimeCartas = (t: Time) =>
    mudarTimeCartas((tc) => ({
      ...tc,
      formacao: t.formacao.nome,
      titulares: t.titulares,
      banco: t.banco,
    }));
  const comprarBase = (id: string) =>
    mudar((p) => {
      const j = atuaisPorId.get(id);
      if (
        !j ||
        (p.cartasBase ?? []).includes(id) ||
        p.moedas < precoCartaBase(j)
      )
        return p;
      return {
        ...p,
        moedas: p.moedas - precoCartaBase(j),
        cartasBase: [...(p.cartasBase ?? []), id],
      };
    });
  const venderBase = (id: string) =>
    mudar((p) => {
      const j = atuaisPorId.get(id);
      if (!j || !(p.cartasBase ?? []).includes(id)) return p;
      return {
        ...p,
        moedas: p.moedas + vendaCartaBase(j),
        cartasBase: (p.cartasBase ?? []).filter((x) => x !== id),
        timeCartas: p.timeCartas && {
          ...p.timeCartas,
          titulares: p.timeCartas.titulares.filter((x) => x !== id),
        },
      };
    });
  /** Desafios usam o caixa único do clube (e da conta, quando logado). */
  const iniciarDesafio = (id: string, custo: number) => {
    if (!progresso.financas || progresso.financas.caixa < custo) return false;
    const d = DESAFIOS.find((x) => x.id === id);
    mudar((p) =>
      p.financas
        ? {
            ...p,
            financas: lancar(p.financas, [
              {
                rodada: 0,
                descricao: `Desafio ${d?.nome ?? id}: salários`,
                valor: -custo,
                tipo: "desafio-custo",
                ref: id,
              },
            ]),
          }
        : p,
    );
    return true;
  };
  const concluirDesafio = (
    desafioId: string,
    r: ResultadoPartida,
    adversario: Time,
  ): string => {
    const d = DESAFIOS.find((x) => x.id === desafioId)!;
    const idCartas = naConta && sit ? sit.usuario.timeId : "time-cartas";
    const meus = r.mandanteId === idCartas ? r.golsMandante : r.golsVisitante;
    const deles = r.mandanteId === idCartas ? r.golsVisitante : r.golsMandante;
    const res =
      meus > deles ? "vitoria" : meus === deles ? "empate" : "derrota";
    const h = progresso.timeCartas?.desafios[desafioId];
    // Primeira vitória: uma lenda do adversário vai para o estoque.
    let carta: Jogador | null = null;
    if (
      res === "vitoria" &&
      d.cartaNaPrimeiraVitoria &&
      !h?.vitorias &&
      totalCartas(progresso) < limiteCartas(progresso)
    ) {
      const pool = adversario.elenco.filter(ehLenda);
      carta = pool[Math.floor(Math.random() * pool.length)] ?? null;
    }
    mudar((p) => ({
      ...p,
      moedas: p.moedas + d.moedas[res],
      // Na conta, a carta vai pelo servidor (junto com o prêmio) e aparece no estoque depois.
      estoque: carta && !naConta ? [...p.estoque, carta.id] : p.estoque,
      financas:
        p.financas &&
        lancar(p.financas, [
          {
            rodada: 0,
            descricao: `Desafio ${d.nome}: prêmio`,
            valor: d.premio[res],
            moedas: d.moedas[res],
            carta: carta?.id,
            tipo: "desafio-premio",
            ref: desafioId,
          },
        ]),
      timeCartas: p.timeCartas && {
        ...p.timeCartas,
        desafios: {
          ...p.timeCartas.desafios,
          [desafioId]: {
            jogos: (p.timeCartas.desafios[desafioId]?.jogos ?? 0) + 1,
            vitorias:
              (p.timeCartas.desafios[desafioId]?.vitorias ?? 0) +
              (res === "vitoria" ? 1 : 0),
          },
        },
      },
    }));
    const titulo =
      res === "vitoria"
        ? "Vitória!"
        : res === "empate"
          ? "Empate."
          : "Derrota.";
    return `${titulo} Prêmio: ${formatarDinheiro(d.premio[res])} no caixa e ${d.moedas[res]} moedas.${
      carta ? ` E ${carta.nome} (${carta.geral}) foi para o seu estoque!` : ""
    }`;
  };

  const atualizar = (t: Time) =>
    setProgresso((p) => ({
      ...p,
      escalacao: {
        formacao: t.formacao.nome,
        titulares: t.titulares,
        banco: t.banco,
      },
    }));
  /** Tira um jogador da escalação escolhida à mão (vendido ou devolvido ao estoque). */
  const semTitular = (p: Progresso, id: string): Progresso =>
    p.escalacao
      ? {
          ...p,
          escalacao: {
            ...p.escalacao,
            titulares: p.escalacao.titulares.filter((x) => x !== id),
          },
        }
      : p;

  const comprarJogador = (jogadorId: string, contrato: Contrato) =>
    mudar((p) => {
      const dono = timesComLendas.find((t) =>
        t.elenco.some((j) => j.id === jogadorId),
      );
      const j = dono?.elenco.find((x) => x.id === jogadorId);
      if (!dono || !j || !p.financas || !meuTime || dono.id === meuTimeId)
        return p;
      if (podeComprar(j, dono, meuTime, p.financas.caixa, oferta)) return p;
      const preco = precoDeCompra(j, dono, oferta);
      const rodada = (p.temporada?.rodadaAtual ?? 0) + 1;
      return {
        ...p,
        transferencias: { ...p.transferencias, [jogadorId]: meuTimeId },
        contratos: { ...p.contratos, [jogadorId]: contrato },
        financas: lancar(p.financas, [
          {
            rodada,
            descricao: `Compra de ${j.nome} (${dono.sigla})`,
            valor: -preco,
            tipo: "compra",
            ref: jogadorId,
            ano: p.temporada?.ano,
          },
        ]),
      };
    });
  /** Primeira temporada de um contrato novo: a atual, ou a próxima se o campeonato já acabou. */
  const anoDoContrato = temporada
    ? temporada.ano +
      (temporada.rodadaAtual >= temporada.rodadas.length ? 1 : 0)
    : ANO_INICIAL;
  const momentoDoMercado = temporada
    ? temporada.ano * 100 + temporada.rodadaAtual
    : 0;
  /** Proposta de contrato para contratar (comprar) ou renovar. Devolve o texto da resposta. */
  const proporContrato = (
    jogadorId: string,
    salario: number,
    anos: number,
    renovar: boolean,
  ): RespostaDoJogador => {
    const j = renovar
      ? meuTime?.elenco.find((x) => x.id === jogadorId)
      : timesComLendas.flatMap((t) => t.elenco).find((x) => x.id === jogadorId);
    if (!j) return { ok: false, texto: "Jogador não encontrado." };
    const r = negociarContrato(
      j,
      salario,
      anos,
      anoDoContrato,
      momentoDoMercado,
    );
    if (r.tipo === "contraproposta")
      return {
        ok: false,
        pedida: r.pedida,
        texto: `${j.nome} pede ${formatarDinheiro(r.pedida)} por mês para ${anos} ${anos > 1 ? "anos" : "ano"}.`,
      };
    if (r.tipo === "recusa")
      return {
        ok: false,
        pedida: r.pedida,
        texto: `${j.nome} achou pouco. Ele quer perto de ${formatarDinheiro(r.pedida)} por mês.`,
      };
    if (renovar)
      mudar((p) => ({
        ...p,
        contratos: { ...p.contratos, [jogadorId]: r.contrato },
      }));
    else comprarJogador(jogadorId, r.contrato);
    return {
      ok: true,
      texto: `${j.nome} ${renovar ? "renovou" : "assinou"} até ${r.contrato.ate} por ${formatarDinheiro(r.contrato.salario)} por mês.`,
    };
  };
  /** Pede mais do que a IA ofereceu. Uma tentativa por jogador por rodada. */
  const negociarVenda = (jogadorId: string, valor: number) => {
    const j = meuTime?.elenco.find((x) => x.id === jogadorId);
    const t = progresso.temporada;
    if (!j || !t || progresso.negociacoes?.[jogadorId] === t.rodadaAtual)
      return;
    const prop = propostaPor(
      j,
      meuTimeId,
      timesComLendas,
      NIVEL,
      t.rodadaAtual,
      t.seed,
      oferta,
    );
    const comprador = mapaTimes.get(prop.clubeId)!;
    if (valor <= prop.teto) {
      setAvisoMercado(
        `O ${comprador.nome} aceitou: ${j.nome} vendido por ${formatarDinheiro(valor)}.`,
      );
      venderJogador(jogadorId, valor);
    } else {
      setAvisoMercado(
        `O ${comprador.nome} não aceitou ${formatarDinheiro(valor)} por ${j.nome}. A proposta de ${formatarDinheiro(prop.valor)} continua até o fim da rodada.`,
      );
      mudar((p) => ({
        ...p,
        negociacoes: { ...p.negociacoes, [jogadorId]: t.rodadaAtual },
      }));
    }
  };
  const venderJogador = (jogadorId: string, valorNegociado?: number) =>
    mudar((p) => {
      const j = meuTime?.elenco.find((x) => x.id === jogadorId);
      if (!j || !p.financas || !p.temporada) return p;
      const prop0 = propostaPor(
        j,
        meuTimeId,
        timesComLendas,
        NIVEL,
        p.temporada.rodadaAtual,
        p.temporada.seed,
        oferta,
      );
      const prop = valorNegociado ? { ...prop0, valor: valorNegociado } : prop0;
      const comprador = mapaTimes.get(prop.clubeId)!;
      return semTitular(
        {
          ...p,
          transferencias: { ...p.transferencias, [jogadorId]: prop.clubeId },
          contratos: Object.fromEntries(
            Object.entries(p.contratos ?? {}).filter(
              ([id]) => id !== jogadorId,
            ),
          ),
          financas: lancar(p.financas, [
            {
              rodada: p.temporada.rodadaAtual + 1,
              descricao: `Venda de ${j.nome} (${comprador.sigla})`,
              valor: prop.valor,
              tipo: "venda",
              ref: jogadorId,
              ano: p.temporada.ano,
            },
          ]),
        },
        jogadorId,
      );
    });

  const mudar = (f: (p: Progresso) => Progresso) => setProgresso((p) => f(p));

  /** Ação na conta (pacote, ampliação, cartas base, escalação): o servidor responde a situação nova. */
  const naContaFaz = async (f: () => Promise<SituacaoOnline>) => {
    setAvisoConta(null);
    try {
      const s = await f();
      aplicarSit(s);
      return s;
    } catch (e) {
      setAvisoConta((e as Error).message);
      return null;
    }
  };
  const comprarPacote = () => {
    if (naConta) {
      naContaFaz(online.abrirPacote).then((s) => s?.novas && setPacoteAberto(s.novas));
      return;
    }
    if (progresso.moedas < PRECO_PACOTE || !lendasLista.length) return;
    if (totalCartas(progresso) + CARTAS_POR_PACOTE > limiteCartas(progresso))
      return;
    const cartas = abrirPacote(
      lendasLista,
      criarRng(Date.now() ^ (Math.random() * 2 ** 31)),
    );
    mudar((p) => ({
      ...p,
      moedas: p.moedas - PRECO_PACOTE,
      estoque: [...p.estoque, ...cartas.map((c) => c.id)],
    }));
    setPacoteAberto(cartas);
  };
  const ampliar = () =>
    naConta
      ? naContaFaz(online.ampliar)
      : mudar((p) =>
      p.moedas < AMPLIACAO.preco || limiteCartas(p) >= LIMITE_CARTAS_MAXIMO
        ? p
        : {
            ...p,
            moedas: p.moedas - AMPLIACAO.preco,
            limiteCartas: limiteCartas(p) + AMPLIACAO.cartas,
          },
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
        mercadoCartas: {
          ...m,
          meus: [
            ...m.meus,
            { id: `m${m.proximoId}`, vendedor: "voce", jogadorId: id, preco },
          ],
          proximoId: m.proximoId + 1,
        },
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
  const comprarCarta = (
    p: Progresso,
    anuncioId: string,
    valor: number,
    texto: string,
  ): Progresso => {
    const m = p.mercadoCartas!;
    const a = m.anuncios.find((x) => x.id === anuncioId)!;
    return {
      ...p,
      moedas: p.moedas - valor,
      estoque: [...p.estoque, a.jogadorId],
      mercadoCartas: {
        ...m,
        anuncios: m.anuncios.filter((x) => x.id !== anuncioId),
        movimentos: [
          { rodada: rodadaAtual, texto, moedas: -valor },
          ...m.movimentos,
        ].slice(0, 40),
      },
    };
  };
  const comprarAnuncio = (anuncioId: string) => {
    const a = progresso.mercadoCartas?.anuncios.find((x) => x.id === anuncioId);
    if (!a || progresso.moedas < a.preco || semEspacoCarta) return;
    const nome = lendas.get(a.jogadorId)?.nome ?? a.jogadorId;
    setAvisoCartas(
      `Você comprou ${nome} de ${a.vendedor} por ${a.preco} moedas. Ela está no seu estoque.`,
    );
    mudar((p) =>
      comprarCarta(
        p,
        anuncioId,
        a.preco,
        `Você comprou ${nome} de ${a.vendedor}`,
      ),
    );
  };
  const propor = (anuncioId: string, valor: number) => {
    const p = progresso;
    const a = p.mercadoCartas?.anuncios.find((x) => x.id === anuncioId);
    if (!a || p.moedas < valor || totalCartas(p) >= limiteCartas(p)) return;
    const nome = lendas.get(a.jogadorId)?.nome ?? a.jogadorId;
    const r = respostaSimulada(a.preco, valor);
    setContraDoVendedor(null);
    if (r.tipo === "aceita") {
      setAvisoCartas(
        `${a.vendedor} aceitou sua proposta: ${nome} por ${valor} moedas.`,
      );
      mudar((q) =>
        comprarCarta(
          q,
          anuncioId,
          valor,
          `${a.vendedor} aceitou ${valor} por ${nome}`,
        ),
      );
    } else if (r.tipo === "contra") {
      setAvisoCartas(null);
      setContraDoVendedor({ anuncioId, valor: r.valor });
    } else {
      setAvisoCartas(
        `${a.vendedor} recusou ${valor} moedas por ${nome}: muito abaixo dos ${a.preco} do anúncio.`,
      );
    }
  };
  const responderContra = (aceitar: boolean) => {
    const c = contraDoVendedor;
    setContraDoVendedor(null);
    if (!c) return;
    const a = progresso.mercadoCartas?.anuncios.find(
      (x) => x.id === c.anuncioId,
    );
    if (!a) return;
    const nome = lendas.get(a.jogadorId)?.nome ?? a.jogadorId;
    if (!aceitar) {
      setAvisoCartas(
        `Você recusou a contraproposta de ${a.vendedor}. O anúncio continua em ${a.preco}.`,
      );
      return;
    }
    if (progresso.moedas < c.valor || semEspacoCarta) return;
    setAvisoCartas(`Negócio fechado: ${nome} por ${c.valor} moedas.`);
    mudar((q) =>
      comprarCarta(
        q,
        c.anuncioId,
        c.valor,
        `Você comprou ${nome} de ${a.vendedor} na contraproposta`,
      ),
    );
  };
  /** Sua contraproposta a uma proposta recebida por carta anunciada. */
  const contrapropor = (propostaId: string, valor: number) => {
    const pr = progresso.mercadoCartas?.recebidas.find(
      (x) => x.id === propostaId,
    );
    if (!pr) return;
    const nome = lendas.get(pr.jogadorId)?.nome ?? pr.jogadorId;
    if (aceitaContraproposta(pr, valor)) {
      setAvisoCartas(
        `${pr.de} aceitou sua contraproposta: ${nome} vendido por ${valor} (você recebe ${comTaxa(valor)}).`,
      );
      mudar((p) =>
        venderPorProposta(
          p,
          propostaId,
          valor,
          `Você vendeu ${nome} para ${pr.de} por ${valor} na contraproposta (taxa de 5%)`,
        ),
      );
    } else {
      setAvisoCartas(
        `${pr.de} achou ${valor} caro e desistiu de ${nome}. A carta continua anunciada.`,
      );
      recusarProposta(propostaId);
    }
  };
  const venderPorProposta = (
    p: Progresso,
    propostaId: string,
    valor: number,
    texto: string,
  ): Progresso => {
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
        movimentos: [
          { rodada: rodadaAtual, texto, moedas: liquido },
          ...m.movimentos,
        ].slice(0, 40),
      },
    };
  };
  const aceitarProposta = (propostaId: string) => {
    const pr = progresso.mercadoCartas?.recebidas.find(
      (x) => x.id === propostaId,
    );
    if (!pr) return;
    const nome = lendas.get(pr.jogadorId)?.nome ?? pr.jogadorId;
    mudar((p) =>
      venderPorProposta(
        p,
        propostaId,
        pr.valor,
        `Você vendeu ${nome} para ${pr.de} por ${pr.valor} (taxa de 5%)`,
      ),
    );
  };
  const recusarProposta = (propostaId: string) =>
    mudar((p) =>
      p.mercadoCartas
        ? {
            ...p,
            mercadoCartas: {
              ...p.mercadoCartas,
              recebidas: p.mercadoCartas.recebidas.filter(
                (x) => x.id !== propostaId,
              ),
            },
          }
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
          noElenco: {
            ...p.noElenco,
            [meuTimeId]: (p.noElenco[meuTimeId] ?? []).filter((x) => x !== id),
          },
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
      const i = t.rodadas[t.rodadaAtual].findIndex(
        ([m, v]) => m === r.mandanteId && v === r.visitanteId,
      );
      if (i < 0) return p;
      const comMeu: Temporada = {
        ...t,
        placares: {
          ...t.placares,
          [chaveJogo(t.rodadaAtual, i)]: [r.golsMandante, r.golsVisitante],
        },
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
      const prox = jogarRodada(t, mapaTimes);
      // A outra divisão joga a mesma rodada (e alcança a do manager em saves antigos).
      let outraTemporada = p.outraTemporada;
      while (
        outraTemporada &&
        outraTemporada.rodadaAtual <
          Math.min(prox.rodadaAtual, outraTemporada.rodadas.length)
      )
        outraTemporada = jogarRodada(outraTemporada, mapaTimes);
      // Dinheiro da rodada: receitas, bilheteria em casa e salários.
      const emCasa = t.rodadas[t.rodadaAtual].some(([m]) => m === meuTimeId);
      let financas =
        p.financas && meuTime
          ? lancar(
              p.financas,
              balancoDaRodada(
                p.financas,
                meuTime,
                t.rodadaAtual + 1,
                emCasa,
                folhaComContratos(meuTime.elenco, p.contratos, ANO_INICIAL),
              ).map((l) => ({ ...l, ano: t.ano })),
            )
          : p.financas;
      // Caixa negativo: juros e, depois de 4 rodadas seguidas no vermelho, perda de 3 pontos.
      let noVermelho = p.noVermelho ?? 0;
      let punida = prox;
      if (financas) {
        const d = dividaDaRodada(financas.caixa, t.rodadaAtual + 1, noVermelho);
        financas = lancar(
          financas,
          d.lancamentos.map((l) => ({ ...l, ano: t.ano })),
        );
        noVermelho = d.noVermelho;
        if (d.perdePontos) {
          financas = lancar(financas, [
            {
              rodada: t.rodadaAtual + 1,
              descricao: `Punição: −${PONTOS_DE_PUNICAO} pontos por dívida`,
              valor: 0,
              tipo: "aviso",
            },
          ]);
          punida = {
            ...prox,
            punicoes: {
              ...prox.punicoes,
              [meuTimeId]:
                (prox.punicoes?.[meuTimeId] ?? 0) + PONTOS_DE_PUNICAO,
            },
          };
        }
      }
      // Os outros técnicos mexem no mercado de cartas a cada rodada.
      let moedasMercado = 0;
      let mercadoCartas = p.mercadoCartas;
      if (mercadoCartas && lendas.size && !naConta) {
        const r = rodadaDoMercado(
          mercadoCartas,
          lendas,
          t.rodadaAtual + 1,
          criarRng(seedDoMercado(t.seed, t.rodadaAtual + 1)),
        );
        mercadoCartas = r.mercado;
        moedasMercado = r.moedas;
      }
      p = {
        ...p,
        mercadoCartas,
        moedas: p.moedas + moedasMercado,
        noVermelho,
        outraTemporada,
      };
      if (punida.rodadaAtual < punida.rodadas.length)
        return { ...p, temporada: punida, financas };
      const tabela = calcularTabela(
        punida,
        idsDaTemporada(punida),
        new Map(timesComLendas.map((x) => [x.id, x.nome])),
      );
      const divisao = divisaoDe(punida);
      const posicao = tabela.findIndex((l) => l.id === meuTimeId) + 1;
      if (financas)
        financas = lancar(financas, [
          {
            rodada: 38,
            descricao: `Premiação: ${posicao}º lugar`,
            valor: premiacaoEmDinheiro(financas, posicao),
            tipo: "premiacao",
            ano: punida.ano,
            moedas: premioFinal(posicao, divisao),
          },
        ]);
      return {
        ...p,
        temporada: punida,
        financas,
        moedas: p.moedas + premioFinal(posicao, divisao),
        historico: [
          ...(p.historico ?? []),
          { ano: prox.ano, posicao, campeao: tabela[0].id, divisao },
        ],
      };
    });
    // Fim do campeonato: mostra a tabela final.
    if (temporada && temporada.rodadaAtual + 1 >= temporada.rodadas.length)
      setAba("campeonato");
  };
  /** Quem sai de graça quando a temporada atual acabar (contrato terminando neste ano). */
  const saidas =
    meuTime && temporada
      ? contratosTerminando(
          meuTime.elenco,
          progresso.contratos,
          ANO_INICIAL,
          temporada.ano,
        )
      : [];
  /**
   * Próxima temporada: acesso e rebaixamento, receitas da nova divisão e
   * saída de quem não renovou (vai de graça para outro clube).
   */
  const novaTemporadaDoManager = () => {
    mudar((p) => {
      const t = p.temporada;
      if (!t) return p;
      const o = p.outraTemporada;
      const antes = divisaoDe(t);
      let divisoes = p.divisoes ?? DIVISOES_INICIAIS;
      if (
        o &&
        o.rodadaAtual >= o.rodadas.length &&
        t.rodadaAtual >= t.rodadas.length
      ) {
        const [a, b] = antes === "A" ? [t, o] : [o, t];
        divisoes = { ...divisoes, ...trocarDivisoes(a, b) };
      }
      const minha = divisoes[meuTimeId] ?? antes;
      const financas =
        p.financas && minha !== antes
          ? financasAoMudarDeDivisao(p.financas, minha === "A")
          : p.financas;
      const sai = new Set(saidas.map((j) => j.id));
      const todos = CLUBES.map((c) => c.id);
      const ano = t.ano + 1;
      return {
        ...p,
        divisoes,
        financas,
        temporada: criarTemporada(ano, divisoes, minha),
        outraTemporada: criarTemporada(ano, divisoes, outraDivisao(minha)),
        transferencias: {
          ...p.transferencias,
          ...Object.fromEntries(
            saidas.map((j) => [
              j.id,
              destinoDaSaida(j, todos, meuTimeId, t.ano),
            ]),
          ),
        },
        contratos: Object.fromEntries(
          Object.entries(p.contratos ?? {}).filter(([id]) => !sai.has(id)),
        ),
        escalacao: p.escalacao && {
          ...p.escalacao,
          titulares: p.escalacao.titulares.filter((id) => !sai.has(id)),
          banco: p.escalacao.banco?.filter((id) => !sai.has(id)),
        },
      };
    });
    setAba("partida");
  };

  const premiar = (r: ResultadoPartida) => {
    const meus = r.mandanteId === meuTimeId ? r.golsMandante : r.golsVisitante;
    const deles = r.mandanteId === meuTimeId ? r.golsVisitante : r.golsMandante;
    const premio =
      meus > deles
        ? PREMIO.vitoria
        : meus === deles
          ? PREMIO.empate
          : PREMIO.derrota;
    mudar((p) => ({
      ...p,
      moedas: p.moedas + premio,
      financas:
        p.financas &&
        p.temporada &&
        lancar(p.financas, [
          {
            rodada: p.temporada.rodadaAtual + 1,
            ano: p.temporada.ano,
            descricao: `Prêmio da partida: ${premio} moedas`,
            valor: 0,
            moedas: premio,
            tipo: "partida",
          },
        ]),
    }));
    return premio;
  };

  const criarManager = (nome: string, clubeId: string) => {
    const nova: Progresso = {
      ...PROGRESSO_INICIAL,
      manager: {
        nome,
        clubeId,
        criadoEm: new Date().toISOString().slice(0, 10),
      },
      divisoes: DIVISOES_INICIAIS,
      temporada: criarTemporada(
        ANO_INICIAL,
        DIVISOES_INICIAIS,
        DIVISOES_INICIAIS[clubeId],
      ),
      outraTemporada: criarTemporada(
        ANO_INICIAL,
        DIVISOES_INICIAIS,
        outraDivisao(DIVISOES_INICIAIS[clubeId]),
      ),
      financas: financasDoClube(clubeId),
      caixaUnico: true,
      ...timeCartasInicial(),
    };
    if (naConta) {
      // Na conta, o servidor cria a carreira e define o caixa e as receitas.
      conta.criar({ ...nova, moedas: 0 }).then(
        (c) => {
          seqConfirmado.current = 0;
          ultimoEnvio.current = "";
          setProgresso(daConta(c, sit));
          if (c.bonus) setAvisoConta(null);
          setAba("escritorio");
        },
        (e) => setAvisoConta((e as Error).message),
      );
      return;
    }
    setProgresso(nova);
    setAba("escritorio");
  };
  const novaCarreira = () => {
    setConfirmarNova(false);
    if (naConta) {
      conta.apagar().then(
        (c) => setProgresso({ ...PROGRESSO_INICIAL, moedas: c.moedas }),
        (e) => setAvisoConta((e as Error).message),
      );
      return;
    }
    setProgresso(PROGRESSO_INICIAL);
  };
  const sair = async () => {
    await online.sair().catch(() => null);
    setUsuario(null);
    setSit(null);
    setProgresso(PROGRESSO_INICIAL);
    setModo("menu");
  };

  // ---- Entrada: o jogo é na conta; sem servidor, dá para ver a demonstração ----
  if (!demo && !usuario) {
    return (
      <div className="app">
        <TelaInicio>
          {servidorFora ? (
            <div className="caixa-entrar">
              <h2>Servidor fora do ar</h2>
              <p className="suave">
                O jogo fica no servidor (PHP com MySQL): carreira, cartas, caixa e moedas são da sua conta. Esta cópia
                não achou o servidor. Para jogar de verdade, siga <code>docs/XAMPP.md</code>.
              </p>
              <button className="botao primario" onClick={() => setDemo(true)}>
                Ver a demonstração
              </button>
              <p className="suave">Na demonstração nada vai para a conta e o ranqueado fica desligado.</p>
            </div>
          ) : usuario === undefined ? (
            <p className="suave">Conectando ao servidor…</p>
          ) : (
            <>
              {avisoConta && <p className="aviso">{avisoConta}</p>}
              <Entrar onEntrou={entrarNaConta} />
            </>
          )}
        </TelaInicio>
      </div>
    );
  }

  if (!progresso.manager || !meuTime || !temporada) {
    return (
      <div className="app">
        {naConta && (
          <p className="aviso-conta">
            Conta <b>{usuario!.nome}</b>: a carreira fica salva no servidor, com um caixa só para a carreira, os desafios
            e o ranqueado.{avisoConta ? ` ${avisoConta}` : ""}
          </p>
        )}
        <TelaNovoManager times={times} onCriar={criarManager} />
      </div>
    );
  }

  const nomes = new Map(timesComLendas.map((x) => [x.id, x.nome]));
  const tabela = calcularTabela(temporada, idsDaTemporada(temporada), nomes);
  const posicao = tabela.findIndex((l) => l.id === meuTimeId) + 1;
  const fimTemporada = temporada.rodadaAtual >= temporada.rodadas.length;
  const jogoAtual = fimTemporada
    ? null
    : temporada.rodadas[temporada.rodadaAtual].find((j) =>
        j.includes(meuTimeId),
      );
  const folha = folhaComContratos(
    meuTime.elenco,
    progresso.contratos,
    ANO_INICIAL,
  );
  const propostasCartas = progresso.mercadoCartas?.recebidas.length ?? 0;
  const lateral =
    modo === "carreira"
      ? ABAS_CARREIRA.map((a) => ({
          ...a,
          ativo: aba === a.id,
          onClick: () => setAba(a.id),
          contador: a.id === "mercado" && fimTemporada ? saidas.length : 0,
        }))
      : modo === "ranqueado" && naConta
        ? ABAS_RANQUEADO.map((a) => ({
            ...a,
            ativo: abaRanqueado === a.id,
            onClick: () => setAbaRanqueado(a.id),
            contador: 0,
          }))
      : modo === "colecao"
        ? ABAS_COLECAO.filter((a) => naConta || a.id !== "base").map((a) => ({
            ...a,
            ativo: abaColecao === a.id,
            onClick: () => setAbaColecao(a.id),
            contador:
              a.id === "estoque"
                ? progresso.estoque.length
                : a.id === "cartas"
                  ? propostasCartas
                  : 0,
          }))
        : null;
  const pedirNovaCarreira = (
    <>
      {avisoConta && (
        <p className="aviso aviso-acao">
          <span>{avisoConta}</span>
          <button className="botao discreto" onClick={() => setAvisoConta(null)}>
            Fechar
          </button>
        </p>
      )}
      {confirmarNova && (
        <div className="aviso aviso-acao">
          <span>
            {naConta
              ? "Começar uma nova carreira apaga esta: campeonato, elenco e contratos. O caixa, as moedas e as cartas da conta continuam."
              : "Começar uma nova carreira apaga esta: campeonato, caixa, contratações, moedas, estoque e lendas."}
          </span>
          <button className="botao" onClick={() => setConfirmarNova(false)}>
            Cancelar
          </button>
          <button className="botao perigo" onClick={novaCarreira}>
            Apagar e começar de novo
          </button>
        </div>
      )}
    </>
  );

  if (modo === "menu")
    return (
      <div className="app">
        {pedirNovaCarreira}
        <Lobby
          tecnico={progresso.manager.nome}
          meuTime={meuTime}
          carreira={{
            divisao: divisaoDe(temporada),
            ano: temporada.ano,
            rodada: Math.min(
              temporada.rodadaAtual + 1,
              temporada.rodadas.length,
            ),
            totalRodadas: temporada.rodadas.length,
            posicao,
            fim: fimTemporada,
            proximo: jogoAtual
              ? {
                  casa: jogoAtual[0] === meuTimeId,
                  adv: mapaTimes.get(
                    jogoAtual[0] === meuTimeId ? jogoAtual[1] : jogoAtual[0],
                  )!,
                }
              : null,
          }}
          caixa={progresso.financas?.caixa ?? 0}
          moedas={progresso.moedas}
          conta={naConta ? { nome: usuario!.nome, onSair: sair } : null}
          desafios={{
            vitorias: DESAFIOS.filter(
              (d) => progresso.timeCartas?.desafios[d.id]?.vitorias,
            ).length,
            total: DESAFIOS.length,
          }}
          colecao={{
            cartas: totalCartas(progresso),
            limite: limiteCartas(progresso),
            noEstoque: progresso.estoque.length,
            propostas: propostasCartas,
          }}
          onEntrar={(m) => (m === "carreira" ? setAba(aba) : setModo(m))}
          onNovaCarreira={() => setConfirmarNova(true)}
        />
      </div>
    );

  return (
    <div className="app">
      <header className="topo">
        <button
          className="botao-menu"
          onClick={() => setModo("menu")}
          title="Voltar ao menu principal"
        >
          <Icone nome="menu" />
          <span>Menu</span>
        </button>
        <div className="marca">
          Fantasy<span>Manager</span>
        </div>
        <span className="modo-atual">{TITULO_MODO[modo]}</span>
        <div className="clube">
          <span className="escudo" style={estiloEscudo(meuTime.cor)}>
            {meuTime.sigla}
          </span>
          <span className="clube-info">
            <b>{meuTime.nome}</b>
            <span className="suave">
              Série {divisaoDe(temporada)} · {posicao}º · Técnico:{" "}
              {progresso.manager.nome}
            </span>
          </span>
        </div>
        <div className="saldos">
          <div
            className="moedas caixa"
            title="Caixa do clube, para contratar jogadores"
          >
            <b>{formatarDinheiro(progresso.financas?.caixa ?? 0)}</b>
            <span className="suave">caixa</span>
          </div>
          <div className="moedas" title="Moedas para abrir pacotes">
            <span className="moeda" aria-hidden="true" />
            <b>{progresso.moedas.toLocaleString("pt-BR")}</b>
            <span className="suave">moedas</span>
          </div>
        </div>
      </header>
      {pedirNovaCarreira}
      <div className={lateral ? "corpo com-lateral" : "corpo"}>
        {lateral && (
          <nav className="lateral" aria-label={TITULO_MODO[modo]}>
            {lateral.map((a) => (
              <button
                key={a.id}
                className={a.ativo ? "ativo" : ""}
                onClick={a.onClick}
                aria-current={a.ativo ? "page" : undefined}
              >
                <Icone nome={a.icone} />
                <span>{a.nome}</span>
                {a.contador > 0 && (
                  <span className="contador">{a.contador}</span>
                )}
              </button>
            ))}
          </nav>
        )}
        <main>
          {modo === "carreira" &&
            aba === "escritorio" &&
            progresso.financas && (
              <TelaEscritorio
                meuTime={meuTime}
                times={mapaTimes}
                temporada={temporada}
                tabela={tabela}
                financas={progresso.financas}
                folha={folha}
                noVermelho={progresso.noVermelho ?? 0}
                terminando={saidas.length}
                propostasCartas={propostasCartas}
                noEstoque={progresso.estoque.length}
                onIr={setAba}
                onContratos={() => {
                  setModoMercadoJogadores("contratos");
                  setAba("mercado");
                }}
                onColecao={() =>
                  irColecao(propostasCartas ? "cartas" : "estoque")
                }
              />
            )}
          {modo === "carreira" && aba === "financas" && progresso.financas && (
            <TelaFinancas
              meuTime={meuTime}
              financas={progresso.financas}
              folha={folha}
              noVermelho={progresso.noVermelho ?? 0}
              divisao={divisaoDe(temporada)}
            />
          )}
          {modo === "carreira" && aba === "elenco" && (
            <TelaElenco time={meuTime} onChange={atualizar} />
          )}
          {modo === "carreira" &&
            aba === "partida" &&
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
                  A Série {divisaoDe(temporada)} {temporada.ano} acabou.{" "}
                  <button
                    className="link-nome"
                    onClick={() => setAba("campeonato")}
                  >
                    Veja a tabela final
                  </button>{" "}
                  e comece a próxima temporada.
                </p>
              </section>
            ))}
          {modo === "carreira" && aba === "campeonato" && (
            <TelaCampeonato
              meuTime={meuTime}
              times={mapaTimes}
              temporada={temporada}
              outraTemporada={progresso.outraTemporada}
              saidas={saidas}
              onRenovar={() => {
                setModoMercadoJogadores("contratos");
                setAba("mercado");
              }}
              onNovaTemporada={novaTemporadaDoManager}
            />
          )}
          {modo === "carreira" && aba === "mercado" && progresso.financas && (
            <section className="tela">
              <TelaMercado
                meuTime={meuTime}
                times={timesComLendas}
                financas={progresso.financas}
                temporada={temporada}
                onContrato={proporContrato}
                contratos={progresso.contratos}
                anoInicial={ANO_INICIAL}
                anoDoContrato={anoDoContrato}
                noVermelho={progresso.noVermelho ?? 0}
                onVender={(id) => venderJogador(id)}
                onNegociar={negociarVenda}
                negociados={progresso.negociacoes ?? {}}
                aviso={avisoMercado}
                modo={modoMercadoJogadores}
                onModo={setModoMercadoJogadores}
              />
            </section>
          )}
          {modo === "colecao" && abaColecao === "cartas" && naConta && (
            <section className="tela">
              <TelaMercadoOnline onMudou={atualizarConta} />
            </section>
          )}
          {modo === "colecao" && abaColecao === "cartas" && !naConta && (
            <section className="tela">
              {progresso.mercadoCartas ? (
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
          {modo === "desafios" && naConta && sit && progresso.timeCartas && (
            <section className="tela">
              <TelaDesafios
                timeCartas={{
                  ...progresso.timeCartas,
                  caixa: progresso.financas?.caixa ?? 0,
                  formacao: sit.time.formacao,
                  titulares: sit.time.titulares,
                  banco: sit.time.banco,
                }}
                meuTime={timeDe(sit)}
                atuais={ATUAIS}
                lendas={lendasLista}
                cartasBase={new Set(sit.cartas.filter((j) => !ehLenda(j)).map((j) => j.id))}
                moedas={progresso.moedas}
                onAtualizarTime={(t) => {
                  const [tit, banco] = completa(t);
                  naContaFaz(() => online.escalar(t.formacao.nome, tit, banco));
                }}
                onComprarBase={(id) => naContaFaz(() => online.comprarBase(id))}
                onVenderBase={(id) => naContaFaz(() => online.venderBase(id))}
                onIniciar={iniciarDesafio}
                onConcluir={concluirDesafio}
              />
            </section>
          )}
          {modo === "desafios" && !naConta && timeCartas && progresso.timeCartas && (
            <section className="tela">
              <TelaDesafios
                timeCartas={{
                  ...progresso.timeCartas,
                  caixa: progresso.financas?.caixa ?? 0,
                }}
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
          {modo === "colecao" && abaColecao === "estoque" && (
            <TelaEstoque
              progresso={progresso}
              lendas={lendas}
              meuTime={meuTime}
              pacoteAberto={pacoteAberto}
              onFecharPacote={() => setPacoteAberto(null)}
              onComprar={comprarPacote}
              onAmpliar={ampliar}
              onAnunciar={naConta ? undefined : anunciar}
              onVender={naConta ? undefined : vender}
              onIrMercado={naConta ? () => irColecao("cartas") : undefined}
              onLevar={levar}
              onDevolver={devolver}
            />
          )}
          {modo === "ranqueado" &&
            (naConta && sit ? (
              <TelaOnline key={abaRanqueado} sit={sit} onSit={aplicarSit} secao={abaRanqueado} />
            ) : (
              <section className="tela">
                <div className="aviso-online">
                  <h2>O ranqueado precisa do servidor</h2>
                  <p>
                    Esta é a demonstração, sem servidor. Com o jogo instalado (<code>docs/XAMPP.md</code>), o ranqueado põe o
                    seu time de cartas ao vivo contra outros técnicos.
                  </p>
                </div>
              </section>
            ))}
          {modo === "colecao" && abaColecao === "base" && sit && (
            <section className="tela">
              <LojaCartasBase
                atuais={ATUAIS}
                tenho={new Set(sit.cartas.filter((j) => !ehLenda(j)).map((j) => j.id))}
                moedas={progresso.moedas}
                onComprar={(id) => naContaFaz(() => online.comprarBase(id))}
                onVender={(id) => naContaFaz(() => online.venderBase(id))}
              />
            </section>
          )}
          {modo === "colecao" && abaColecao === "lendas" && <TelaLendas />}
        </main>
      </div>
      <footer className="rodape">
        Carreira de {progresso.manager.nome} no {meuTime.nome}, desde{" "}
        {progresso.manager.criadoEm.split("-").reverse().join("/")}.
        {!confirmarNova && (
          <button className="link-nome" onClick={() => setConfirmarNova(true)}>
            Nova carreira
          </button>
        )}
      </footer>
    </div>
  );
}
