import { estiloEscudo } from "../data/clubes";
import { useMemo, useState } from "react";
import { escalar } from "../engine/ratings";
import type { Time } from "../engine/types";

interface Props {
  times: Time[];
  onCriar: (nome: string, clubeId: string) => void;
}

/** Primeira tela da carreira: nome do técnico e o clube, escolhido uma única vez. */
export function TelaNovoManager({ times, onCriar }: Props) {
  const [nome, setNome] = useState("");
  const [clubeId, setClubeId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  // Força = média do geral dos 11 titulares automáticos; ordena do mais forte ao mais fraco.
  const lista = useMemo(
    () =>
      times
        .map((t) => {
          const v = escalar({ ...t, titulares: [] });
          return { t, forca: Math.round(v.reduce((s, x) => s + x.jogador.geral, 0) / Math.max(1, v.length)) };
        })
        .sort((a, b) => b.forca - a.forca),
    [times],
  );
  const escolhido = lista.find((x) => x.t.id === clubeId);
  const nomeOk = nome.trim().length >= 2;

  const dificuldade = (f: number) => (f >= 78 ? "Favorito" : f >= 72 ? "Meio de tabela" : "Desafio");

  return (
    <section className="novo-manager">
      <div className="nm-cabeca">
        <div className="marca">
          Fantasy<span>Manager</span>
        </div>
        <h1>Nova carreira</h1>
        <p className="suave">
          Escolha seu nome de técnico e o clube que vai comandar na Série A 2026. O clube fica com você até o fim da
          carreira.
        </p>
      </div>

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

      <h2>Escolha o clube</h2>
      <div className="nm-clubes" role="radiogroup" aria-label="Clubes">
        {lista.map(({ t, forca }) => (
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
            <span className="escudo" style={estiloEscudo(t.cor)}>
              {t.sigla}
            </span>
            <span className="nm-clube-nome">{t.nome}</span>
            <span className="nm-forca">
              <b>{forca}</b> força média
            </span>
            <span className={`nm-dif dif-${dificuldade(forca) === "Favorito" ? "fav" : dificuldade(forca) === "Desafio" ? "des" : "meio"}`}>
              {dificuldade(forca)}
            </span>
          </button>
        ))}
      </div>

      <div className="nm-rodape">
        {!confirmando ? (
          <>
            <span className="suave">
              {!nomeOk ? "Digite seu nome para continuar." : !escolhido ? "Escolha um clube." : `${nome.trim()} no ${escolhido.t.nome}.`}
            </span>
            <button className="botao primario" disabled={!nomeOk || !escolhido} onClick={() => setConfirmando(true)}>
              Começar carreira
            </button>
          </>
        ) : (
          <>
            <span>
              Confirmar <b>{escolhido?.t.nome}</b>? Depois não dá para trocar de clube nesta carreira.
            </span>
            <button className="botao" onClick={() => setConfirmando(false)}>
              Voltar
            </button>
            <button className="botao primario" onClick={() => onCriar(nome.trim(), clubeId!)}>
              Confirmar e começar
            </button>
          </>
        )}
      </div>
    </section>
  );
}
