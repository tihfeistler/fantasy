import { useMemo, useState } from "react";
import { DIVISOES_INICIAIS, NIVEL } from "../data/clubes";
import { LIGAS } from "../engine/ligas";
import type { Temporada } from "../engine/campeonato";
import {
  formatarDinheiro,
  JUROS_DIVIDA,
  PONTOS_DE_PUNICAO,
  RODADAS_ATE_PUNICAO,
  MAX_ELENCO,
  MIN_ELENCO,
  criarOferta,
  detalharPreco,
  podeComprar,
  propostaPor,
  salarioMensal,
  valorDeMercado,
  valorDoElenco,
  type Financas,
  type MotivoRecusa,
} from "../engine/mercado";
import { ehLenda, POSICOES, type Jogador, type Time } from "../engine/types";
import { contratoDe, contratosTerminando, DURACAO_MAXIMA, folhaComContratos, type Contrato } from "../engine/contratos";
import { setor } from "./CartaJogador";

interface Props {
  meuTime: Time;
  times: Time[];
  financas: Financas;
  temporada: Temporada;
  /** Proposta de contrato: para contratar (renovar = false) ou renovar. */
  onContrato: (jogadorId: string, salario: number, anos: number, renovar: boolean) => RespostaDoJogador;
  contratos: Record<string, Contrato> | undefined;
  /** Ano de referência dos contratos padrão. */
  anoInicial: number;
  /** Primeira temporada de um contrato assinado agora. */
  anoDoContrato: number;
  /** Rodadas seguidas com caixa negativo. */
  noVermelho: number;
  onVender: (jogadorId: string) => void;
  /** Pede outro valor pela venda (contraproposta ao clube da IA). */
  onNegociar: (jogadorId: string, valor: number) => void;
  /** jogadorId -> rodada em que já negociou. */
  negociados: Record<string, number>;
  aviso: string | null;
  modo: ModoMercado;
  onModo: (m: ModoMercado) => void;
}

export type ModoMercado = "comprar" | "vender" | "contratos";

export interface RespostaDoJogador {
  ok: boolean;
  texto: string;
  /** Quanto o jogador pede, quando não aceitou. */
  pedida?: number;
}

const POR_PAGINA = 40;
const MOTIVO: Record<Exclude<MotivoRecusa, null>, string> = {
  caixa: "Caixa insuficiente",
  "meu-elenco-cheio": `Seu elenco já tem ${MAX_ELENCO}`,
  "elenco-dele-curto": "O clube não vende",
};

