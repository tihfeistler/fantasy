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

  /**
   * Clique numa carta:
   * - titular sai do campo e vai para o banco (ou para fora, se o banco estiver cheio);
   * - do banco ou de fora, entra no campo se houver vaga; senão, quem está fora vai
   *   para o banco, e quem está no banco sai da lista.
   */
  const clicar = (id: string) => {
    const tit = manual ? time.titulares : vagas.map((v) => v.jogador.id);
    const ban = banco.map((j) => j.id);
    const j = time.elenco.find((x) => x.id === id)!;
    let novosTit = tit;
    let novoBanco = ban;
    if (tit.includes(id)) {
      novosTit = tit.filter((x) => x !== id);
      if (ban.length < VAGAS_BANCO) novoBanco = [...ban, id];
    } else if (tit.length < 11) {
      const lendasEmCampo = time.elenco.filter((x) => tit.includes(x.id) && ehLenda(x)).length;
      if (ehLenda(j) && lendasEmCampo >= (time.maxLendas ?? Infinity)) {
        setAviso(`Já há ${time.maxLendas} lendas entre os titulares. Tire uma para escalar ${j.nome}.`);
        return;
      }
      novosTit = [...tit, id];
      novoBanco = ban.filter((x) => x !== id);
    } else if (ban.includes(id)) {
      novoBanco = ban.filter((x) => x !== id);
    } else if (ban.length < VAGAS_BANCO) {
      novoBanco = [...ban, id];
    } else {
      setAviso(`O banco está cheio (${VAGAS_BANCO} vagas). Tire alguém do banco para relacionar ${j.nome}.`);
      return;
    }
    setAviso(null);
    onChange({ ...time, titulares: novosTit, banco: novoBanco });
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
                        onClick={() => clicar(v.jogador!.id)}
                      />
                    ) : (
                      <div key={`vazia-${v.pos}-${i}`} className={`vaga-vazia setor-${setor(v.pos)}`}>
                        <span className="carta-pos">{v.pos}</span>
                        <span>Vaga</span>
                      </div>
                    ),
                  )}
                </div>
              );
            })}
            {vagasVazias > 0 && (
              <p className="campo-aviso">
                {vagasVazias === 1 ? "1 vaga vazia" : `${vagasVazias} vagas vazias`}: clique num jogador do banco ou de fora para escalar
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
              Clique num titular para mandar ao banco. Com o time completo, clicar no banco tira o jogador da lista.
            </p>
            {banco.length ? (
              <div className="grade-cartas">
                {banco.map((j) => (
                  <CartaJogador key={j.id} jogador={j} onClick={() => clicar(j.id)} />
                ))}
              </div>
            ) : (
              <p className="vazio-bloco">Banco vazio.</p>
            )}
            <h2 className="espaco-topo">
              Fora da lista <span className="suave">{foraDaLista.length}</span>
            </h2>
            <p className="dica">Não vão para o jogo. Clique para escalar ou colocar no banco.</p>
            <div className="grade-cartas fora-lista">
              {foraDaLista.map((j) => (
                <CartaJogador key={j.id} jogador={j} onClick={() => clicar(j.id)} />
              ))}
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
