import { escalar, FORMACOES, forcaSetores } from "../engine/ratings";
import { ATRIBUTOS, POSICOES, SIGLA_ATRIBUTO, type Time } from "../engine/types";

interface Props {
  time: Time;
  onChange: (t: Time) => void;
}

export function TelaElenco({ time, onChange }: Props) {
  const vagas = escalar(time);
  const titulares = new Map(vagas.map((v) => [v.jogador.id, v.pos]));
  const forca = forcaSetores(vagas);
  const elenco = [...time.elenco].sort(
    (a, b) => POSICOES.indexOf(a.posicao) - POSICOES.indexOf(b.posicao) || b.geral - a.geral,
  );

  const manual = time.titulares.length > 0;
  const incompleto = manual && time.titulares.length < 11;

  const alternarTitular = (id: string) => {
    const atuais = manual ? time.titulares : vagas.map((v) => v.jogador.id);
    let novos: string[];
    if (atuais.includes(id)) novos = atuais.filter((x) => x !== id);
    else if (atuais.length < 11) novos = [...atuais, id];
    else return;
    onChange({ ...time, titulares: novos });
  };

  return (
    <section className="tela">
      <div className="barra">
        <label>
          Formação{" "}
          <select
            value={time.formacao.nome}
            onChange={(e) =>
              onChange({ ...time, formacao: FORMACOES.find((f) => f.nome === e.target.value)! })
            }
          >
            {FORMACOES.map((f) => (
              <option key={f.nome}>{f.nome}</option>
            ))}
          </select>
        </label>
        <button onClick={() => onChange({ ...time, titulares: [] })}>Escalação automática</button>
        <div className="forcas">
          <Forca rotulo="GOL" v={forca.goleiro} />
          <Forca rotulo="DEF" v={forca.defesa} />
          <Forca rotulo="MEI" v={forca.meio} />
          <Forca rotulo="ATA" v={forca.ataque} />
        </div>
      </div>
      {incompleto && (
        <p className="aviso">
          {time.titulares.length}/11 titulares escolhidos. Clique em reservas para completar.
        </p>
      )}
      <div className="rolagem">
      <table className="elenco">
        <thead>
          <tr>
            <th></th>
            <th>Pos</th>
            <th className="nome">Jogador</th>
            <th>Nac</th>
            <th>Auge</th>
            <th>Geral</th>
            {ATRIBUTOS.map((k) => (
              <th key={k}>{SIGLA_ATRIBUTO[k]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {elenco.map((j) => {
            const emCampo = manual ? time.titulares.includes(j.id) : titulares.has(j.id);
            const posEmCampo = titulares.get(j.id);
            return (
              <tr key={j.id} className={emCampo ? "titular" : ""} onClick={() => alternarTitular(j.id)}>
                <td className="marcador">{emCampo ? "●" : ""}</td>
                <td>
                  <span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
                  {emCampo && posEmCampo && posEmCampo !== j.posicao && (
                    <span className="improviso" title="Improvisado">→{posEmCampo}</span>
                  )}
                </td>
                <td className="nome">
                  {j.nome}
                  <small>{j.clubeMarcante}</small>
                </td>
                <td>{j.nacionalidade}</td>
                <td>{j.auge ?? "atual"}</td>
                <td className="geral">{j.geral}</td>
                {ATRIBUTOS.map((k) => (
                  <td key={k}>{j.atributos[k]}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </section>
  );
}

function Forca({ rotulo, v }: { rotulo: string; v: number }) {
  return (
    <div className="forca">
      <span>{rotulo}</span>
      <strong>{Math.round(v)}</strong>
    </div>
  );
}