export function TelaMercado(props: Props) {
  const { meuTime, times, financas, temporada, onVender, onNegociar, negociados, aviso } = props;
  const { contratos, anoInicial, anoDoContrato, noVermelho, onContrato } = props;
  const { modo, onModo: setModo } = props;
  const [contratando, setContratando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState("");
  const [clube, setClube] = useState("");
  const [liga, setLiga] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [negociando, setNegociando] = useState<string | null>(null);
  const [pedido, setPedido] = useState("");

  const oferta = useMemo(() => criarOferta(times), [times]);
  const meus = meuTime.elenco.filter((j) => !ehLenda(j)).sort((a, b) => b.geral - a.geral);
  const folha = folhaComContratos(meuTime.elenco, contratos, anoInicial);
  const terminando = contratosTerminando(meus, contratos, anoInicial, temporada.ano);

  const outros = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return times
      .filter((t) => t.id !== meuTime.id && (!clube || t.id === clube) && (!liga || DIVISOES_INICIAIS[t.id] === liga))
      .flatMap((t) => t.elenco.filter((j) => !ehLenda(j)).map((j) => ({ j, dono: t })))
      .filter(({ j }) => !posicao || j.posicao === posicao)
      .filter(
        ({ j }) =>
          !termo ||
          j.nome
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .includes(termo),
      )
      .sort((a, b) => b.j.geral - a.j.geral);
  }, [times, meuTime.id, busca, posicao, clube, liga]);

  const dois = (id: string, acao: () => void) => () => {
    if (confirmando === id) {
      acao();
      setConfirmando(null);
    } else setConfirmando(id);
  };

  return (
    <>
      <div className="financas">
        <Indicador rotulo="Caixa" valor={formatarDinheiro(financas.caixa)} destaque />
        <Indicador rotulo="Folha mensal" valor={formatarDinheiro(folha)} />
        <Indicador rotulo="Valor do elenco" valor={formatarDinheiro(valorDoElenco(meuTime))} />
      </div>
      <p className="suave nota-financas">
        Os preços seguem oferta e procura: posição e nível com muitos jogadores na liga saem mais baratos, e raros
        saem mais caros. Clube com sobra na posição vende mais barato; com carência, cobra mais.
      </p>
      {financas.caixa < 0 && (
        <p className="aviso">
          Caixa negativo: contratações travadas e juros de {Math.round(JUROS_DIVIDA * 100)}% da dívida por rodada. Rodadas
          seguidas no vermelho: {noVermelho} de {RODADAS_ATE_PUNICAO}. Na {RODADAS_ATE_PUNICAO}ª, o clube perde{" "}
          {PONTOS_DE_PUNICAO} pontos na tabela. Venda jogadores para sair do vermelho.
        </p>
      )}

      <div className="barra">
        <div className="alternar" role="group" aria-label="Comprar ou vender">
          <button className={modo === "comprar" ? "ativo" : ""} onClick={() => setModo("comprar")}>
            Comprar
          </button>
          <button className={modo === "vender" ? "ativo" : ""} onClick={() => setModo("vender")}>
            Vender <span className="suave">{meus.length}</span>
          </button>
          <button className={modo === "contratos" ? "ativo" : ""} onClick={() => setModo("contratos")}>
            Contratos {terminando.length > 0 && <span className="contador">{terminando.length}</span>}
          </button>
        </div>
        {modo === "comprar" && (
          <>
            <input
              className="busca"
              type="search"
              placeholder="Buscar jogador"
              aria-label="Buscar jogador"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setLimite(POR_PAGINA);
              }}
            />
            <select aria-label="Posição" value={posicao} onChange={(e) => setPosicao(e.target.value)}>
              <option value="">Todas as posições</option>
              {POSICOES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              aria-label="Liga"
              value={liga}
              onChange={(e) => {
                setLiga(e.target.value);
                setClube("");
                setLimite(POR_PAGINA);
              }}
            >
              <option value="">Todas as ligas</option>
              {LIGAS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
            <select aria-label="Clube" value={clube} onChange={(e) => setClube(e.target.value)}>
              <option value="">Todos os clubes</option>
              {times
                .filter((t) => t.id !== meuTime.id && (!liga || DIVISOES_INICIAIS[t.id] === liga))
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
            </select>
          </>
        )}
      </div>

      {modo === "comprar" ? (
        <>
          <ul className="mercado-lista">
            {outros.slice(0, limite).map(({ j, dono }) => {
              const motivo = podeComprar(j, dono, meuTime, financas.caixa, oferta);
              const d = detalharPreco(j, dono, oferta);
              return (
                <Linha key={j.id} j={j} clube={dono} etiquetas={etiquetas(d.liga, d.clube)}>
                  <span className="ml-preco">
                    <span className="rotulo">Preço</span>
                    {formatarDinheiro(d.preco)}
                  </span>
                  <button
                    className={`botao${contratando === j.id ? " primario" : ""}`}
                    disabled={!!motivo}
                    onClick={() => setContratando(contratando === j.id ? null : j.id)}
                  >
                    {motivo ? MOTIVO[motivo] : contratando === j.id ? "Fechar" : "Comprar"}
                  </button>
                  {contratando === j.id && !motivo && (
                    <FormContrato
                      j={j}
                      titulo={`Contrato de ${j.nome}: o ${dono.nome} recebe ${formatarDinheiro(d.preco)} se ele assinar.`}
                      anoInicio={anoDoContrato}
                      botao="Propor contrato"
                      onEnviar={(sal, anos) => onContrato(j.id, sal, anos, false)}
                      onFechou={() => setContratando(null)}
                    />
                  )}
                </Linha>
              );
            })}
          </ul>
          {!outros.length && <p className="vazio-bloco">Nenhum jogador encontrado.</p>}
          {outros.length > limite && (
            <button className="botao mais" onClick={() => setLimite((l) => l + POR_PAGINA)}>
              Mostrar mais ({outros.length - limite} restantes)
            </button>
          )}
        </>
      ) : modo === "contratos" ? (
        <>
          <p className="suave">
            Quem tiver contrato terminando em {temporada.ano} sai de graça no fim da temporada se não renovar. Para
            renovar, proponha salário e duração: contratos longos custam um pouco mais por mês, e o humor do jogador muda
            a cada rodada.
          </p>
          <ul className="mercado-lista">
            {[...meus]
              .sort(
                (a, b) =>
                  contratoDe(a, contratos, anoInicial).ate - contratoDe(b, contratos, anoInicial).ate || b.geral - a.geral,
              )
              .map((j) => {
                const c = contratoDe(j, contratos, anoInicial);
                const acaba = c.ate <= temporada.ano;
                return (
                  <Linha
                    key={j.id}
                    j={j}
                    clube={meuTime}
                    salario={c.salario}
                    etiquetas={
                      acaba
                        ? [{ texto: "Termina nesta temporada", tipo: "caro", dica: "Sai de graça no fim da temporada se não renovar." }]
                        : []
                    }
                  >
                    <span className="ml-preco">
                      <span className="rotulo">Contrato até</span>
                      {c.ate}
                    </span>
                    <button
                      className={`botao${acaba ? " primario" : ""}`}
                      onClick={() => setContratando(contratando === j.id ? null : j.id)}
                    >
                      {contratando === j.id ? "Fechar" : "Renovar"}
                    </button>
                    {contratando === j.id && (
                      <FormContrato
                        j={j}
                        titulo={`Renovação de ${j.nome} (hoje ${formatarDinheiro(c.salario)}/mês até ${c.ate}).`}
                        anoInicio={anoDoContrato}
                        botao="Propor renovação"
                        onEnviar={(sal, anos) => onContrato(j.id, sal, anos, true)}
                        onFechou={() => setContratando(null)}
                      />
                    )}
                  </Linha>
                );
              })}
          </ul>
        </>
      ) : (
        <>
          <p className="suave">
            Cada jogador recebe uma proposta por rodada. Você pode aceitar ou negociar um valor maior, uma vez por rodada:
            se o clube não topar, a proposta original continua. Seu elenco precisa de pelo menos {MIN_ELENCO} jogadores
            atuais.
          </p>
          {aviso && <p className="aviso">{aviso}</p>}
          <ul className="mercado-lista">
            {meus.map((j) => {
              const prop = propostaPor(j, meuTime.id, times, NIVEL, temporada.rodadaAtual, temporada.seed, oferta);
              const comprador = times.find((t) => t.id === prop.clubeId)!;
              const curto = meus.length <= MIN_ELENCO;
              return (
                <Linha key={j.id} j={j} clube={meuTime} etiquetas={etiquetas(oferta(j), 1)}>
                  <span className="ml-preco">
                    <span className="rotulo">Proposta do {comprador.sigla}</span>
                    {formatarDinheiro(prop.valor)}
                  </span>
                  <span className="ml-acoes">
                    <button
                      className={`botao${confirmando === j.id ? " perigo" : ""}`}
                      disabled={curto}
                      onClick={dois(j.id, () => onVender(j.id))}
                    >
                      {curto ? "Elenco no mínimo" : confirmando === j.id ? `Vender ao ${comprador.nome}` : "Aceitar"}
                    </button>
                    {!curto &&
                      (negociando === j.id ? (
                        <form
                          className="proposta-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const v = Math.round((Number(pedido.replace(",", ".")) * 1000) / 50) * 50;
                            if (!(v > prop.valor)) return;
                            onNegociar(j.id, v);
                            setNegociando(null);
                          }}
                        >
                          <input
                            inputMode="decimal"
                            value={pedido}
                            onChange={(e) => setPedido(e.target.value)}
                            aria-label={`Valor pedido por ${j.nome}, em milhões`}
                            autoFocus
                          />
                          <span className="suave unidade">mi</span>
                          <button className="botao" type="submit">
                            Pedir
                          </button>
                        </form>
                      ) : (
                        <button
                          className="botao discreto"
                          disabled={negociados[j.id] === temporada.rodadaAtual}
                          onClick={() => {
                            setNegociando(j.id);
                            setPedido(((prop.valor * 1.15) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
                          }}
                        >
                          {negociados[j.id] === temporada.rodadaAtual ? "Já negociado" : "Negociar"}
                        </button>
                      ))}
                  </span>
                </Linha>
              );
            })}
          </ul>
        </>
      )}

    </>
  );
}

