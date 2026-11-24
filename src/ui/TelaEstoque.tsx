import { CARTAS_POR_PACOTE, CHANCES, faixa, MAX_LENDAS_NO_ELENCO, PRECO_PACOTE, VALOR_VENDA } from "../engine/pacotes";
import type { Jogador, Time } from "../engine/types";
import type { Progresso } from "../data/progresso";
import { CartaJogador } from "./CartaJogador";
import { Modal } from "./Modal";

interface Props {
  progresso: Progresso;
  lendas: Map<string, Jogador>;
  meuTime: Time;
  pacoteAberto: Jogador[] | null;
  onFecharPacote: () => void;
  onComprar: () => void;
  onVender: (indice: number) => void;
  onLevar: (indice: number) => void;
  onDevolver: (id: string) => void;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function TelaEstoque(p: Props) {
  const { progresso, lendas, meuTime } = p;
  const noElenco = (progresso.noElenco[meuTime.id] ?? []).map((id) => lendas.get(id)).filter(Boolean) as Jogador[];
  const estoque = progresso.estoque
    .map((id, i) => ({ j: lendas.get(id), i }))
    .filter((x): x is { j: Jogador; i: number } => !!x.j)
    .sort((a, b) => b.j.geral - a.j.geral);
  const cheio = noElenco.length >= MAX_LENDAS_NO_ELENCO;
  const semMoedas = progresso.moedas < PRECO_PACOTE;

  return (
    <section className="tela">
      <div className="loja">
        <div className="pacote-arte" aria-hidden="true">
          <span>Pacote</span>
          <b>Lendas</b>
        </div>
        <div className="loja-texto">
          <h2>Pacote de lendas</h2>
          <p className="suave">
            {CARTAS_POR_PACOTE} cartas por {PRECO_PACOTE} moedas. Chance por carta: comum (geral até 79){" "}
            {pct(CHANCES.comum)}, rara (80 a 87) {pct(CHANCES.rara)}, ícone (88 ou mais) {pct(CHANCES.icone)}.
          </p>
          <p className="suave">
            Você ganha moedas jogando: {300} por vitória, {150} por empate e {50} por derrota.
          </p>
        </div>
        <button className="botao primario" onClick={p.onComprar} disabled={semMoedas}>
          {semMoedas ? "Moedas insuficientes" : `Abrir pacote · ${PRECO_PACOTE}`}
        </button>
      </div>

      <h2>
        Lendas no elenco do {meuTime.nome}{" "}
        <span className="suave">
          {noElenco.length} de {MAX_LENDAS_NO_ELENCO}
        </span>
      </h2>
      {noElenco.length ? (
        <div className="grade-cartas">
          {noElenco.map((j) => (
            <div key={j.id} className="carta-acoes">
              <CartaJogador jogador={j} />
              <button className="botao" onClick={() => p.onDevolver(j.id)}>
                Devolver ao estoque
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="vazio-bloco">Nenhuma lenda no elenco. Leve uma carta do estoque para o seu time.</p>
      )}

      <h2 className="espaco-topo">
        Estoque <span className="suave">{estoque.length} cartas</span>
      </h2>
      {estoque.length ? (
        <div className="grade-cartas">
          {estoque.map(({ j, i }) => {
            const jaNoElenco = noElenco.some((x) => x.id === j.id);
            return (
              <div key={`${j.id}-${i}`} className="carta-acoes">
                <CartaJogador jogador={j} />
                <button
                  className="botao"
                  onClick={() => p.onLevar(i)}
                  disabled={cheio || jaNoElenco}
                  title={cheio ? `Limite de ${MAX_LENDAS_NO_ELENCO} lendas no elenco` : undefined}
                >
                  {jaNoElenco ? "Já está no elenco" : "Levar para o elenco"}
                </button>
                <button className="botao discreto" onClick={() => p.onVender(i)}>
                  Vender · {VALOR_VENDA[faixa(j)]}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="vazio-bloco">Seu estoque está vazio. Abra um pacote para ganhar cartas de lendas.</p>
      )}

      {p.pacoteAberto && (
        <Modal titulo="Cartas do pacote" onFechar={p.onFecharPacote}>
          <div className="pacote-revelado">
            {p.pacoteAberto.map((j, i) => (
              <div key={`${j.id}-${i}`} className="revelar" style={{ animationDelay: `${i * 0.15}s` }}>
                <CartaJogador jogador={j} />
                <span className={`faixa faixa-${faixa(j)}`}>{faixa(j) === "icone" ? "ícone" : faixa(j)}</span>
              </div>
            ))}
          </div>
          <p className="suave">As cartas foram para o seu estoque.</p>
        </Modal>
      )}
    </section>
  );
}
