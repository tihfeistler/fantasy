import {
  AMPLIACAO,
  CARTAS_POR_PACOTE,
  CHANCES,
  faixa,
  LIMITE_CARTAS_MAXIMO,
  MAX_LENDAS_EM_CAMPO,
  PRECO_PACOTE,
  valorDeVenda,
} from "../engine/pacotes";
import type { Jogador, Time } from "../engine/types";
import { useState } from "react";
import { precoReferencia, PRECO_MAXIMO, PRECO_MINIMO } from "../engine/mercadoCartas";
import { copias, limiteCartas, totalCartas, type Progresso } from "../data/progresso";
import { CartaJogador } from "./CartaJogador";
import { Modal } from "./Modal";

interface Props {
  progresso: Progresso;
  lendas: Map<string, Jogador>;
  meuTime: Time;
  pacoteAberto: Jogador[] | null;
  onFecharPacote: () => void;
  onComprar: () => void;
  onAmpliar: () => void;
  /** Anuncia a carta do estoque (índice) no mercado entre técnicos. */
  onAnunciar: (indice: number, preco: number) => void;
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
  const total = totalCartas(progresso);
  const limite = limiteCartas(progresso);
  const semEspaco = total + CARTAS_POR_PACOTE > limite;
  const semMoedas = progresso.moedas < PRECO_PACOTE;
  const ampliavel = limite < LIMITE_CARTAS_MAXIMO;
  const [anunciando, setAnunciando] = useState<{ i: number; j: Jogador } | null>(null);
  const [preco, setPreco] = useState("");
  const precoNum = Number(preco);
  const precoOk = Number.isInteger(precoNum) && precoNum >= PRECO_MINIMO && precoNum <= PRECO_MAXIMO;

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
        <button className="botao primario" onClick={p.onComprar} disabled={semMoedas || semEspaco}>
          {semEspaco ? "Estoque cheio" : semMoedas ? "Moedas insuficientes" : `Abrir pacote · ${PRECO_PACOTE}`}
        </button>
      </div>

      <div className={`espaco-cartas${semEspaco ? " cheio" : ""}`}>
        <div className="espaco-info">
          <span className="rotulo">Espaço para cartas</span>
          <b>
            {total} de {limite}
          </b>
          <div className="espaco-barra" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (total / limite) * 100)}%` }} />
          </div>
          <span className="suave">
            {semEspaco
              ? `Falta espaço para um pacote de ${CARTAS_POR_PACOTE} cartas. Venda cartas ou amplie o espaço.`
              : "Conta o estoque e as lendas no elenco."}
          </span>
        </div>
        {ampliavel ? (
          <button className="botao" onClick={p.onAmpliar} disabled={progresso.moedas < AMPLIACAO.preco}>
            Ampliar +{AMPLIACAO.cartas} · {AMPLIACAO.preco}
          </button>
        ) : (
          <span className="suave">Espaço máximo</span>
        )}
      </div>

      <h2>
        Lendas no elenco do {meuTime.nome}{" "}
        <span className="suave">
          {noElenco.length} {noElenco.length === 1 ? "lenda" : "lendas"} · até {MAX_LENDAS_EM_CAMPO} jogam como titulares
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
                  disabled={jaNoElenco}
                >
                  {jaNoElenco ? "Já está no elenco" : "Levar para o elenco"}
                </button>
                <button
                  className="botao"
                  onClick={() => {
                    setAnunciando({ i, j });
                    setPreco(String(precoReferencia(j)));
                  }}
                >
                  Anunciar a técnicos
                </button>
                <button
                  className="botao discreto"
                  onClick={() => p.onVender(i)}
                  title="Venda imediata ao sistema pelo preço básico"
                >
                  Vender ao sistema · {valorDeVenda(j, copias(progresso, j.id))}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="vazio-bloco">Seu estoque está vazio. Abra um pacote para ganhar cartas de lendas.</p>
      )}

      {anunciando && (
        <Modal titulo={`Anunciar ${anunciando.j.nome}`} onFechar={() => setAnunciando(null)}>
          <form
            className="anunciar-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!precoOk) return;
              p.onAnunciar(anunciando.i, precoNum);
              setAnunciando(null);
            }}
          >
            <CartaJogador jogador={anunciando.j} />
            <div>
              <label className="campo-form">
                <span className="rotulo">Preço em moedas</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={PRECO_MINIMO}
                  max={PRECO_MAXIMO}
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  autoFocus
                />
              </label>
              <p className="suave">
                Preço de referência: {precoReferencia(anunciando.j)}. Vendendo ao sistema você receberia{" "}
                {valorDeVenda(anunciando.j, copias(progresso, anunciando.j.id))}. Quanto mais barato, mais rápido outro
                técnico compra. Na venda sai uma taxa de 5%: você recebe {precoOk ? precoNum - Math.ceil(precoNum * 0.05) : "–"}.
              </p>
              <p className="suave">A carta sai do estoque enquanto estiver anunciada. Dá para tirar do mercado a qualquer momento.</p>
              <button className="botao primario" type="submit" disabled={!precoOk}>
                Anunciar
              </button>
            </div>
          </form>
        </Modal>
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