interface Etiqueta {
  texto: string;
  tipo: "barato" | "caro";
  dica: string;
}

/** Etiquetas de oferta e procura que explicam o preço. */
function etiquetas(liga: number, clube: number): Etiqueta[] {
  const es: Etiqueta[] = [];
  if (liga <= 0.93)
    es.push({ texto: "Muitos parecidos", tipo: "barato", dica: "Há muitos jogadores da mesma posição e nível na liga: preço menor." });
  if (liga >= 1.07)
    es.push({ texto: "Raro", tipo: "caro", dica: "Poucos jogadores da mesma posição e nível na liga: preço maior." });
  if (clube < 1) es.push({ texto: "Sobra no clube", tipo: "barato", dica: "O clube tem jogadores demais nessa posição e vende mais barato." });
  if (clube > 1) es.push({ texto: "Clube precisa", tipo: "caro", dica: "O clube tem poucos jogadores nessa posição e cobra mais." });
  return es;
}

function Linha({
  j,
  clube,
  etiquetas = [],
  salario = salarioMensal(j),
  children,
}: {
  j: Jogador;
  clube: Time;
  etiquetas?: Etiqueta[];
  salario?: number;
  children: React.ReactNode;
}) {
  return (
    <li className="ml-linha">
      <span className={`pos ml-pos setor-${setor(j.posicao)}`}>{j.posicao}</span>
      <span className="ml-geral">{j.geral}</span>
      <span className="ml-nome">
        <b>{j.nome}</b>
        <span className="suave">
          {clube.sigla} · {j.nacionalidade}
          {etiquetas.map((e) => (
            <span key={e.texto} className={`etiqueta ${e.tipo}`} title={e.dica}>
              {e.texto}
            </span>
          ))}
        </span>
      </span>
      <span className="ml-num">
        <span className="rotulo">Valor</span>
        {formatarDinheiro(valorDeMercado(j))}
      </span>
      <span className="ml-num">
        <span className="rotulo">Salário</span>
        {formatarDinheiro(salario)}/mês
      </span>
      {children}
    </li>
  );
}

