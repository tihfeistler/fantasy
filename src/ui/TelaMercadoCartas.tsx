import { useState } from "react";
import { comTaxa, precoReferencia, PRECO_MAXIMO, PRECO_MINIMO, type MercadoCartas } from "../engine/mercadoCartas";
import type { Jogador } from "../engine/types";
import { CartaJogador } from "./CartaJogador";

interface Props {
  mercado: MercadoCartas;
  lendas: Map<string, Jogador>;
  moedas: number;
  semEspaco: boolean;
  /** Resultado da última ação (ex.: resposta a uma proposta). */
  aviso: string | null;
  onComprar: (anuncioId: string) => void;
  onPropor: (anuncioId: string, valor: number) => void;
  onCancelar: (anuncioId: string) => void;
  onAceitar: (propostaId: string) => void;
  onRecusar: (propostaId: string) => void;
}

const valido = (v: number) => Number.isInteger(v) && v >= PRECO_MINIMO && v <= PRECO_MAXIMO;

export function TelaMercadoCartas(p: Props) {
  const { mercado, lendas, moedas } = p;
  const [propondo, setPropondo] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const anuncios = mercado.anuncios
    .map((a) => ({ a, j: lendas.get(a.jogadorId) }))
    .filter((x): x is { a: (typeof mercado.anuncios)[number]; j: Jogador } => !!x.j)
    .sort((x, y) => y.j.geral - x.j.geral);

  return (
    <>
      <p className="simulacao">
        <b>Simulação.</b> Na prévia, os outros técnicos são simulados: eles anunciam cartas, compram as suas e mandam
        propostas a cada rodada. No jogo online serão técnicos de verdade, com contas no servidor.
      </p>
      <p className="suave nota-financas">
        Lendas só vêm de pacotes ou de outros técnicos. Aqui você define o preço e paga 5% de taxa quando vende. No
        Estoque você pode anunciar uma carta ou vendê-la ao sistema pelo preço básico, que é bem menor.
      </p>
      {p.aviso && <p className="aviso">{p.aviso}</p>}

      {mercado.recebidas.length > 0 && (
        <>
          <h2>Propostas recebidas</h2>
          <ul className="mercado-lista">
            {mercado.recebidas.map((pr) => {
              const j = lendas.get(pr.jogadorId);
              const anuncio = mercado.meus.find((a) => a.id === pr.anuncioId);
              return (
                <li key={pr.id} className="ml-linha ml-proposta">
                  <span className="ml-nome">
                    <b>
                      {pr.de} oferece {pr.valor} por {j?.nome}
                    </b>
                    <span className="suave">
                      Seu anúncio: {anuncio?.preco} · você recebe {comTaxa(pr.valor)} depois da taxa
                    </span>
                  </span>
                  <button className="botao primario" onClick={() => p.onAceitar(pr.id)}>
                    Aceitar
                  </button>
                  <button className="botao" onClick={() => p.onRecusar(pr.id)}>
                    Recusar
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="espaco-topo">
        À venda <span className="suave">{anuncios.length} cartas de outros técnicos</span>
      </h2>
      <div className="grade-cartas">
        {anuncios.map(({ a, j }) => {
          const sem = moedas < a.preco;
          const ref = precoReferencia(j);
          const v = Number(valor);
          return (
            <div key={a.id} className="carta-acoes">
              <CartaJogador jogador={j} />
              <span className="anuncio-info">
                <span className="suave">{a.vendedor}</span>
                <b>
                  <span className="moeda" aria-hidden="true" /> {a.preco}
                </b>
                <span className={`preco-ref ${a.preco <= ref ? "barato" : "caro"}`} title={`Preço de referência: ${ref}`}>
                  {a.preco <= ref ? "abaixo da referência" : "acima da referência"}
                </span>
              </span>
              <button
                className="botao primario"
                disabled={sem || p.semEspaco}
                onClick={() => p.onComprar(a.id)}
              >
                {p.semEspaco ? "Estoque cheio" : sem ? "Moedas insuficientes" : "Comprar"}
              </button>
              {propondo === a.id ? (
                <form
                  className="proposta-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!valido(v) || v > moedas) return;
                    p.onPropor(a.id, v);
                    setPropondo(null);
                  }}
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    min={PRECO_MINIMO}
                    max={Math.min(moedas, a.preco)}
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    aria-label={`Sua proposta por ${j.nome}`}
                    autoFocus
                  />
                  <button className="botao" type="submit" disabled={!valido(v) || v > moedas || p.semEspaco}>
                    Enviar
                  </button>
                </form>
              ) : (
                <button
                  className="botao discreto"
                  disabled={p.semEspaco}
                  onClick={() => {
                    setPropondo(a.id);
                    setValor(String(Math.min(moedas, Math.round((a.preco * 0.85) / 10) * 10)));
                  }}
                >
                  Fazer proposta
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="espaco-topo">
        Seus anúncios <span className="suave">{mercado.meus.length}</span>
      </h2>
      {mercado.meus.length ? (
        <div className="grade-cartas">
          {mercado.meus.map((a) => {
            const j = lendas.get(a.jogadorId);
            if (!j) return null;
            return (
              <div key={a.id} className="carta-acoes">
                <CartaJogador jogador={j} />
                <span className="anuncio-info">
                  <span className="suave">Seu preço</span>
                  <b>
                    <span className="moeda" aria-hidden="true" /> {a.preco}
                  </b>
                </span>
                <button className="botao" onClick={() => p.onCancelar(a.id)}>
                  Tirar do mercado
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="vazio-bloco">Nenhuma carta anunciada. Anuncie pelo Estoque, no botão "Anunciar".</p>
      )}

      {mercado.movimentos.length > 0 && (
        <div className="extrato">
          <h2>Movimentos</h2>
          <ul>
            {mercado.movimentos.slice(0, 15).map((m, i) => (
              <li key={i}>
                <span className="suave">{m.rodada ? `R${m.rodada}` : ""}</span>
                <span>{m.texto}</span>
                <b className={m.moedas < 0 ? "sai" : "ent"}>
                  {m.moedas > 0 ? "+" : ""}
                  {m.moedas || ""}
                </b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
