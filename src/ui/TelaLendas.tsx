import { useEffect, useState } from "react";
import { buscarJogadores, filtrarLocal, LENDAS_EMBUTIDAS } from "../data/api";
import { POSICOES, type Jogador, type Posicao } from "../engine/types";
import { CartaJogador } from "./CartaJogador";

/** Catálogo das lendas: vem do MySQL pela API PHP ou, sem servidor, dos dados embutidos. */
export function TelaLendas() {
  const [posicao, setPosicao] = useState<Posicao | "">("");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Jogador[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const filtro = { tipo: "classico" as const, posicao: posicao || undefined, busca };
      buscarJogadores(filtro)
        .then((l) => {
          setLista(l);
          setErro(null);
          setOffline(false);
        })
        .catch((e) => {
          if (LENDAS_EMBUTIDAS.length) {
            setLista(filtrarLocal(LENDAS_EMBUTIDAS, filtro));
            setOffline(true);
            setErro(null);
          } else setErro(String(e.message ?? e));
        });
    }, 200);
    return () => clearTimeout(t);
  }, [posicao, busca]);

  return (
    <section className="tela">
      <div className="barra">
        <div className="alternar" role="group" aria-label="Filtrar por posição">
          <button className={posicao === "" ? "ativo" : ""} onClick={() => setPosicao("")}>
            Todas
          </button>
          {POSICOES.map((p) => (
            <button key={p} className={posicao === p ? "ativo" : ""} onClick={() => setPosicao(p)}>
              {p}
            </button>
          ))}
        </div>
        <input
          id="busca-lenda"
          className="busca"
          placeholder="Buscar lenda pelo nome"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {lista && (
          <span className="suave">
            {lista.length} lendas{offline ? " · dados embutidos, sem servidor" : ""}
          </span>
        )}
      </div>
      {erro && (
        <p className="aviso">
          Não consegui falar com a API PHP ({erro}). Confira se o Apache e o MySQL do XAMPP estão ligados e se você
          rodou o importador (veja docs/XAMPP.md).
        </p>
      )}
      <div className="grade-cartas">
        {lista?.map((j) => (
          <CartaJogador key={j.id} jogador={j} />
        ))}
      </div>
    </section>
  );
}