function Indicador({ rotulo, valor, destaque, sinal = 0 }: { rotulo: string; valor: string; destaque?: boolean; sinal?: number }) {
  return (
    <div className={`indicador${destaque ? " destaque" : ""}${sinal > 0 ? " alta" : sinal < 0 ? " baixa" : ""}`}>
      <span className="rotulo">{rotulo}</span>
      <b>{valor}</b>
    </div>
  );
}

/** Proposta de contrato: salário mensal (R$ mil) e anos. Fica aberta até o jogador aceitar. */
function FormContrato(p: {
  j: Jogador;
  titulo: string;
  anoInicio: number;
  botao: string;
  onEnviar: (salario: number, anos: number) => RespostaDoJogador;
  onFechou: () => void;
}) {
  const [salario, setSalario] = useState(String(salarioMensal(p.j)));
  const [anos, setAnos] = useState(3);
  const [resposta, setResposta] = useState<RespostaDoJogador | null>(null);
  const valor = Number(salario.replace(",", "."));
  return (
    <form
      className="form-contrato"
      onSubmit={(e) => {
        e.preventDefault();
        if (!(valor > 0)) return;
        const r = p.onEnviar(Math.round(valor), anos);
        setResposta(r);
        if (r.pedida) setSalario(String(r.pedida));
        if (r.ok) setTimeout(p.onFechou, 1800);
      }}
    >
      <p className="suave">{p.titulo}</p>
      <label>
        Salário (R$ mil por mês)
        <input inputMode="numeric" value={salario} onChange={(e) => setSalario(e.target.value)} aria-label="Salário por mês, em mil" />
      </label>
      <label>
        Duração
        <select value={anos} onChange={(e) => setAnos(Number(e.target.value))} aria-label="Duração do contrato">
          {Array.from({ length: DURACAO_MAXIMA }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n > 1 ? "anos" : "ano"} (até {p.anoInicio + n - 1})
            </option>
          ))}
        </select>
      </label>
      <button className="botao primario" disabled={!(valor > 0) || resposta?.ok}>
        {p.botao}
      </button>
      {resposta && <p className={resposta.ok ? "premio" : "aviso"}>{resposta.texto}</p>}
    </form>
  );
}
