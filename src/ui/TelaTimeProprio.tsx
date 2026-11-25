import { useEffect, useMemo, useState } from "react";
import { CLUBES } from "../data/clubes";
import { fatorCasa } from "../engine/estadios";
import { LIGAS } from "../engine/ligas";
import {
  CHANCES_DRAFT,
  ESTADIOS,
  FORMAS,
  GRUPOS,
  grupoDaEscolha,
  MODELOS_CAMISA,
  nacionalidadesDisponiveis,
  NOME_FUNCAO,
  NOME_RARIDADE,
  nomeNacionalidade,
  ORDEM_RARIDADE,
  POSICAO_DA_FUNCAO,
  problemaNaIdentidade,
  raridadeDraft,
  siglaSugerida,
  fatorDaCarta,
  uniformesDoTimeProprio,
  type Uniforme,
  SIMBOLOS,
  sortearOpcoes,
  TOTAL_DRAFT,
  vagaDoTimeProprio,
  type EscolhaDraft,
  type Funcao,
  type Identidade,
} from "../engine/timeProprio";
import { criarRng } from "../engine/rng";
import type { Jogador } from "../engine/types";
import { CartaJogador } from "./CartaJogador";
import { Camisa, Emblema } from "./Emblema";

/** Países com liga no jogo: sigla e nome. */
export const PAISES_TIME = [...new Map(LIGAS.map((l) => [l.sigla, l.pais]))].map(([sigla, nome]) => ({ sigla, nome }));

/** Liga de entrada e clube que dá a vaga ao time próprio. */
export function entradaDoTime(divisao: string) {
  const liga = LIGAS.find((l) => l.id === divisao);
  const vaga = liga ? vagaDoTimeProprio(CLUBES, liga.chave) : null;
  return { vaga, liga, clube: CLUBES.find((c) => c.id === vaga) };
}

/** Nível médio dos clubes de uma liga (para comparar com o elenco do draft). */
const nivelMedio = (chave: string) => {
  const cs = CLUBES.filter((c) => c.liga === chave);
  return Math.round(cs.reduce((s, c) => s + c.nivel, 0) / Math.max(1, cs.length));
};

export const IDENTIDADE_INICIAL: Identidade = {
  nome: "",
  sigla: "",
  pais: "BRA",
  divisao: "A",
  cidade: "",
  estadio: "municipal",
  nomeEstadio: "Estádio Municipal",
  cor: "#1e5bb8",
  corSecundaria: "#ffffff",
  emblema: { forma: "escudo", simbolo: "estrela" },
  camisa: "lisa",
  camisaReserva: { modelo: "lisa", cor: "#ffffff", cor2: "#1e5bb8" },
};

const PALETA = ["#c8102e", "#1e5bb8", "#0b7a5a", "#000000", "#ffffff", "#f2c500", "#f36c21", "#6a3fb5", "#7a0019", "#5bc2e7"];

