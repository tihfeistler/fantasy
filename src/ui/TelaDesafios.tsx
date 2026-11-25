import { useState } from "react";
import { estiloEscudo } from "../data/clubes";
import {
  custoDaPartida,
  DESAFIOS,
  forcaMedia,
  timeDoDesafio,
  type TimeCartas,
} from "../engine/desafios";
import { formatarDinheiro } from "../engine/mercado";
import { MAX_LENDAS_EM_CAMPO } from "../engine/pacotes";
import { escalar } from "../engine/ratings";
import { ehLenda, type Jogador, type ResultadoPartida, type Time } from "../engine/types";
import { LojaCartasBase } from "./LojaCartasBase";
import { PartidaInterativa } from "./PartidaInterativa";
import { TelaElenco } from "./TelaElenco";

interface Props {
  timeCartas: TimeCartas;
  meuTime: Time;
  atuais: Jogador[];
  lendas: Jogador[];
  cartasBase: Set<string>;
  moedas: number;
  onAtualizarTime: (t: Time) => void;
  onComprarBase: (id: string) => void;
  onVenderBase: (id: string) => void;
  /** Cobra o salário da partida; false se não houver caixa. */
  onIniciar: (desafioId: string, custo: number) => boolean;
  /** Paga os prêmios; devolve o texto do resultado. */
  onConcluir: (desafioId: string, r: ResultadoPartida, adversario: Time) => string;
}

export function TelaDesafios(p: Props) {
  const [modo, setModo] = useState<"desafios" | "time" | "loja">("desafios");
  const [jogo, setJogo] = useState<{ desafioId: string; adversario: Time; seed: number } | null>(null);

  const { meuTime, timeCartas } = p;
  const titulares = escalar(meuTime);
  const custo = custoDaPartida(meuTime);
  const completo = titulares.length === 11;
  const lendasEmCampo = titulares.filter((v) => ehLenda(v.jogador)).length;

  if (jogo) {
    return (
      <PartidaInterativa
        mandante={meuTime}
        visitante={jogo.adversario}
        seed={jogo.seed}
        meuTimeId={meuTime.id}
        titulo={
          <div className="rodada-titulo">
            <span className="rotulo">Desafio</span>
            <b>{jogo.adversario.nome}</b>
          </div>
        }
        onFim={(r) => p.onConcluir(jogo.desafioId, r, jogo.adversario)}
        depoisDoFim={
          <button className="botao primario" onClick={() => setJogo(null)}>
            Voltar aos desafios
          </button>
        }
      />
    );
  }

  return (
    <>
      <div className="financas">
        <div className="indicador destaque">
          <span className="rotulo">Caixa único</span>
          <b>{formatarDinheiro(timeCartas.caixa)}</b>
        </div>
        <div className="indicador">
          <span className="rotulo">Custo por partida</span>
          <b>{formatarDinheiro(custo)}</b>
        </div>
        <div className="indicador">
          <span className="rotulo">Força dos titulares</span>
          <b>{forcaMedia(meuTime) || "–"}</b>
        </div>
        <div className="indicador">
          <span className="rotulo">Cartas</span>
          <b>
            {p.cartasBase.size} base · {meuTime.elenco.filter(ehLenda).length} lendas
          </b>
        </div>
      </div>
      <p className="suave nota-financas">
        O time de cartas é o seu time dos desafios e do ranqueado, e o salário sai do caixa único do clube. Ele usa só cartas suas: cartas base de
        jogadores atuais, compradas com moedas, e suas lendas (até {MAX_LENDAS_EM_CAMPO} em campo). Cada partida cobra o
        salário dos titulares, um quarto do mensal, e as lendas cobram cachê em dobro. Sem caixa, não joga: o treino é de
        graça para sair do aperto.
      </p>

      <div className="alternar mercado-modos" role="group" aria-label="Seção">
        <button className={modo === "desafios" ? "ativo" : ""} onClick={() => setModo("desafios")}>
          Desafios
        </button>
        <button className={modo === "time" ? "ativo" : ""} onClick={() => setModo("time")}>
          Meu time
        </button>
        <button className={modo === "loja" ? "ativo" : ""} onClick={() => setModo("loja")}>
          Cartas base
        </button>
      </div>

      {modo === "desafios" && (
        <>
          {!completo && (
            <p className="aviso">
              Seu time de cartas tem só {titulares.length} titulares. Compre cartas base ou escale mais jogadores em "Meu
              time".
            </p>
          )}
          <div className="desafios">
            {DESAFIOS.map((d) => {
              const adv = timeDoDesafio(d, p.atuais, p.lendas);
              const h = timeCartas.desafios[d.id];
              const custoD = d.gratis ? 0 : custo;
              const semCaixa = timeCartas.caixa < custoD;
              const pronto = adv.elenco.length >= 11;
              return (
                <div key={d.id} className="desafio">
                  <div className="desafio-topo">
                    <span className="escudo" style={estiloEscudo(d.cor)}>
                      {d.sigla}
                    </span>
                    <div>
                      <h3>{d.nome}</h3>
                      <span className="dificuldade" aria-label={`Dificuldade ${d.dificuldade} de 5`}>
                        {"★".repeat(d.dificuldade)}
                        <span className="apagada">{"★".repeat(5 - d.dificuldade)}</span>
                      </span>
                    </div>
                    <span className="forca-adv" title="Força média dos titulares">
                      {forcaMedia(adv)}
                    </span>
                  </div>
                  <p className="suave">{d.descricao}</p>
                  <dl className="desafio-premios">
                    <div>
                      <dt>Vitória</dt>
                      <dd>
                        {formatarDinheiro(d.premio.vitoria)} · {d.moedas.vitoria} moedas
                      </dd>
                    </div>
                    <div>
                      <dt>Empate</dt>
                      <dd>
                        {formatarDinheiro(d.premio.empate)} · {d.moedas.empate} moedas
                      </dd>
                    </div>
                    <div>
                      <dt>Derrota</dt>
                      <dd>
                        {formatarDinheiro(d.premio.derrota)} · {d.moedas.derrota} moedas
                      </dd>
                    </div>
                    {d.cartaNaPrimeiraVitoria && (
                      <div>
                        <dt>Bônus</dt>
                        <dd>{h?.vitorias ? "carta já conquistada" : "uma lenda do adversário na 1ª vitória"}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="desafio-rodape">
                    <span className="suave">
                      {h ? `${h.jogos} jogos, ${h.vitorias} vitórias` : "Nunca jogado"}
                    </span>
                    <button
                      className="botao primario"
                      disabled={!completo || semCaixa || !pronto}
                      onClick={() => {
                        if (!p.onIniciar(d.id, custoD)) return;
                        setJogo({ desafioId: d.id, adversario: adv, seed: (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0 });
                      }}
                    >
                      {semCaixa
                        ? `Falta ${formatarDinheiro(custoD - timeCartas.caixa)}`
                        : d.gratis
                          ? "Jogar de graça"
                          : `Jogar · ${formatarDinheiro(custoD)}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {modo === "time" && (
        <>
          <p className="suave">
            {lendasEmCampo} de {MAX_LENDAS_EM_CAMPO} lendas em campo. Custo desta escalação por partida:{" "}
            <b>{formatarDinheiro(custo)}</b>.
          </p>
          <TelaElenco time={meuTime} onChange={p.onAtualizarTime} />
        </>
      )}

      {modo === "loja" && (
        <LojaCartasBase
          atuais={p.atuais}
          tenho={p.cartasBase}
          moedas={p.moedas}
          onComprar={p.onComprarBase}
          onVender={p.onVenderBase}
        />
      )}
    </>
  );
}
