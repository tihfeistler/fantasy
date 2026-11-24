import { useState } from "react";
import { escalar, FORMACOES, forcaSetores, vagasDaFormacao, type Vaga } from "../engine/ratings";
import { ATRIBUTOS, POSICOES, SIGLA_ATRIBUTO, type Posicao, type Time } from "../engine/types";
import { CartaJogador, setor } from "./CartaJogador";

interface Props {
  time: Time;
  onChange: (t: Time) => void;
}

/** Linhas do campo, de cima (ataque) para baixo (gol). */
const LINHAS: Posicao[][] = [["ATA"], ["MEI"], ["VOL"], ["LAT", "ZAG"], ["GOL"]];

export function TelaElenco({ time, onChange }: Props) {
  const [modo, setModo] = useState<"cartas" | "tabela">("cartas");
  const vagas = escalar(time);
  const naEscalacao = new Map(vagas.map((v) => [v.jogador.id, v.pos]));
  const forca = forcaSetores(vagas);
  const manual = time.titulares.length > 0;
  const titularIds = manual ? new Set(time.titulares) : new Set(naEscalacao.keys());
  const incompleto = manual && time.titulares.length < 11;
  const elenco = [...time.elenco].sort(
    (a, b) => POSICOES.indexOf(a.posicao) - POSICOES.indexOf(b.posicao) || b.geral - a.geral,
  );
  const reservas = elenco.filter((j) => !titularIds.has(j.id));

  const alternarTitular = (id: string) => {
    const atuais = manual ? time.titulares : vagas.map((v) => v.jogador.id);
    let novos: string[];
    if (atuais.includes(id)) novos = atuais.filter((x) => x !== id);
    else if (atuais.length < 11) novos = [...atuais, id];
    else return;
    onChange({ ...time, titulares: novos });
  };

  // Laterais ficam nas pontas da linha de defesa: LAT, ZAG..., LAT
  const linhaDoCampo = (ps: Posicao[]): Vaga[] => {
    const vs = vagas.filter((v) => ps.includes(v.pos));
    if (!ps.includes("LAT")) return vs;
    const lats = vs.filter((v) => v.pos === "LAT");
    const zags = vs.filter((v) => v.pos === "ZAG");
    return [lats[0], ...zags, lats[1]].filter(Boolean) as Vaga[];
  };
  const vagasEsperadas = vagasDaFormacao(time.formacao).length;

  return (
    <section className="tela">
      <div className="barra">
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
        <button className="botao" onClick={() => onChange({ ...time, titulares: [] })}>
          Escalação automática
        </button>
        <div className="alternar" role="group" aria-label="Modo de exibição">
          <button className={modo === "cartas" ? "ativo" : ""} onClick={() => setModo("cartas")}>
            Cartas
          </button>
          <button className={modo === "tabela" ? "ativo" : ""} onClick={() => setModo("tabela")}>
            Tabela
          </button>
        </div>
        <div className="forcas">
          <Forca rotulo="Gol" setor="gol" v={forca.goleiro} />
          <Forca rotulo="Defesa" setor="def" v={forca.defesa} />
          <Forca rotulo="Meio" setor="mei" v={forca.meio} />
          <Forca rotulo="Ataque" setor="ata" v={forca.ataque} />
        </div>
      </div>

      {incompleto && (
        <p className="aviso">
          {time.titulares.length} de 11 titulares escolhidos. Clique num reserva para completar, ou use a escalação
          automática.
        </p>
      )}

      {modo === "cartas" ? (
        <div className="elenco-cartas">
          <div className="campo" aria-label="Titulares em campo">
            {LINHAS.map((ps) => {
              const vs = linhaDoCampo(ps);
              if (!vs.length) return null;
              return (
                <div key={ps.join()} className="linha-campo">
                  {vs.map((v) => (
                    <CartaJogador
                      key={v.jogador.id}
                      jogador={v.jogador}
                      tamanho="mini"
                      posEmCampo={v.pos}
                      onClick={() => alternarTitular(v.jogador.id)}
                    />
                  ))}
                </div>
              );
            })}
            {vagas.length < vagasEsperadas && <p className="campo-aviso">Faltam jogadores em campo</p>}
          </div>
          <div className="reservas">
            <h2>
              Reservas <span className="suave">{reservas.length}</span>
            </h2>
            <p className="dica">Clique numa carta para colocar ou tirar do time titular.</p>
            <div className="grade-cartas">
              {reservas.map((j) => (
                <CartaJogador key={j.id} jogador={j} onClick={() => alternarTitular(j.id)} />
              ))}
            </div>
          </div>
        </div>
      ) : (
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
                  <tr key={j.id} className={emCampo ? "titular" : ""} onClick={() => alternarTitular(j.id)}>
                    <td className="marcador">{emCampo ? "Titular" : ""}</td>
                    <td>
                      <span className={`pos setor-${setor(j.posicao)}`}>{j.posicao}</span>
                    </td>
                    <td className="nome">{j.nome}</td>
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
