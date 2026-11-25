import { CLUBES, estadioDoClube } from "../data/clubes";
import { fatorBilheteria, fatorCasa, publicoMedio, rotuloNota } from "../engine/estadios";
import { Camisa } from "./Emblema";

/** Barra de uma nota de 1 a 100 (atmosfera, qualidade). */
function Nota({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="est-nota">
      <span>
        {rotulo} <b>{valor}</b> <span className="suave">{rotuloNota(valor)}</span>
      </span>
      <i>
        <i style={{ width: `${valor}%` }} />
      </i>
    </div>
  );
}

/** Estádio e uniformes de um clube: capacidade, atmosfera, qualidade e o efeito no jogo. */
export function CartaoEstadio({ clubeId }: { clubeId: string }) {
  const e = estadioDoClube(clubeId);
  const camisas = CLUBES.find((c) => c.id === clubeId)?.camisas;
  const fb = fatorBilheteria(e);
  const fc = fatorCasa(e);
  return (
    <div className="est-cartao">
      <div className="est-topo">
        <b className="est-nome">{e.nome}</b>
        <span className="suave">
          {e.capacidade.toLocaleString("pt-BR")} lugares · público médio {publicoMedio(e).toLocaleString("pt-BR")}
        </span>
      </div>
      <Nota rotulo="Atmosfera" valor={e.atmosfera} />
      <Nota rotulo="Qualidade" valor={e.qualidade} />
      <p className="suave est-efeito">
        Bilheteria {fb < 1 ? "−" : "+"}
        {Math.round(Math.abs(fb - 1) * 100)}% · força em casa +{Math.round((fc - 1) * 100)}%
      </p>
      {camisas && (
        <div className="est-camisas">
          {camisas.map((c, i) => (
            <figure key={i}>
              <Camisa modelo={c.modelo} cor={c.cor} cor2={c.cor2} tamanho={56} />
              <figcaption className="suave">{i === 0 ? "Principal" : "Reserva"}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
