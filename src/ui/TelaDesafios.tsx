import { useMemo, useState } from "react";
import { CLUBES, estiloEscudo } from "../data/clubes";
import {
  custoDaPartida,
  custoPorPartida,
  DESAFIOS,
  forcaMedia,
  precoCartaBase,
  timeDoDesafio,
  vendaCartaBase,
  type TimeCartas,
} from "../engine/desafios";
import { formatarDinheiro } from "../engine/mercado";
import { MAX_LENDAS_EM_CAMPO } from "../engine/pacotes";
import { escalar } from "../engine/ratings";
import { ehLenda, POSICOES, type Jogador, type ResultadoPartida, type Time } from "../engine/types";
import { setor } from "./CartaJogador";
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

const POR_PAGINA = 40;

export function TelaDesafios(p: Props) {
  const [modo, setModo] = useState<"desafios" | "time" | "loja">("desafios");
  const [jogo, setJogo] = useState<{ desafioId: string; adversario: Time; seed: number } | null>(null);
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState("");
  const [clube, setClube] = useState("");
  const [soMinhas, setSoMinhas] = useState(false);
  const [limite, setLimite] = useState(POR_PAGINA);

  const { meuTime, timeCartas } = p;
  const titulares = escalar(meuTime);
  const custo = custoDaPartida(meuTime);
  const completo = titulares.length === 11;
  const lendasEmCampo = titulares.filter((v) => ehLenda(v.jogador)).length;

  const loja = useMemo(() => {
    const termo = busca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return p.atuais
      .filter((j) => (!soMinhas || p.cartasBase.has(j.id)) && (!posicao || j.posicao === posicao) && (!clube || j.clubeId === clube))
      .filter((j) => !termo || j.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(termo))
      .sort((a, b) => b.geral - a.geral);
  }, [p.atuais, p.cartasBase, busca, posicao, clube, soMinhas]);

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
          <span className="rotulo">Caixa do time de cartas</span>
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
        O time de cartas é o seu time dos desafios (e, no futuro, do online). Ele usa só cartas suas: cartas base de
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
        <>
          <div className="barra">
            <input
              className="busca"
              type="search"
              placeholder="Buscar jogador"
              aria-label="Buscar jogador"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setLimite(POR_PAGINA);
              }}
            />
            <select aria-label="Posição" value={posicao} onChange={(e) => setPosicao(e.target.value)}>
              <option value="">Todas as posições</option>
              {POSICOES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select aria-label="Clube" value={clube} onChange={(e) => setClube(e.target.value)}>
              <option value="">Todos os clubes</option>
              {CLUBES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} /> Só as minhas
            </label>
          </div>
          <ul className="mercado-lista">
            {loja.slice(0, limite).map((j) => {
              const tenho = p.cartasBase.has(j.id);
              const preco = precoCartaBase(j);
              return (
                <li key={j.id} className="ml-linha">
                  <span className={`pos ml-pos setor-${setor(j.posicao)}`}>{j.posicao}</span>
                  <span className="ml-geral">{j.geral}</span>
                  <span className="ml-nome">
                    <b>{j.nome}</b>
                    <span className="suave">
                      {CLUBES.find((c) => c.id === j.clubeId)?.sigla} · {j.nacionalidade}
                    </span>
                  </span>
                  <span className="ml-num">
                    <span className="rotulo">Por partida</span>
                    {formatarDinheiro(custoPorPartida(j))}
                  </span>
                  <span className="ml-num">
                    <span className="rotulo">Venda ao sistema</span>
                    {vendaCartaBase(j)} moedas
                  </span>
                  <span className="ml-preco">
                    <span className="rotulo">Preço</span>
                    {preco} moedas
                  </span>
                  {tenho ? (
                    <button className="botao discreto" onClick={() => p.onVenderBase(j.id)}>
                      Vender · {vendaCartaBase(j)}
                    </button>
                  ) : (
                    <button className="botao" disabled={p.moedas < preco} onClick={() => p.onComprarBase(j.id)}>
                      {p.moedas < preco ? "Moedas insuficientes" : "Comprar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {loja.length > limite && (
            <button className="botao mais" onClick={() => setLimite((l) => l + POR_PAGINA)}>
              Mostrar mais ({loja.length - limite} restantes)
            </button>
          )}
        </>
      )}
    </>
  );
}
