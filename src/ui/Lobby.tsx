import { nomeCurto, nomeDaLiga } from "../engine/ligas";
import { estiloEscudo } from "../data/clubes";
import { formatarDinheiro } from "../engine/mercado";
import type { Time } from "../engine/types";
import { Icone, type NomeIcone } from "./Icones";

export type Modo = "carreira" | "desafios" | "ranqueado" | "colecao";

export interface ResumoCarreira {
  divisao: string;
  ano: number;
  rodada: number;
  totalRodadas: number;
  posicao: number;
  fim: boolean;
  proximo: { adv: Time; casa: boolean } | null;
}

interface Props {
  tecnico: string;
  meuTime: Time;
  carreira: ResumoCarreira;
  caixa: number;
  moedas: number;
  desafios: { vitorias: number; total: number };
  /** Conta logada; sem ela, é a demonstração sem servidor. */
  conta: { nome: string; onSair: () => void } | null;
  colecao: { cartas: number; limite: number; noEstoque: number; propostas: number };
  onEntrar: (m: Modo) => void;
  onNovaCarreira: () => void;
}

/** Tela inicial: menu principal com os modos de jogo e um resumo de cada um. */
export function Lobby(p: Props) {
  const { meuTime, carreira: c } = p;
  return (
    <section className="lobby" style={{ "--cor-clube": meuTime.cor } as React.CSSProperties}>
      <div className="lobby-luzes" aria-hidden="true" />
      <header className="lobby-topo">
        <div className="marca grande">
          Fantasy<span>Manager</span>
        </div>
        <div className="lobby-tecnico">
          <span className="escudo" style={estiloEscudo(meuTime.cor)}>
            {meuTime.sigla}
          </span>
          <span className="clube-info">
            <b>{p.tecnico}</b>
            <span className="suave">Técnico do {meuTime.nome}</span>
          </span>
        </div>
        <div className="lobby-saldos">
          {p.conta ? (
            <span className="lobby-conta">
              Conta <b>{p.conta.nome}</b>
              <button className="link-nome" onClick={p.conta.onSair}>
                Sair
              </button>
            </span>
          ) : (
            <span className="lobby-conta demo">Demonstração: nada fica salvo na conta</span>
          )}
          <span className="moedas caixa" title="Caixa do clube">
            <b>{formatarDinheiro(p.caixa)}</b>
            <span className="suave">caixa</span>
          </span>
          <span className="moedas" title="Moedas para pacotes de lendas">
            <span className="moeda" aria-hidden="true" />
            <b>{p.moedas.toLocaleString("pt-BR")}</b>
            <span className="suave">moedas</span>
          </span>
        </div>
      </header>

      <div className="lobby-heroi">
        <span className="escudo enorme" style={estiloEscudo(meuTime.cor)}>
          {meuTime.sigla}
        </span>
        <h1>{meuTime.nome}</h1>
        <p>
          {nomeDaLiga(c.divisao)} {c.ano} · <b>{c.posicao}º lugar</b>
        </p>
      </div>

      <div className="lobby-menu">
        <button className="lobby-item principal" onClick={() => p.onEntrar("carreira")}>
          <span className="lobby-icone">
            <Icone nome="escritorio" tamanho={30} />
          </span>
          <span className="lobby-texto">
            <span className="rotulo">
              Carreira · {nomeCurto(c.divisao)} {c.ano}
            </span>
            <b>{c.fim ? "Temporada encerrada" : `Rodada ${c.rodada} de ${c.totalRodadas}`}</b>
            <span className="lobby-detalhe">
              {c.posicao}º lugar na {nomeCurto(c.divisao)}
              {c.proximo && (
                <>
                  {" · "}Próximo: {c.proximo.casa ? "em casa" : "fora"} contra <b>{c.proximo.adv.nome}</b>
                </>
              )}
            </span>
          </span>
          <span className="lobby-acao">{c.fim ? "Ver o fim da temporada" : "Continuar"}</span>
        </button>
        <ItemMenu
          icone="desafios"
          titulo="Desafios"
          texto="Time de cartas contra adversários com lendas. Vença para ganhar caixa, moedas e cartas."
          info={`${p.desafios.vitorias} de ${p.desafios.total} vencidos`}
          onClick={() => p.onEntrar("desafios")}
        />
        <ItemMenu
          icone="online"
          titulo="Ranqueado"
          texto="Seu time de cartas ao vivo contra outros técnicos, de Bronze à Elite. Amistosos com amigos."
          info={p.conta ? "Salário e prêmios no caixa único" : "Precisa do servidor"}
          onClick={() => p.onEntrar("ranqueado")}
        />
        <ItemMenu
          icone="colecao"
          titulo="Coleção"
          texto="Abra pacotes, veja seu estoque de lendas e negocie cartas com outros técnicos."
          info={`${p.colecao.cartas} de ${p.colecao.limite} cartas${p.colecao.noEstoque ? ` · ${p.colecao.noEstoque} no estoque` : ""}`}
          alerta={p.colecao.propostas ? `${p.colecao.propostas} proposta${p.colecao.propostas > 1 ? "s" : ""}` : undefined}
          onClick={() => p.onEntrar("colecao")}
        />
      </div>

      <footer className="lobby-rodape">
        <button className="link-nome" onClick={p.onNovaCarreira}>
          Nova carreira
        </button>
      </footer>
    </section>
  );
}

function ItemMenu(p: { icone: NomeIcone; titulo: string; texto: string; info: string; alerta?: string; onClick: () => void }) {
  return (
    <button className="lobby-item" onClick={p.onClick}>
      <span className="lobby-icone">
        <Icone nome={p.icone} tamanho={26} />
      </span>
      <span className="lobby-texto">
        <b>
          {p.titulo}
          {p.alerta && <span className="contador">{p.alerta}</span>}
        </b>
        <span className="suave">{p.texto}</span>
        <span className="lobby-detalhe">{p.info}</span>
      </span>
    </button>
  );
}
