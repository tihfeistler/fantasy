import { Escudo } from "./Emblema";
import { DIVISOES_INICIAIS } from "../data/clubes";
import { useMemo, useState } from "react";
import { escalar } from "../engine/ratings";
import { LIGAS } from "../engine/ligas";
import type { Time } from "../engine/types";
import { problemaNaIdentidade, type Identidade } from "../engine/timeProprio";
import { CamposTimeProprio, IDENTIDADE_INICIAL } from "./TelaTimeProprio";

interface Props {
  times: Time[];
  /** Na conta, o nome do técnico vem do cadastro e não muda. */
  nomeFixo?: string | null;
  onCriar: (nome: string, clubeId: string) => void;
  /** Demonstração: criar o próprio time (o elenco sai de um draft). */
  onCriarTime?: (nome: string, identidade: Identidade) => void;
}

/**
 * Escolha do clube da carreira, uma única vez por conta. Contas novas já escolhem no cadastro;
 * esta tela fica para a demonstração e para contas antigas sem carreira.
 */
export function TelaNovoManager({
  times,
  nomeFixo,
  onCriar,
  onCriarTime,
}: Props) {
  const [proprio, setProprio] = useState(false);
  const [identidade, setIdentidade] = useState<Identidade>(IDENTIDADE_INICIAL);
  const [tocado, setTocado] = useState(false);
  const [nome, setNome] = useState(nomeFixo ?? "");
  const [clubeId, setClubeId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pais, setPais] = useState("Brasil");

  // Força = média do geral dos 11 titulares automáticos; ordena do mais forte ao mais fraco.
  const lista = useMemo(
    () =>
      times
        .map((t) => {
          const v = escalar({ ...t, titulares: [] });
          return {
            t,
            forca: Math.round(
              v.reduce((s, x) => s + x.jogador.geral, 0) /
                Math.max(1, v.length),
            ),
          };
        })
        .sort((a, b) => b.forca - a.forca),
    [times],
  );
  const escolhido = lista.find((x) => x.t.id === clubeId);
  const nomeOk = nome.trim().length >= 2;

  // Dificuldade pela posição na própria divisão: terço de cima, do meio e de baixo.
  const porDivisao = LIGAS.filter((l) => l.pais === pais).map((l) => ({
    d: l.id,
    nome: l.nome,
    clubes: lista.filter((x) => DIVISOES_INICIAIS[x.t.id] === l.id),
  }));
  const paises = [...new Set(LIGAS.map((l) => l.pais))];
  const dificuldade = (i: number, n: number) =>
    i < n / 3 ? "Favorito" : i < (2 * n) / 3 ? "Meio de tabela" : "Desafio";

  return (
    <section className="novo-manager">
      <div className="nm-cabeca">
        <div className="marca">
          Fantasy<span>Manager</span>
        </div>
        <h1>Sua carreira</h1>
        <p className="suave">
          {nomeFixo ? "Escolha" : "Escolha seu nome de técnico e"} o clube que
          vai comandar em 2026, em qualquer divisão de {paises.length} países:
          Brasil e Inglaterra até a 4ª divisão, os outros até a 2ª, todos com
          acesso e rebaixamento. O clube fica com você até o fim da carreira, e
          o mercado compra de qualquer liga. Cada conta tem uma carreira só:
          para comandar outro clube, só com outra conta.
        </p>
      </div>

      {!nomeFixo && (
        <label className="nm-nome" htmlFor="nome-manager">
          <span className="rotulo">Nome do técnico</span>
          <input
            id="nome-manager"
            className="busca"
            maxLength={40}
            placeholder="Ex.: Tiago Feistler"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
      )}

      {onCriarTime && (
        <div className="alternar" role="tablist" aria-label="Seu time">
          <button
            role="tab"
            aria-selected={!proprio}
            className={!proprio ? "ativo" : ""}
            onClick={() => setProprio(false)}
          >
            Assumir um clube
          </button>
          <button
            id="nm-criar-time"
            role="tab"
            aria-selected={proprio}
            className={proprio ? "ativo" : ""}
            onClick={() => setProprio(true)}
          >
            Criar meu time
          </button>
        </div>
      )}

      {proprio && onCriarTime ? (
        <div className="caixa-entrar cadastro nm-proprio">
          <CamposTimeProprio
            valor={identidade}
            onChange={setIdentidade}
            tocado={tocado}
          />
          <button
            className="botao primario"
            onClick={() => {
              setTocado(true);
              if (nomeOk && !problemaNaIdentidade(identidade))
                onCriarTime(nome.trim(), identidade);
            }}
          >
            Montar o elenco no draft
          </button>
          {tocado && !nomeOk && (
            <span className="cad-erro">Digite seu nome de técnico.</span>
          )}
        </div>
      ) : (
        <>
          <div className="alternar nm-paises" role="tablist" aria-label="País">
            {paises.map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={pais === p}
                className={pais === p ? "ativo" : ""}
                onClick={() => setPais(p)}
              >
                {p}
              </button>
            ))}
          </div>

          {porDivisao.map(({ d, nome, clubes }) => (
            <div key={d}>
              <h2>{nome}</h2>
              <div
                className="nm-clubes"
                role="radiogroup"
                aria-label={`Clubes da ${nome}`}
              >
                {clubes.map(({ t, forca }, i) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={clubeId === t.id}
                    className={`nm-clube${clubeId === t.id ? " escolhido" : ""}`}
                    onClick={() => {
                      setClubeId(t.id);
                      setConfirmando(false);
                    }}
                  >
                    <Escudo time={t} className="escudo" />
                    <span className="nm-clube-nome">{t.nome}</span>
                    <span className="nm-forca">
                      <b>{forca}</b> força média
                    </span>
                    <span
                      className={`nm-dif dif-${{ Favorito: "fav", Desafio: "des", "Meio de tabela": "meio" }[dificuldade(i, clubes.length)]}`}
                    >
                      {dificuldade(i, clubes.length)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="nm-rodape">
            {!confirmando ? (
              <>
                <span className="suave">
                  {!nomeOk
                    ? "Digite seu nome para continuar."
                    : !escolhido
                      ? "Escolha um clube."
                      : `${nome.trim()} no ${escolhido.t.nome}.`}
                </span>
                <button
                  className="botao primario"
                  disabled={!nomeOk || !escolhido}
                  onClick={() => setConfirmando(true)}
                >
                  Começar carreira
                </button>
              </>
            ) : (
              <>
                <span>
                  Confirmar <b>{escolhido?.t.nome}</b>? Depois não dá para
                  trocar de clube nem começar outra carreira nesta conta.
                </span>
                <button className="botao" onClick={() => setConfirmando(false)}>
                  Voltar
                </button>
                <button
                  className="botao primario"
                  onClick={() => onCriar(nome.trim(), clubeId!)}
                >
                  Confirmar e começar
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
