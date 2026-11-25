import type { Divisao } from "../engine/campeonato";
import {
  formatarDinheiro,
  JUROS_DIVIDA,
  PONTOS_DE_PUNICAO,
  RODADAS_ATE_PUNICAO,
  RODADAS_POR_MES,
  valorDoElenco,
  type Financas,
} from "../engine/mercado";
import type { Time } from "../engine/types";

interface Props {
  meuTime: Time;
  financas: Financas;
  folha: number;
  noVermelho: number;
  divisao: Divisao;
}

/** Finanças do clube: indicadores, como o dinheiro entra e sai, e o extrato. */
export function TelaFinancas({ meuTime, financas, folha, noVermelho, divisao }: Props) {
  const ultimo = financas.extrato[0]?.rodada;
  const saldoUltima = financas.extrato.filter((l) => l.rodada === ultimo).reduce((s, l) => s + l.valor, 0);
  const salarioRodada = Math.round(folha / RODADAS_POR_MES);
  const saldoCasa = financas.receitaPorRodada + financas.bilheteria - salarioRodada;
  const saldoFora = financas.receitaPorRodada - salarioRodada;
  return (
    <section className="tela">
      <div className="financas">
        <Indicador rotulo="Caixa" valor={formatarDinheiro(financas.caixa)} sinal={financas.caixa < 0 ? -1 : 1} />
        <Indicador rotulo="Folha mensal" valor={formatarDinheiro(folha)} />
        <Indicador rotulo="Valor do elenco" valor={formatarDinheiro(valorDoElenco(meuTime))} />
        <Indicador
          rotulo={ultimo ? `Saldo da rodada ${ultimo}` : "Saldo da última rodada"}
          valor={ultimo ? formatarDinheiro(saldoUltima) : "–"}
          sinal={ultimo ? Math.sign(saldoUltima) : 0}
        />
      </div>
      {financas.caixa < 0 && (
        <p className="aviso">
          Caixa negativo: contratações travadas e juros de {Math.round(JUROS_DIVIDA * 100)}% da dívida por rodada. Rodadas
          seguidas no vermelho: {noVermelho} de {RODADAS_ATE_PUNICAO}. Na {RODADAS_ATE_PUNICAO}ª, o clube perde{" "}
          {PONTOS_DE_PUNICAO} pontos na tabela.
        </p>
      )}

      <div className="fin-grade">
        <article className="esc-cartao">
          <h2>Por rodada</h2>
          <ul className="fin-linhas">
            <li>
              <span>TV e patrocínio{divisao === "B" ? " (Série B: metade)" : ""}</span>
              <b className="ent">{formatarDinheiro(financas.receitaPorRodada)}</b>
            </li>
            <li>
              <span>Bilheteria (só em casa)</span>
              <b className="ent">{formatarDinheiro(financas.bilheteria)}</b>
            </li>
            <li>
              <span>Salários (um quarto da folha)</span>
              <b className="sai">{formatarDinheiro(-salarioRodada)}</b>
            </li>
            <li className="total">
              <span>Saldo em casa / fora</span>
              <b>
                <span className={saldoCasa < 0 ? "sai" : "ent"}>{formatarDinheiro(saldoCasa)}</span> /{" "}
                <span className={saldoFora < 0 ? "sai" : "ent"}>{formatarDinheiro(saldoFora)}</span>
              </b>
            </li>
          </ul>
          <p className="suave">
            No fim do campeonato há premiação em dinheiro pela posição. Lendas não recebem salário. Contratos novos e
            renovações mudam a folha.
          </p>
        </article>

        <article className="esc-cartao extrato">
          <h2>Extrato</h2>
          {financas.extrato.length ? (
            <ul>
              {financas.extrato.map((l, i) => (
                <li key={i}>
                  <span className="suave">{l.rodada ? `R${l.rodada}` : ""}</span>
                  <span>{l.descricao}</span>
                  <b className={l.valor < 0 ? "sai" : "ent"}>{formatarDinheiro(l.valor)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="suave">Ainda sem lançamentos. Eles aparecem a cada rodada jogada.</p>
          )}
        </article>
      </div>
    </section>
  );
}

export function Indicador({ rotulo, valor, sinal = 0 }: { rotulo: string; valor: string; sinal?: number }) {
  return (
    <div className={`indicador${sinal > 0 ? " alta" : sinal < 0 ? " baixa" : ""}`}>
      <span className="rotulo">{rotulo}</span>
      <b>{valor}</b>
    </div>
  );
}
