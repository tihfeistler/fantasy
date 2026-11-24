import { useEffect, useState } from "react";
import { buscarJogadores } from "../data/api";
import { POSICOES, type Jogador, type Posicao } from "../engine/types";

/** Catálogo das lendas vindo do MySQL pela API PHP. */
export function TelaLendas() {
  const [posicao, setPosicao] = useState<Posicao | "">("");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Jogador[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      buscarJogadores({ tipo: "classico", posicao: posicao || undefined, busca })
        .then((l) => {
          setLista(l);
          setErro(null);
        })
        .catch((e) => setErro(String(e.message ?? e)));
    }, 200);
    return () => clearTimeout(t);
  }, [posicao, busca]);

  return (
    <section className="tela">
      <div className="barra">
        <label>
          Posição{" "}
          <select value={posicao} onChange={(e) => setPosicao(e.target.value as Posicao | "")}>
            <option value="">Todas</option>
            {POSICOES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <input
          className="busca"
          placeholder="Buscar lenda..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {lista && <span className="suave">{lista.length} lendas</span>}
      </div>
      {erro && (
        <p className="aviso">
          Não consegui falar com a API PHP ({erro}). Confira se o Apache e o MySQL do XAMPP estão
          ligados e se você rodou o importador (veja docs/XAMPP.md).
        </p>
      )}
      <div className="cartas">
        {lista?.map((j) => (
          <div key={j.id} className={`carta raridade-${raridade(j.geral)}`}>
            <div className="carta-topo">
              <strong>{j.geral}</strong>
              <span>{j.posicao}</span>
            </div>
            <div className="carta-nome">{j.nome}</div>
            <div className="carta-info">
              {j.nacionalidade} · {j.auge}
            </div>
            <div className="carta-info">{j.clubeMarcante}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function raridade(geral: number) {
  if (geral >= 90) return "icone";
  if (geral >= 80) return "ouro";
  if (geral >= 70) return "prata";
  return "bronze";
}
