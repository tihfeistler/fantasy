import { ATRIBUTOS, SIGLA_ATRIBUTO, type Jogador, type Posicao } from "../engine/types";

export type Raridade = "bronze" | "prata" | "ouro" | "elite" | "lenda";

export function raridade(j: Jogador): Raridade {
  if (j.tipo !== "atual") return "lenda";
  if (j.geral >= 85) return "elite";
  if (j.geral >= 75) return "ouro";
  if (j.geral >= 65) return "prata";
  return "bronze";
}

export function setor(p: Posicao) {
  return p === "GOL" ? "gol" : p === "ZAG" || p === "LAT" ? "def" : p === "ATA" ? "ata" : "mei";
}

interface Props {
  jogador: Jogador;
  /** "mini" para o campo, "cheia" com os 8 atributos. */
  tamanho?: "mini" | "cheia";
  /** Posição em que está jogando, quando improvisado. */
  posEmCampo?: Posicao;
  selecionada?: boolean;
  onClick?: () => void;
}

/** Carta de jogador no estilo de jogos de coleção. */
export function CartaJogador({ jogador: j, tamanho = "cheia", posEmCampo, selecionada, onClick }: Props) {
  const r = raridade(j);
  const improvisado = posEmCampo && posEmCampo !== j.posicao;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={`carta carta-${tamanho} rar-${r}${selecionada ? " selecionada" : ""}`}
      onClick={onClick}
      title={`${j.nome} · ${j.posicao} · geral ${j.geral}${improvisado ? ` · improvisado como ${posEmCampo}` : ""}`}
      type={onClick ? "button" : undefined}
    >
      <span className="carta-topo">
        <span className="carta-geral">{j.geral}</span>
        <span className={`carta-pos setor-${setor(posEmCampo ?? j.posicao)}`}>{posEmCampo ?? j.posicao}</span>
      </span>
      <span className="carta-nome">{tamanho === "mini" ? nomeCurto(j.nome) : j.nome}</span>
      {tamanho === "cheia" && (
        <>
          <span className="carta-sub">
            {j.nacionalidade}
            {j.auge ? ` · ${j.auge}` : ""}
            {r === "lenda" && j.clubeMarcante ? ` · ${j.clubeMarcante}` : ""}
          </span>
          <span className="carta-atrs">
            {ATRIBUTOS.map((k) => (
                <span key={k} className="carta-atr">
                  <b>{j.atributos[k]}</b>
                  {SIGLA_ATRIBUTO[k]}
                </span>
              ))}
          </span>
        </>
      )}
      {improvisado && <span className="carta-aviso">improvisado</span>}
    </Tag>
  );
}

/** No campo, nomes longos viram o sobrenome: "Giorgian de Arrascaeta" -> "Arrascaeta". */
function nomeCurto(nome: string) {
  if (nome.length <= 12) return nome;
  const partes = nome.split(" ");
  return partes[partes.length - 1];
}
