import { chaveMissao, MISSOES, progressoDasMissoes, type ContextoMissoes, type Missao } from "../engine/missoes";

interface Props {
  contexto: ContextoMissoes;
  pagas: string[];
}

/** Missões da carreira: a forma de ganhar moedas durante a temporada. */
export function TelaMissoes({ contexto, pagas }: Props) {
  const feito = progressoDasMissoes(contexto);
  const ja = new Set(pagas);
  const ano = contexto.temporada.ano;
  const lista = (ms: Missao[]) => (
    <ul className="missoes">
      {ms.map((m) => {
        const valor = Math.min(feito[m.id] ?? 0, m.meta);
        const paga = ja.has(chaveMissao(m, ano));
        return (
          <li key={m.id} className={paga ? "feita" : ""}>
            <div className="missao-texto">
              <b>{m.nome}</b>
              <span className="suave">{m.descricao}</span>
              {m.meta > 1 && (
                <div className="progresso" aria-label={`${valor} de ${m.meta}`}>
                  <i style={{ width: `${(valor / m.meta) * 100}%` }} />
                </div>
              )}
            </div>
            <span className="missao-premio">
              {paga ? (
                "Cumprida"
              ) : (
                <>
                  {m.meta > 1 && (
                    <span className="suave">
                      {valor}/{m.meta} ·{" "}
                    </span>
                  )}
                  <span className="moeda" aria-hidden="true" /> {m.moedas.toLocaleString("pt-BR")}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
  return (
    <section className="tela">
      <p className="suave">
        Moedas entram por missões, desafios e pela premiação do fim da temporada. Partida não paga moedas: em casa, o
        jogo rende a bilheteria no caixa.
      </p>
      <div className="fin-grade">
        <article className="esc-cartao">
          <h2>Temporada {ano}</h2>
          {lista(MISSOES.filter((m) => m.temporada))}
        </article>
        <article className="esc-cartao">
          <h2>Conquistas</h2>
          <p className="suave">Valem uma vez na carreira.</p>
          {lista(MISSOES.filter((m) => !m.temporada))}
        </article>
      </div>
    </section>
  );
}
