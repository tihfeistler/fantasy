import { useState } from "react";
import { escalar, FORMACOES, forcaSetores, montarBanco, vagasDaFormacao, VAGAS_BANCO, type Vaga } from "../engine/ratings";
import { ATRIBUTOS, ehLenda, POSICOES, SIGLA_ATRIBUTO, type Posicao, type Time } from "../engine/types";
import type { Jogador } from "../engine/types";
import { CartaJogador, setor } from "./CartaJogador";
import { Modal } from "./Modal";

interface Props {
  time: Time;
  onChange: (t: Time) => void;
}

/** Linhas do campo, de cima (ataque) para baixo (gol). */
const LINHAS: Posicao[][] = [["ATA"], ["MEI"], ["VOL"], ["LAT", "ZAG"], ["GOL"]];

export function TelaElenco({ time, onChange }: Props) {
  const [modo, setModo] = useState<"formacao" | "elenco">("formacao");
  const [aberto, setAberto] = useState<Jogador | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const vagas = escalar(time);
  const naEscalacao = new Map(vagas.map((v) => [v.jogador.id, v.pos]));
  const forca = forcaSetores(vagas);
  const manual = time.titulares.length > 0;
  const titularIds = manual ? new Set(time.titulares) : new Set(naEscalacao.keys());
  const incompleto = manual && time.titulares.length < 11;
  const elenco = [...time.elenco].sort(
    (a, b) => POSICOES.indexOf(a.posicao) - POSICOES.indexOf(b.posicao) || b.geral - a.geral,
  );
  const banco = montarBanco(time, titularIds);
  const bancoIds = new Set(banco.map((j) => j.id));
  const foraDaLista = elenco.filter((j) => !titularIds.has(j.id) && !bancoIds.has(j.id));

  /** Carta escolhida para mexer (titular, reserva ou vaga vazia). */
  const [escolha, setEscolha] = useState<
    { tipo: "titular" | "banco"; jogador: Jogador } | { tipo: "vaga-campo"; pos: Posicao } | { tipo: "vaga-banco" } | null
  >(null);

  const listas = () => ({ tit: manual ? [...time.titulares] : vagas.map((v) => v.jogador.id), ban: banco.map((j) => j.id) });
  const aplicar = (tit: string[], ban: string[]) => {
    const lendasEmCampo = time.elenco.filter((x) => tit.includes(x.id) && ehLenda(x)).length;
    if (lendasEmCampo > (time.maxLendas ?? Infinity)) {
      setAviso(`Só ${time.maxLendas} lendas podem jogar juntas. Tire uma do campo antes.`);
      return;
    }
    setAviso(null);
    setEscolha(null);
    onChange({ ...time, titulares: tit, banco: ban });
  };
  /** Troca a carta escolhida pela carta `id` (do banco ou do depósito). */
  const trocar = (id: string) => {
    if (!escolha) return;
    const { tit, ban } = listas();
    const noBanco = ban.includes(id);
    if (escolha.tipo === "titular") {
      const a = escolha.jogador.id;
      const t2 = tit.map((x) => (x === a ? id : x));
      // Do banco: os dois trocam de lugar. Do depósito: o titular vai para o depósito.
      const b2 = noBanco ? ban.map((x) => (x === id ? a : x)) : ban;
      aplicar(t2, b2);
    } else if (escolha.tipo === "banco") {
      const a = escolha.jogador.id;
      aplicar(tit, ban.map((x) => (x === a ? id : x)));
    } else if (escolha.tipo === "vaga-campo") {
      aplicar([...tit, id], ban.filter((x) => x !== id));
    } else {
      aplicar(tit, [...ban, id]);
    }
  };
  const paraOBanco = (id: string) => {
    const { tit, ban } = listas();
    aplicar(
      tit.filter((x) => x !== id),
      ban.length < VAGAS_BANCO ? [...ban, id] : ban,
    );
  };
  const paraOCampo = (id: string) => {
    const { tit, ban } = listas();
    aplicar([...tit, id], ban.filter((x) => x !== id));
  };
  const paraODeposito = (id: string) => {
    const { tit, ban } = listas();
    aplicar(
      tit.filter((x) => x !== id),
      ban.filter((x) => x !== id),
    );
  };

  // Cada linha do campo mostra as vagas da formação; vaga sem jogador fica vazia.
  // Laterais ficam nas pontas da linha de defesa: LAT, ZAG..., LAT
  const esperadas = vagasDaFormacao(time.formacao);
  const linhaDoCampo = (ps: Posicao[]): (Vaga | { pos: Posicao; jogador: null })[] => {
    const comVazias = (pos: Posicao) => {
      const cheias: (Vaga | { pos: Posicao; jogador: null })[] = vagas.filter((v) => v.pos === pos);
      const faltam = esperadas.filter((p) => p === pos).length - cheias.length;
      for (let i = 0; i < faltam; i++) cheias.push({ pos, jogador: null });
      return cheias;
    };
    if (!ps.includes("LAT")) return ps.flatMap(comVazias);
    const lats = comVazias("LAT");
    return [lats[0], ...comVazias("ZAG"), ...lats.slice(1)].filter(Boolean);
  };
  const vagasVazias = esperadas.length - vagas.length;

  return (
    <section className="tela">
      <div className="barra">
        {modo === "formacao" && (
        <label className="campo-form">
          <span className="rotulo">Formação</span>
          <select
            id="formacao"
            value={time.formacao.nome}
            onChange={(e) => onChange({ ...time, formacao: FORMACOES.find((f) => f.nome === e.target.value)! })}
          >
            {FORMACOES.map((f) => (
              <option key={f.nome}>{f.nome}</option>
            ))}
          </select>
        </label>
        )}
        {modo === "formacao" && (
          <button className="botao" onClick={() => onChange({ ...time, titulares: [], banco: undefined })}>
            Escalação automática
          </button>
        )}
        <div className="alternar" role="group" aria-label="Modo de exibição">
          <button className={modo === "formacao" ? "ativo" : ""} onClick={() => setModo("formacao")}>
            Formação
          </button>
          <button className={modo === "elenco" ? "ativo" : ""} onClick={() => setModo("elenco")}>
            Elenco
          </button>
        </div>
        <div className="forcas">
          <Forca rotulo="Gol" setor="gol" v={forca.goleiro} />
          <Forca rotulo="Defesa" setor="def" v={forca.defesa} />
          <Forca rotulo="Meio" setor="mei" v={forca.meio} />
          <Forca rotulo="Ataque" setor="ata" v={forca.ataque} />
        </div>
      </div>

      {aviso && modo === "formacao" && <p className="aviso">{aviso}</p>}
      {incompleto && modo === "formacao" && (
        <p className="aviso">
          {time.titulares.length} de 11 titulares escolhidos. Clique num reserva para completar, ou use a escalação
          automática.
        </p>
      )}

      {modo === "formacao" ? (
        <div className="elenco-cartas">
          <div className="campo" aria-label="Titulares em campo">
            {LINHAS.map((ps) => {
              const vs = linhaDoCampo(ps);
              if (!vs.length) return null;
              return (
                <div key={ps.join()} className="linha-campo">
                  {vs.map((v, i) =>
                    v.jogador ? (
                      <CartaJogador
                        key={v.jogador.id}
                        jogador={v.jogador}
                        tamanho="mini"
                        posEmCampo={v.pos}
                        onClick={() => setEscolha({ tipo: "titular", jogador: v.jogador! })}
                      />
                    ) : (
                      <button
                        key={`vazia-${v.pos}-${i}`}
                        className={`vaga-vazia setor-${setor(v.pos)}`}
                        onClick={() => setEscolha({ tipo: "vaga-campo", pos: v.pos })}
                      >
                        <span className="carta-pos">{v.pos}</span>
                        <span>Vaga</span>
                      </button>
                    ),
                  )}
                </div>
              );
            })}
            {vagasVazias > 0 && (
              <p className="campo-aviso">
                {vagasVazias === 1 ? "1 vaga vazia" : `${vagasVazias} vagas vazias`}: clique na vaga para escalar alguém
              </p>
            )}
          </div>
          <div className="reservas">
            <h2>
              Banco de reservas{" "}
              <span className="suave">
                {banco.length} de {VAGAS_BANCO}
              </span>
            </h2>
            <p className="dica">
              Clique numa carta do campo ou do banco para trocar por outra. Os outros {foraDaLista.length} jogadores ficam
              no depósito e não vão para o jogo.
            </p>
            <div className="grade-cartas">
              {banco.map((j) => (
                <CartaJogador key={j.id} jogador={j} onClick={() => setEscolha({ tipo: "banco", jogador: j })} />
              ))}
              {banco.length < VAGAS_BANCO && foraDaLista.length > 0 && (
                <button className="vaga-banco" onClick={() => setEscolha({ tipo: "vaga-banco" })}>
                  <b>+</b>
                  <span>
                    {VAGAS_BANCO - banco.length} {VAGAS_BANCO - banco.length === 1 ? "vaga" : "vagas"} no banco
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
        <p className="dica">Clique no nome de um jogador para ver a carta. Para mudar o time, use a aba Formação.</p>
        <div className="rolagem">
          <table className="tabela-elenco">
            <thead>
              <tr>
                <th></th>
                <th>Pos</th>
                <th className="nome">Jogador</th>
                <th>Nac</th>
                <th>Geral</th>
                {ATRIBUTOS.map((k) => (
                  <th key={k}>{SIGLA_ATRIBUTO[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elenco.map((j) => {
                const emCampo = titularIds.has(j.id);
                return (
                  <tr key={j.id} className={emCampo ? "titular" : ""}>
                    <td className="marcador">{emCampo ? "Titular" : bancoIds.has(j.id) ? "Banco" : ""}</td>
                    <td>
                      <span className={`pos setor-${setor(j.posicao)}`}>{j.posicao}</span>
                    </td>
                    <td className="nome">
                      <button className="link-nome" onClick={() => setAberto(j)}>
                        {j.nome}
                      </button>
                      {j.tipo !== "atual" && <span className="selo-lenda">Lenda</span>}
                    </td>
                    <td>{j.nacionalidade}</td>
                    <td className="geral">{j.geral}</td>
                    {ATRIBUTOS.map((k) => (
                      <td key={k} className={nivelClasse(j.atributos[k])}>
                        {j.atributos[k]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      {escolha && (
        <Modal
          titulo={
            escolha.tipo === "titular" || escolha.tipo === "banco"
              ? escolha.jogador.nome
              : escolha.tipo === "vaga-campo"
                ? `Escalar na vaga de ${escolha.pos}`
                : "Colocar no banco"
          }
          onFechar={() => setEscolha(null)}
        >
          {aviso && <p className="aviso">{aviso}</p>}
          <Troca
            escolha={escolha}
            banco={banco}
            deposito={foraDaLista}
            titularesCompletos={vagas.length >= 11}
            bancoCheio={banco.length >= VAGAS_BANCO}
            onTrocar={trocar}
            onParaOBanco={paraOBanco}
            onParaOCampo={paraOCampo}
            onParaODeposito={paraODeposito}
            onVerCarta={(j) => {
              setEscolha(null);
              setAberto(j);
            }}
          />
        </Modal>
      )}
      {aberto && (
        <Modal titulo={aberto.nome} onFechar={() => setAberto(null)}>
          <FichaJogador
            jogador={aberto}
            situacao={titularIds.has(aberto.id) ? "Titular" : bancoIds.has(aberto.id) ? "Banco de reservas" : "Fora da lista"}
          />
        </Modal>
      )}
    </section>
  );
}

function nivelClasse(v: number) {
  return v >= 85 ? "n-alto" : v >= 70 ? "n-bom" : v >= 50 ? "n-medio" : "n-baixo";
}

function Forca({ rotulo, setor, v }: { rotulo: string; setor: string; v: number }) {
  const valor = Math.round(v);
  return (
    <div className={`forca setor-borda-${setor}`}>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
      <i style={{ width: `${Math.min(100, valor)}%` }} />
    </div>
  );
}

/** Carta grande + detalhes, usada no modal do elenco e no estoque. */
export function FichaJogador({ jogador: j, situacao }: { jogador: Jogador; situacao?: string }) {
  return (
    <div className="ficha">
      <div className="ficha-carta">
        <CartaJogador jogador={j} />
      </div>
      <dl className="ficha-dados">
        <dt>Posição</dt>
        <dd>{j.posicao}</dd>
        <dt>Nacionalidade</dt>
        <dd>{j.nacionalidade}</dd>
        {j.auge && (
          <>
            <dt>Auge</dt>
            <dd>
              {j.auge}
              {j.clubeMarcante ? `, ${j.clubeMarcante}` : ""}
            </dd>
          </>
        )}
        <dt>Situação</dt>
        <dd>{situacao ?? "No estoque"}</dd>
        {ATRIBUTOS.map((k) => (
          <div key={k} className="ficha-atr">
            <dt>{NOME_ATRIBUTO[k]}</dt>
            <dd>
              <span className="barra-atr">
                <i className={nivelClasse(j.atributos[k])} style={{ width: `${j.atributos[k]}%` }} />
              </span>
              <b>{j.atributos[k]}</b>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const NOME_ATRIBUTO: Record<(typeof ATRIBUTOS)[number], string> = {
  finalizacao: "Finalização", passe: "Passe", drible: "Drible", velocidade: "Velocidade",
  defesa: "Defesa", fisico: "Físico", mentalidade: "Mentalidade", goleiro: "Goleiro",
};

type Escolha =
  | { tipo: "titular" | "banco"; jogador: Jogador }
  | { tipo: "vaga-campo"; pos: Posicao }
  | { tipo: "vaga-banco" };

/** Janela de troca: ações da carta escolhida e a lista de quem pode entrar no lugar dela. */
function Troca(p: {
  escolha: Escolha;
  banco: Jogador[];
  deposito: Jogador[];
  titularesCompletos: boolean;
  bancoCheio: boolean;
  onTrocar: (id: string) => void;
  onParaOBanco: (id: string) => void;
  onParaOCampo: (id: string) => void;
  onParaODeposito: (id: string) => void;
  onVerCarta: (j: Jogador) => void;
}) {
  const e = p.escolha;
  const pos = e.tipo === "titular" || e.tipo === "banco" ? e.jogador.posicao : e.tipo === "vaga-campo" ? e.pos : null;
  // Candidatos: do campo, vêm do banco e do depósito; do banco, só do depósito.
  const ordenar = (js: Jogador[]) =>
    [...js].sort((a, b) => Number(b.posicao === pos) - Number(a.posicao === pos) || b.geral - a.geral);
  const grupos: { titulo: string; js: Jogador[] }[] =
    e.tipo === "titular" || e.tipo === "vaga-campo"
      ? [
          { titulo: "Do banco", js: ordenar(p.banco) },
          { titulo: "Do depósito", js: ordenar(p.deposito) },
        ]
      : [{ titulo: "Do depósito", js: ordenar(p.deposito) }];

  return (
    <div className="troca">
      {(e.tipo === "titular" || e.tipo === "banco") && (
        <div className="troca-acoes">
          <CartaJogador jogador={e.jogador} tamanho="mini" />
          <div className="troca-botoes">
            {e.tipo === "titular" && (
              <button className="botao" onClick={() => p.onParaOBanco(e.jogador.id)} disabled={p.bancoCheio}>
                {p.bancoCheio ? "Banco cheio" : "Mandar para o banco"}
              </button>
            )}
            {e.tipo === "banco" && !p.titularesCompletos && (
              <button className="botao primario" onClick={() => p.onParaOCampo(e.jogador.id)}>
                Escalar como titular
              </button>
            )}
            <button className="botao discreto" onClick={() => p.onParaODeposito(e.jogador.id)}>
              Tirar da lista (vai para o depósito)
            </button>
            <button className="botao discreto" onClick={() => p.onVerCarta(e.jogador)}>
              Ver carta completa
            </button>
          </div>
        </div>
      )}
      <h3 className="troca-titulo">
        {e.tipo === "titular" || e.tipo === "banco" ? `Trocar ${e.jogador.nome} por` : "Escolha quem entra"}
      </h3>
      {grupos.map((g) =>
        g.js.length ? (
          <div key={g.titulo}>
            <h4 className="rotulo">{g.titulo}</h4>
            <ul className="troca-lista">
              {g.js.map((j) => (
                <li key={j.id}>
                  <button onClick={() => p.onTrocar(j.id)}>
                    <span className={`pos setor-${setor(j.posicao)}`}>{j.posicao}</span>
                    <b className="troca-geral">{j.geral}</b>
                    <span className="troca-nome">{j.nome}</span>
                    {ehLenda(j) && <span className="selo-lenda">Lenda</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}
