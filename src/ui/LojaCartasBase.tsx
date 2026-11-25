import { useMemo, useState } from "react";
import { CLUBES } from "../data/clubes";
import { custoPorPartida, precoCartaBase, vendaCartaBase } from "../engine/desafios";
import { formatarDinheiro } from "../engine/mercado";
import { POSICOES, type Jogador } from "../engine/types";
import { setor } from "./CartaJogador";

interface Props {
  atuais: Jogador[];
  /** Ids das cartas base que o técnico já tem. */
  tenho: Set<string>;
  moedas: number;
  onComprar: (id: string) => void;
  onVender: (id: string) => void;
}

const POR_PAGINA = 40;

/** Loja de cartas base (jogadores atuais) do sistema: compra com moedas e venda por 40%. */
export function LojaCartasBase(p: Props) {
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState("");
  const [clube, setClube] = useState("");
  const [soMinhas, setSoMinhas] = useState(false);
  const [limite, setLimite] = useState(POR_PAGINA);

  const loja = useMemo(() => {
    const termo = busca.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return p.atuais
      .filter((j) => (!soMinhas || p.tenho.has(j.id)) && (!posicao || j.posicao === posicao) && (!clube || j.clubeId === clube))
      .filter((j) => !termo || j.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(termo))
      .sort((a, b) => b.geral - a.geral);
  }, [p.atuais, p.tenho, busca, posicao, clube, soMinhas]);

  return (
        <>
          <div className="barra">
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
              {POSICOES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select aria-label="Clube" value={clube} onChange={(e) => setClube(e.target.value)}>
              <option value="">Todos os clubes</option>
              {CLUBES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} /> Só as minhas
            </label>
          </div>
          <ul className="mercado-lista">
            {loja.slice(0, limite).map((j) => {
              const tenho = p.tenho.has(j.id);
              const preco = precoCartaBase(j);
              return (
                <li key={j.id} className="ml-linha">
                  <span className={`pos ml-pos setor-${setor(j.posicao)}`}>{j.posicao}</span>
                  <span className="ml-geral">{j.geral}</span>
                  <span className="ml-nome">
                    <b>{j.nome}</b>
                    <span className="suave">
                      {CLUBES.find((c) => c.id === j.clubeId)?.sigla} · {j.nacionalidade}
                    </span>
                  </span>
                  <span className="ml-num">
                    <span className="rotulo">Por partida</span>
                    {formatarDinheiro(custoPorPartida(j))}
                  </span>
                  <span className="ml-num">
                    <span className="rotulo">Venda ao sistema</span>
                    {vendaCartaBase(j)} moedas
                  </span>
                  <span className="ml-preco">
                    <span className="rotulo">Preço</span>
                    {preco} moedas
                  </span>
                  {tenho ? (
                    <button className="botao discreto" onClick={() => p.onVender(j.id)}>
                      Vender · {vendaCartaBase(j)}
                    </button>
                  ) : (
                    <button className="botao" disabled={p.moedas < preco} onClick={() => p.onComprar(j.id)}>
                      {p.moedas < preco ? "Moedas insuficientes" : "Comprar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {loja.length > limite && (
            <button className="botao mais" onClick={() => setLimite((l) => l + POR_PAGINA)}>
              Mostrar mais ({loja.length - limite} restantes)
            </button>
          )}
        </>
  );
}
