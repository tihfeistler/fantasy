import { useCallback, useEffect, useState } from "react";
import { online, type AnuncioOnline, type MinhasOnline } from "../data/online";
import { comTaxa, precoReferencia } from "../engine/mercadoCartas";
import { POSICOES, type Jogador } from "../engine/types";
import { setor } from "./CartaJogador";

interface Props {
  /** Avisa a tela de cima para recarregar moedas e cartas. */
  onMudou: () => void;
}

/**
 * Mercado de lendas entre técnicos reais (api/mercado.php): anúncios com
 * preço fixo, propostas, contraproposta e venda ao sistema pelo preço básico.
 * O vendedor paga 5% de taxa. Cartas base não circulam entre técnicos.
 */
export function TelaMercadoOnline({ onMudou }: Props) {
  const [modo, setModo] = useState<"comprar" | "minhas" | "propostas">("comprar");
  const [anuncios, setAnuncios] = useState<AnuncioOnline[] | null>(null);
  const [minhas, setMinhas] = useState<MinhasOnline | null>(null);
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState("");
  const [ordem, setOrdem] = useState("preco");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([online.anuncios({ busca, posicao, ordem }), online.minhas()]);
      setAnuncios(a);
      setMinhas(m);
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    }
  }, [busca, posicao, ordem]);
  // Recarrega ao trocar de seção e a cada 5 s (propostas de outros técnicos chegam sozinhas).
  useEffect(() => {
    recarregar();
    const id = setInterval(recarregar, 5000);
    return () => clearInterval(id);
  }, [recarregar, modo]);

  const fazer = async (acao: string, dados: object, sucesso: string) => {
    setAviso(null);
    try {
      await online.mercado(acao, dados);
      setAviso({ ok: true, texto: sucesso });
      onMudou();
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    }
    recarregar();
  };

  const pendentes = minhas?.recebidas.length ?? 0;
  const contras = minhas?.enviadas.filter((p) => p.status === "contraproposta").length ?? 0;

  return (
    <div className="mercado-online">
      <div className="alternar mercado-modos" role="group" aria-label="Mercado">
        <button className={modo === "comprar" ? "ativo" : ""} onClick={() => setModo("comprar")}>
          À venda
        </button>
        <button className={modo === "minhas" ? "ativo" : ""} onClick={() => setModo("minhas")}>
          Minhas lendas
        </button>
        <button className={modo === "propostas" ? "ativo" : ""} onClick={() => setModo("propostas")}>
          Propostas{pendentes + contras ? ` (${pendentes + contras})` : ""}
        </button>
      </div>
      <p className="suave">
        Só lendas são negociadas entre técnicos. Quem vende paga 5% de taxa. Saldo: <b>{minhas?.moedas ?? "–"} moedas</b>.
      </p>
      {aviso && <p className={aviso.ok ? "premio" : "aviso"}>{aviso.texto}</p>}

      {modo === "comprar" && (
        <>
          <div className="barra">
            <input
              className="busca"
              type="search"
              placeholder="Buscar lenda"
              aria-label="Buscar lenda"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select aria-label="Posição" value={posicao} onChange={(e) => setPosicao(e.target.value)}>
              <option value="">Todas as posições</option>
              {POSICOES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select aria-label="Ordem" value={ordem} onChange={(e) => setOrdem(e.target.value)}>
              <option value="preco">Menor preço</option>
              <option value="geral">Maior geral</option>
              <option value="recentes">Mais recentes</option>
            </select>
          </div>
          {anuncios && !anuncios.length && <p className="suave">Nenhuma lenda à venda com esses filtros.</p>}
          <ul className="mercado-lista">
            {anuncios?.map((a) => (
              <li key={a.anuncio_id} className="ml-linha">
                <Info j={a.jogador} extra={`de ${a.vendedor}`} />
                <span className="ml-num">
                  <span className="rotulo">Referência</span>
                  {precoReferencia(a.jogador)}
                </span>
                <span className="ml-preco">
                  <span className="rotulo">Preço</span>
                  {a.preco} moedas
                </span>
                <button
                  className="botao"
                  disabled={(minhas?.moedas ?? 0) < a.preco}
                  onClick={() => fazer("comprar", { anuncio_id: a.anuncio_id }, `${a.jogador.nome} é seu.`)}
                >
                  Comprar
                </button>
                <Valor
                  rotulo="Propor"
                  inicial={Math.max(10, Math.round((a.preco * 0.85) / 10) * 10)}
                  onEnviar={(v) =>
                    fazer("propor", { carta_id: a.carta_id, valor: v }, `Proposta de ${v} moedas enviada para ${a.vendedor}.`)
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {modo === "minhas" && (
        <>
          {minhas && !minhas.cartas.length && (
            <p className="suave">Você ainda não tem lendas online. Abra pacotes na seção Cartas ou compre aqui.</p>
          )}
          <ul className="mercado-lista">
            {minhas?.cartas.map((c) => (
              <li key={c.carta_id} className="ml-linha">
                <Info j={c.jogador} extra={c.anuncio_id ? `anunciada por ${c.preco} moedas` : "na sua coleção"} />
                {c.anuncio_id ? (
                  <>
                    <span className="ml-num">
                      <span className="rotulo">Você recebe</span>
                      {comTaxa(c.preco!)}
                    </span>
                    <button
                      className="botao discreto"
                      onClick={() => fazer("cancelar_anuncio", { anuncio_id: c.anuncio_id }, "Anúncio retirado.")}
                    >
                      Retirar anúncio
                    </button>
                  </>
                ) : (
                  <Valor
                    rotulo="Anunciar"
                    inicial={precoReferencia(c.jogador)}
                    onEnviar={(v) =>
                      fazer("anunciar", { carta_id: c.carta_id, preco: v }, `${c.jogador.nome} anunciado por ${v} moedas.`)
                    }
                  />
                )}
                <button
                  className="botao discreto"
                  onClick={() =>
                    fazer("vender_sistema", { carta_id: c.carta_id }, `Vendida ao sistema por ${c.venda_sistema} moedas.`)
                  }
                >
                  Vender ao sistema · {c.venda_sistema}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {modo === "propostas" && (
        <>
          <h3>Recebidas</h3>
          {!minhas?.recebidas.length && <p className="suave">Nenhuma proposta pelas suas cartas.</p>}
          <ul className="mercado-lista">
            {minhas?.recebidas.map((p) => (
              <li key={p.id} className="ml-linha">
                <Info j={p.jogador} extra={`${p.outro} oferece ${p.valor} moedas`} />
                {p.status === "contraproposta" ? (
                  <span className="suave">Você pediu {p.contra_valor}. Esperando {p.outro}.</span>
                ) : (
                  <>
                    <button
                      className="botao primario"
                      onClick={() => fazer("aceitar", { proposta_id: p.id }, `Vendida por ${p.valor} moedas (recebe ${comTaxa(p.valor)}).`)}
                    >
                      Aceitar · {p.valor}
                    </button>
                    <Valor
                      rotulo="Contraproposta"
                      inicial={Math.round((p.valor * 1.2) / 10) * 10}
                      onEnviar={(v) => fazer("contrapropor", { proposta_id: p.id, valor: v }, `Você pediu ${v} moedas.`)}
                    />
                    <button
                      className="botao discreto"
                      onClick={() => fazer("recusar", { proposta_id: p.id }, "Proposta recusada.")}
                    >
                      Recusar
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <h3>Enviadas</h3>
          {!minhas?.enviadas.length && <p className="suave">Você não fez propostas.</p>}
          <ul className="mercado-lista">
            {minhas?.enviadas.map((p) => (
              <li key={p.id} className="ml-linha">
                <Info j={p.jogador} extra={`para ${p.outro}: ${p.valor} moedas`} />
                {p.status === "contraproposta" ? (
                  <>
                    <span className="suave">{p.outro} pede {p.contra_valor} moedas.</span>
                    <button
                      className="botao primario"
                      disabled={(minhas?.moedas ?? 0) < (p.contra_valor ?? 0)}
                      onClick={() => fazer("aceitar_contra", { proposta_id: p.id }, `${p.jogador.nome} é seu.`)}
                    >
                      Aceitar · {p.contra_valor}
                    </button>
                    <button
                      className="botao discreto"
                      onClick={() => fazer("recusar_contra", { proposta_id: p.id }, "Contraproposta recusada.")}
                    >
                      Recusar
                    </button>
                  </>
                ) : p.status === "aberta" ? (
                  <>
                    <span className="suave">Esperando resposta.</span>
                    <button
                      className="botao discreto"
                      onClick={() => fazer("cancelar_proposta", { proposta_id: p.id }, "Proposta cancelada.")}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <span className={`status-prop st-${p.status}`}>{p.status}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Info({ j, extra }: { j: Jogador; extra: string }) {
  return (
    <>
      <span className={`pos ml-pos setor-${setor(j.posicao)}`}>{j.posicao}</span>
      <span className="ml-geral">{j.geral}</span>
      <span className="ml-nome">
        <b>{j.nome}</b>
        <span className="suave">
          {j.auge ?? ""} · {extra}
        </span>
      </span>
    </>
  );
}

/** Campo de moedas com botão: anunciar, propor ou contrapropor. */
function Valor({ rotulo, inicial, onEnviar }: { rotulo: string; inicial: number; onEnviar: (v: number) => void }) {
  const [v, setV] = useState(String(inicial));
  const n = Number(v);
  return (
    <form
      className="proposta-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (Number.isInteger(n) && n >= 10) onEnviar(n);
      }}
    >
      <input
        type="number"
        min={10}
        step={10}
        inputMode="numeric"
        aria-label={`${rotulo} (moedas)`}
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <button className="botao" disabled={!Number.isInteger(n) || n < 10}>
        {rotulo}
      </button>
    </form>
  );
}
