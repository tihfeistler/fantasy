import { useMemo, useState } from "react";
import { NIVEL } from "../data/clubes";
import type { Temporada } from "../engine/campeonato";
import {
  folhaMensal,
  formatarDinheiro,
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
import { setor } from "./CartaJogador";

interface Props {
  meuTime: Time;
  times: Time[];
  financas: Financas;
  temporada: Temporada;
  onComprar: (jogadorId: string) => void;
  onVender: (jogadorId: string) => void;
}

const POR_PAGINA = 40;
const MOTIVO: Record<Exclude<MotivoRecusa, null>, string> = {
  caixa: "Caixa insuficiente",
  "meu-elenco-cheio": `Seu elenco já tem ${MAX_ELENCO}`,
  "elenco-dele-curto": "O clube não vende",
};

export function TelaMercado({ meuTime, times, financas, temporada, onComprar, onVender }: Props) {
  const [modo, setModo] = useState<"comprar" | "vender">("comprar");
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState("");
  const [clube, setClube] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const oferta = useMemo(() => criarOferta(times), [times]);
  const meus = meuTime.elenco.filter((j) => !ehLenda(j)).sort((a, b) => b.geral - a.geral);
  const folha = folhaMensal(meuTime);
  const ultimo = financas.extrato[0]?.rodada;
  const saldoUltima = financas.extrato.filter((l) => l.rodada === ultimo).reduce((s, l) => s + l.valor, 0);

  const outros = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return times
      .filter((t) => t.id !== meuTime.id && (!clube || t.id === clube))
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
  }, [times, meuTime.id, busca, posicao, clube]);

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
        <Indicador
          rotulo={ultimo ? `Saldo da rodada ${ultimo}` : "Saldo da última rodada"}
          valor={ultimo ? formatarDinheiro(saldoUltima) : "–"}
          sinal={ultimo ? Math.sign(saldoUltima) : 0}
        />
      </div>
      <p className="suave nota-financas">
        Os preços seguem oferta e procura: posição e nível com muitos jogadores na liga saem mais baratos, e raros
        saem mais caros. Clube com sobra na posição vende mais barato; com carência, cobra mais. A cada rodada entram {formatarDinheiro(financas.receitaPorRodada)} de TV e patrocínio, mais{" "}
        {formatarDinheiro(financas.bilheteria)} de bilheteria nos jogos em casa. Saem os salários (um quarto da folha
        mensal). No fim do campeonato há premiação pela posição. Lendas não recebem salário.
      </p>

      <div className="barra">
        <div className="alternar" role="group" aria-label="Comprar ou vender">
          <button className={modo === "comprar" ? "ativo" : ""} onClick={() => setModo("comprar")}>
            Comprar
          </button>
          <button className={modo === "vender" ? "ativo" : ""} onClick={() => setModo("vender")}>
            Vender <span className="suave">{meus.length}</span>
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
            <select aria-label="Clube" value={clube} onChange={(e) => setClube(e.target.value)}>
              <option value="">Todos os clubes</option>
              {times
                .filter((t) => t.id !== meuTime.id)
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
                    className={`botao${confirmando === j.id ? " primario" : ""}`}
                    disabled={!!motivo}
                    onClick={dois(j.id, () => onComprar(j.id))}
                  >
                    {motivo ? MOTIVO[motivo] : confirmando === j.id ? "Confirmar compra" : "Comprar"}
                  </button>
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
      ) : (
        <>
          <p className="suave">
            Cada jogador recebe uma proposta por rodada. Seu elenco precisa de pelo menos {MIN_ELENCO} jogadores atuais.
          </p>
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
                  <button
                    className={`botao${confirmando === j.id ? " perigo" : ""}`}
                    disabled={curto}
                    onClick={dois(j.id, () => onVender(j.id))}
                  >
                    {curto ? "Elenco no mínimo" : confirmando === j.id ? `Vender ao ${comprador.nome}` : "Aceitar"}
                  </button>
                </Linha>
              );
            })}
          </ul>
        </>
      )}

      {financas.extrato.length > 0 && (
        <div className="extrato">
          <h2>Extrato</h2>
          <ul>
            {financas.extrato.slice(0, 20).map((l, i) => (
              <li key={i}>
                <span className="suave">{l.rodada ? `R${l.rodada}` : ""}</span>
                <span>{l.descricao}</span>
                <b className={l.valor < 0 ? "sai" : "ent"}>{formatarDinheiro(l.valor)}</b>
              </li>
            ))}
          </ul>
        </div>
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

function Linha({ j, clube, etiquetas = [], children }: { j: Jogador; clube: Time; etiquetas?: Etiqueta[]; children: React.ReactNode }) {
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
        {formatarDinheiro(salarioMensal(j))}/mês
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