/** Campos de criação do time: nome, país, cidade, estádio, cores, emblema e camisa. */
export function CamposTimeProprio({
  valor: v,
  onChange,
  tocado,
}: {
  valor: Identidade;
  onChange: (i: Identidade) => void;
  tocado: boolean;
}) {
  const [siglaManual, setSiglaManual] = useState(!!v.sigla);
  const muda = (parcial: Partial<Identidade>) => onChange({ ...v, ...parcial });
  const entrada = entradaDoTime(v.divisao);
  const problema = tocado ? problemaNaIdentidade(v) : null;
  const [, reserva] = uniformesDoTimeProprio(v);
  const mudaReserva = (parcial: Partial<Uniforme>) => muda({ camisaReserva: { ...reserva, ...parcial } });
  return (
    <div className="time-proprio">
      <div className="tp-previa" style={{ "--cor-clube": v.cor } as React.CSSProperties}>
        <Emblema
          forma={v.emblema.forma}
          simbolo={v.emblema.simbolo}
          cor={v.cor}
          cor2={v.corSecundaria}
          sigla={v.sigla || "???"}
          tamanho={92}
        />
        <Camisa modelo={v.camisa} cor={v.cor} cor2={v.corSecundaria} tamanho={92} />
        <Camisa modelo={reserva.modelo} cor={reserva.cor} cor2={reserva.cor2} tamanho={64} />
        <div className="tp-previa-info">
          <b>{v.nome.trim() || "Seu time"}</b>
          <span className="suave">
            {v.cidade.trim() || "Cidade"} · {v.nomeEstadio.trim() || "Estádio"}
          </span>
          {entrada.liga && entrada.clube && (
            <span className="suave">
              Começa na {entrada.liga.nome}, no lugar do {entrada.clube.nome}.
            </span>
          )}
        </div>
      </div>

      <div className="cad-linha">
        <label>
          Nome do time
          <input
            id="tp-nome"
            maxLength={30}
            value={v.nome}
            onChange={(e) =>
              muda({ nome: e.target.value, ...(siglaManual ? {} : { sigla: siglaSugerida(e.target.value) }) })
            }
          />
        </label>
        <label>
          Sigla
          <input
            id="tp-sigla"
            maxLength={3}
            value={v.sigla}
            onChange={(e) => {
              setSiglaManual(true);
              muda({ sigla: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") });
            }}
          />
        </label>
      </div>
      <div className="cad-linha">
        <label>
          País
          <select
            id="tp-pais"
            value={v.pais}
            onChange={(e) => muda({ pais: e.target.value, divisao: LIGAS.find((l) => l.sigla === e.target.value)!.id })}
          >
            {PAISES_TIME.map((p) => (
              <option key={p.sigla} value={p.sigla}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Divisão
          <select id="tp-divisao" value={v.divisao} onChange={(e) => muda({ divisao: e.target.value })}>
            {LIGAS.filter((l) => l.sigla === v.pais).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome} · nível médio {nivelMedio(l.chave)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="cad-linha">
        <label>
          Cidade
          <input id="tp-cidade" maxLength={30} value={v.cidade} onChange={(e) => muda({ cidade: e.target.value })} />
        </label>
      </div>

      <span className="tp-rotulo">Estádio: escolha uma carta</span>
      <div className="tp-estadios" role="radiogroup" aria-label="Estádio">
        {ESTADIOS.map((e) => (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={v.estadio === e.id}
            className={`carta-estadio rar-${e.raridade}${v.estadio === e.id ? " selecionada" : ""}`}
            onClick={() =>
              muda({
                estadio: e.id,
                ...(ESTADIOS.some((x) => x.nome === v.nomeEstadio) || !v.nomeEstadio ? { nomeEstadio: e.nome } : {}),
              })
            }
          >
            <b>{e.nome}</b>
            <span>{e.capacidade.toLocaleString("pt-BR")} lugares</span>
            <span>Atmosfera {e.atmosfera} · Qualidade {e.qualidade}</span>
            <span>
              Bilheteria {fatorDaCarta(e) < 1 ? "−" : "+"}
              {Math.round(Math.abs(fatorDaCarta(e) - 1) * 100)}% · Casa +{Math.round((fatorCasa(e) - 1) * 100)}%
            </span>
            <span>{e.custo ? `Custa R$ ${(e.custo / 1000).toLocaleString("pt-BR")} mi` : "Sem custo"}</span>
          </button>
        ))}
      </div>
      <label>
        Nome do estádio
        <input
          id="tp-nome-estadio"
          maxLength={30}
          value={v.nomeEstadio}
          placeholder={ESTADIOS.find((e) => e.id === v.estadio)?.nome}
          onChange={(e) => muda({ nomeEstadio: e.target.value })}
        />
      </label>

      <div className="cad-linha">
        <div className="tp-cores">
          <span className="tp-rotulo">Cor principal</span>
          <Cores valor={v.cor} onChange={(cor) => muda({ cor })} id="tp-cor" />
        </div>
        <div className="tp-cores">
          <span className="tp-rotulo">Cor secundária</span>
          <Cores valor={v.corSecundaria} onChange={(corSecundaria) => muda({ corSecundaria })} id="tp-cor2" />
        </div>
      </div>

      <span className="tp-rotulo">Emblema</span>
      <div className="tp-opcoes">
        {FORMAS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={v.emblema.forma === f.id ? "ativo" : ""}
            aria-pressed={v.emblema.forma === f.id}
            onClick={() => muda({ emblema: { ...v.emblema, forma: f.id } })}
            title={f.nome}
          >
            <Emblema forma={f.id} simbolo="nenhum" cor={v.cor} cor2={v.corSecundaria} sigla="" tamanho={40} />
            <span>{f.nome}</span>
          </button>
        ))}
      </div>
      <div className="tp-opcoes">
        {SIMBOLOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={v.emblema.simbolo === s.id ? "ativo" : ""}
            aria-pressed={v.emblema.simbolo === s.id}
            onClick={() => muda({ emblema: { ...v.emblema, simbolo: s.id } })}
            title={s.nome}
          >
            <Emblema
              forma={v.emblema.forma}
              simbolo={s.id}
              cor={v.cor}
              cor2={v.corSecundaria}
              sigla={v.sigla}
              tamanho={40}
            />
            <span>{s.nome}</span>
          </button>
        ))}
      </div>

      <span className="tp-rotulo">Camisa</span>
      <div className="tp-opcoes">
        {MODELOS_CAMISA.map((m) => (
          <button
            key={m.id}
            type="button"
            className={v.camisa === m.id ? "ativo" : ""}
            aria-pressed={v.camisa === m.id}
            onClick={() => muda({ camisa: m.id })}
            title={m.nome}
          >
            <Camisa modelo={m.id} cor={v.cor} cor2={v.corSecundaria} tamanho={44} />
            <span>{m.nome}</span>
          </button>
        ))}
      </div>
      <span className="tp-rotulo">Camisa reserva</span>
      <div className="tp-opcoes">
        {MODELOS_CAMISA.map((m) => (
          <button
            key={m.id}
            type="button"
            className={reserva.modelo === m.id ? "ativo" : ""}
            aria-pressed={reserva.modelo === m.id}
            onClick={() => mudaReserva({ modelo: m.id })}
            title={m.nome}
          >
            <Camisa modelo={m.id} cor={reserva.cor} cor2={reserva.cor2} tamanho={44} />
            <span>{m.nome}</span>
          </button>
        ))}
      </div>
      <div className="cad-linha">
        <div className="tp-cores">
          <span className="tp-rotulo">Fundo da reserva</span>
          <Cores valor={reserva.cor} onChange={(cor) => mudaReserva({ cor })} id="tp-reserva-cor" />
        </div>
        <div className="tp-cores">
          <span className="tp-rotulo">Detalhe da reserva</span>
          <Cores valor={reserva.cor2} onChange={(cor2) => mudaReserva({ cor2 })} id="tp-reserva-cor2" />
        </div>
      </div>
      {problema && <span className="cad-erro">{problema}</span>}
      <p className="suave">
        Depois de criar a conta, você monta o elenco num draft: 30 escolhas por posição, cada uma com 5 jogadores
        sorteados da nacionalidade que você escolher. Um elenco de draft costuma ficar perto de nível 70: nas
        divisões de baixo ele sobra, nas de cima é briga.
      </p>
    </div>
  );
}

function Cores({ valor, onChange, id }: { valor: string; onChange: (c: string) => void; id: string }) {
  return (
    <div className="tp-paleta">
      {PALETA.map((c) => (
        <button
          key={c}
          type="button"
          className={valor.toLowerCase() === c ? "ativo" : ""}
          style={{ background: c }}
          aria-label={`Cor ${c}`}
          aria-pressed={valor.toLowerCase() === c}
          onClick={() => onChange(c)}
        />
      ))}
      <input id={id} type="color" value={valor} onChange={(e) => onChange(e.target.value.toLowerCase())} title="Outra cor" />
    </div>
  );
}

// ------------------------------------------------------------------ draft

export interface EstadoDoDraft {
  escolhas: EscolhaDraft[];
  opcoes: { funcao: Funcao; nacionalidade: string; ids: string[] } | null;
}

/** De onde vêm os sorteios: o servidor (na conta) ou o próprio navegador (demonstração). */
export interface FonteDraft {
  carregar: () => Promise<EstadoDoDraft>;
  sortear: (funcao: Funcao, nacionalidade: string) => Promise<EstadoDoDraft>;
  escolher: (jogadorId: string) => Promise<EstadoDoDraft>;
}

/** Número da escolha logo depois da última vaga do grupo. */
const fimDoGrupo = (g: string) => {
  let ate = 0;
  for (const x of GRUPOS) {
    ate += x.vagas;
    if (x.id === g) break;
  }
  return ate;
};

const pct = (x: number) =>
  `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: x < 0.001 ? 2 : x < 0.01 ? 1 : 0 })}%`;

/** Draft do elenco: para cada vaga, escolhe a função e a nacionalidade, sorteia 5 e fica com um. */
export function TelaDraft({
  identidade: id,
  fonte,
  atuais,
  lendas,
  onConcluir,
  onSair,
}: {
  identidade: Identidade;
  fonte: FonteDraft;
  atuais: Jogador[];
  lendas: Map<string, Jogador>;
  onConcluir: (escolhas: EscolhaDraft[]) => void;
  onSair?: () => void;
}) {
  const [estado, setEstado] = useState<EstadoDoDraft | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nac, setNac] = useState("BRA");
  const [funcao, setFuncao] = useState<Funcao | null>(null);
  const porId = useMemo(() => new Map(atuais.map((j) => [j.id, j])), [atuais]);
  const jogador = (jid: string) => porId.get(jid) ?? lendas.get(jid);

  useEffect(() => {
    fonte.carregar().then(setEstado, (e) => setErro((e as Error).message));
  }, [fonte]);

  const agir = async (f: () => Promise<EstadoDoDraft>) => {
    setErro(null);
    setOcupado(true);
    try {
      setEstado(await f());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const n = estado?.escolhas.length ?? 0;
  const grupo = grupoDaEscolha(n);
  const funcaoAtual: Funcao | null = grupo ? (funcao && grupo.funcoes.includes(funcao) ? funcao : grupo.funcoes[0]) : null;
  const ja = useMemo(() => new Set(estado?.escolhas.map((e) => e.jogadorId) ?? []), [estado]);
  const nacs = useMemo(
    () => (funcaoAtual ? nacionalidadesDisponiveis(atuais, POSICAO_DA_FUNCAO[funcaoAtual], ja) : []),
    [atuais, funcaoAtual, ja],
  );
  const nacAtual = nacs.some((x) => x.nac === nac) ? nac : (nacs[0]?.nac ?? "");
  const opcoes = estado?.opcoes?.ids.map(jogador).filter(Boolean) as Jogador[] | undefined;
  const escolhidos = (estado?.escolhas ?? []).map((e) => ({ ...e, j: jogador(e.jogadorId) }));
  const media = escolhidos.length
    ? Math.round(escolhidos.reduce((s, e) => s + (e.j?.geral ?? 0), 0) / escolhidos.length)
    : 0;

  return (
    <section className="draft">
      <header className="draft-topo" style={{ "--cor-clube": id.cor } as React.CSSProperties}>
        <Emblema
          forma={id.emblema.forma}
          simbolo={id.emblema.simbolo}
          cor={id.cor}
          cor2={id.corSecundaria}
          sigla={id.sigla}
          tamanho={64}
        />
        <div>
          <h1>{id.nome}</h1>
          <p className="suave">
            Draft do elenco · escolha {Math.min(n + 1, TOTAL_DRAFT)} de {TOTAL_DRAFT}
            {media ? ` · média ${media}` : ""}
          </p>
        </div>
        {onSair ? (
          <button className="link" onClick={onSair}>
            Sair
          </button>
        ) : (
          <span />
        )}
        <div className="draft-barra" aria-hidden="true">
          <span style={{ width: `${(n / TOTAL_DRAFT) * 100}%` }} />
        </div>
      </header>

      {!estado ? (
        erro ? <p className="aviso">{erro}</p> : <p className="suave">Carregando o draft…</p>
      ) : (
        <div className="draft-corpo">
          <div className="draft-mesa">
            {grupo && !opcoes?.length && (
              <div className="draft-sorteio">
                <h2>
                  {grupo.nome}: faltam {fimDoGrupo(grupo.id) - n} de {grupo.vagas}
                </h2>
                {grupo.funcoes.length > 1 && (
                  <div className="alternar" role="radiogroup" aria-label="Função">
                    {grupo.funcoes.map((f) => (
                      <button
                        key={f}
                        role="radio"
                        aria-checked={funcaoAtual === f}
                        className={funcaoAtual === f ? "ativo" : ""}
                        onClick={() => setFuncao(f)}
                        title={NOME_FUNCAO[f]}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
                <p className="suave">{funcaoAtual && NOME_FUNCAO[funcaoAtual]}</p>
                <label>
                  Nacionalidade
                  <select id="draft-nac" value={nacAtual} onChange={(e) => setNac(e.target.value)}>
                    {nacs.map((x) => (
                      <option key={x.nac} value={x.nac}>
                        {nomeNacionalidade(x.nac)} ({x.quantidade})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="botao primario"
                  disabled={ocupado || !nacAtual || !funcaoAtual}
                  onClick={() => agir(() => fonte.sortear(funcaoAtual!, nacAtual))}
                >
                  Sortear 5 jogadores
                </button>
                <p className="suave draft-chances">
                  Chances de cada carta:{" "}
                  {[...ORDEM_RARIDADE].reverse().map((r, i) => (
                    <span key={r}>
                      {i > 0 && " · "}
                      <b className={`rar-txt-${r}`}>{NOME_RARIDADE[r]}</b> {pct(CHANCES_DRAFT[r])}
                    </span>
                  ))}
                  . Sem jogador da raridade sorteada, vem a mais próxima abaixo. Depois de sortear, é preciso ficar
                  com um dos cinco.
                </p>
              </div>
            )}
            {opcoes && opcoes.length > 0 && (
              <div className="draft-opcoes">
                <h2>
                  Escolha seu {NOME_FUNCAO[estado.opcoes!.funcao].toLowerCase()} ·{" "}
                  {nomeNacionalidade(estado.opcoes!.nacionalidade)}
                </h2>
                <div className="draft-cartas">
                  {opcoes.map((j) => (
                    <div key={j.id} className="draft-opcao">
                      <span className={`draft-rar rar-txt-${raridadeDraft(j)}`}>{NOME_RARIDADE[raridadeDraft(j)]}</span>
                      <CartaJogador jogador={j} onClick={() => !ocupado && agir(() => fonte.escolher(j.id))} />
                      <button className="botao" disabled={ocupado} onClick={() => agir(() => fonte.escolher(j.id))}>
                        Escolher
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!grupo && (
              <div className="draft-fim">
                <h2>Elenco completo!</h2>
                <p className="suave">
                  {TOTAL_DRAFT} jogadores, média {media}. Lendas ficam limitadas a 3 entre os titulares, como em todo o
                  jogo.
                </p>
                <button className="botao primario" disabled={ocupado} onClick={() => onConcluir(estado.escolhas)}>
                  Começar a carreira
                </button>
              </div>
            )}
            {erro && <p className="aviso">{erro}</p>}
          </div>

          <aside className="draft-elenco">
            {GRUPOS.map((g) => {
              const inicio = GRUPOS.slice(0, GRUPOS.indexOf(g)).reduce((s, x) => s + x.vagas, 0);
              const doGrupo = escolhidos.slice(inicio, inicio + g.vagas);
              return (
                <div key={g.id}>
                  <h3>
                    {g.nome} <span className="suave">{doGrupo.length}/{g.vagas}</span>
                  </h3>
                  <ul>
                    {doGrupo.map((e) => (
                      <li key={e.jogadorId}>
                        <span className="chip">{e.funcao}</span>
                        <span className={`draft-ger rar-txt-${e.j ? raridadeDraft(e.j) : "bronze"}`}>{e.j?.geral}</span>
                        <span>{e.j?.nome ?? e.jogadorId}</span>
                        <span className="suave">{e.j?.nacionalidade}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </aside>
        </div>
      )}
    </section>
  );
}

/** Draft na demonstração (sem servidor): sorteia no navegador com as mesmas regras. */
export function fonteLocal(atuais: Jogador[], lendas: Jogador[], seed: number): FonteDraft {
  let st: EstadoDoDraft = { escolhas: [], opcoes: null };
  const rng = criarRng(seed);
  return {
    carregar: async () => st,
    sortear: async (funcao, nacionalidade) => {
      const g = grupoDaEscolha(st.escolhas.length);
      if (st.opcoes) throw new Error("Escolha um dos jogadores sorteados antes de sortear de novo.");
      if (!g || !g.funcoes.includes(funcao)) throw new Error("Função inválida para esta escolha.");
      const ja = new Set(st.escolhas.map((e) => e.jogadorId));
      const ids = sortearOpcoes(atuais, lendas, funcao, nacionalidade, ja, rng).map((j) => j.id);
      if (!ids.length) throw new Error("Não há jogadores dessa nacionalidade nessa posição. Escolha outra.");
      st = { ...st, opcoes: { funcao, nacionalidade, ids } };
      return st;
    },
    escolher: async (jogadorId) => {
      if (!st.opcoes?.ids.includes(jogadorId)) throw new Error("Esse jogador não está entre as opções.");
      st = { escolhas: [...st.escolhas, { funcao: st.opcoes.funcao, jogadorId }], opcoes: null };
      return st;
    },
  };
}
