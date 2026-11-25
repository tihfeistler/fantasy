import { CLUBES_PROPRIOS, estiloEscudo } from "../data/clubes";
import type { FormaEmblema, ModeloCamisa, SimboloEmblema } from "../engine/timeProprio";

interface PropsEmblema {
  forma: FormaEmblema;
  simbolo: SimboloEmblema;
  cor: string;
  cor2: string;
  sigla: string;
  tamanho?: number;
}

const CONTORNO: Record<FormaEmblema, string> = {
  escudo: "M10 8 H90 V48 C90 76 70 90 50 98 C30 90 10 76 10 48 Z",
  classico: "M8 10 Q50 0 92 10 V56 C92 80 70 92 50 98 C30 92 8 80 8 56 Z",
  redondo: "M50 4 A46 46 0 1 1 49.9 4 Z",
  losango: "M50 2 L96 50 L50 98 L4 50 Z",
};

/** Emblema do time próprio desenhado em SVG: forma, símbolo e sigla nas duas cores. */
export function Emblema({ forma, simbolo, cor, cor2, sigla, tamanho = 64 }: PropsEmblema) {
  const id = `em-${forma}-${cor.slice(1)}-${cor2.slice(1)}`;
  return (
    <svg className="emblema-svg" width={tamanho} height={tamanho} viewBox="0 0 100 100" role="img" aria-label={`Emblema ${sigla}`}>
      <defs>
        <clipPath id={id}>
          <path d={CONTORNO[forma]} />
        </clipPath>
      </defs>
      <path d={CONTORNO[forma]} fill={cor} />
      <g clipPath={`url(#${id})`}>
        {simbolo === "listras" &&
          [20, 40, 60, 80].map((x) => <rect key={x} x={x - 5} y={0} width={10} height={100} fill={cor2} opacity={0.85} />)}
      </g>
      <path d={CONTORNO[forma]} fill="none" stroke={cor2} strokeWidth={5} />
      <Simbolo simbolo={simbolo} cor={cor2} contraste={cor} />
      <text
        x={50}
        y={simbolo === "nenhum" ? 60 : 80}
        textAnchor="middle"
        fontSize={simbolo === "nenhum" ? 28 : 17}
        fontWeight={800}
        fontFamily="inherit"
        fill={simbolo === "listras" ? cor : cor2}
        stroke={simbolo === "listras" ? cor2 : "none"}
        strokeWidth={simbolo === "listras" ? 0.8 : 0}
      >
        {sigla}
      </text>
    </svg>
  );
}

function Simbolo({ simbolo, cor, contraste }: { simbolo: SimboloEmblema; cor: string; contraste: string }) {
  switch (simbolo) {
    case "estrela":
      return <polygon points="50,18 56,36 75,36 60,47 66,65 50,54 34,65 40,47 25,36 44,36" fill={cor} />;
    case "coroa":
      return <path d="M28 58 L24 28 L38 42 L50 22 L62 42 L76 28 L72 58 Z" fill={cor} />;
    case "raio":
      return <polygon points="56,16 34,46 48,46 42,66 66,34 52,34" fill={cor} />;
    case "bola":
      return (
        <g>
          <circle cx={50} cy={42} r={20} fill={cor} />
          <polygon points="50,32 59,39 56,50 44,50 41,39" fill={contraste} />
        </g>
      );
    default:
      return null;
  }
}

/** Camisa do time próprio em SVG. */
export function Camisa({
  modelo,
  cor,
  cor2,
  tamanho = 72,
}: {
  modelo: ModeloCamisa;
  cor: string;
  cor2: string;
  tamanho?: number;
}) {
  const corpo = "M30 8 L42 4 Q50 12 58 4 L70 8 L94 24 L84 42 L74 36 L74 96 L26 96 L26 36 L16 42 L6 24 Z";
  const id = `cam-${modelo}-${cor.slice(1)}-${cor2.slice(1)}`;
  return (
    <svg className="camisa-svg" width={tamanho} height={tamanho} viewBox="0 0 100 100" role="img" aria-label="Camisa">
      <defs>
        <clipPath id={id}>
          <path d={corpo} />
        </clipPath>
      </defs>
      <path d={corpo} fill={cor} />
      <g clipPath={`url(#${id})`} fill={cor2}>
        {modelo === "listras" && [18, 34, 50, 66, 82].map((x) => <rect key={x} x={x - 4} y={0} width={8} height={100} />)}
        {modelo === "horizontais" && [24, 44, 64, 84].map((y) => <rect key={y} x={0} y={y - 5} width={100} height={10} />)}
        {modelo === "faixa" && <polygon points="0,30 20,30 100,100 80,100 0,40" transform="translate(0 -8)" />}
        {modelo === "metades" && <rect x={50} y={0} width={50} height={100} />}
        {modelo === "detalhes" && (
          <>
            <rect x={0} y={0} width={100} height={6} />
            <polygon points="6,24 16,42 20,40 10,22" />
            <polygon points="94,24 84,42 80,40 90,22" />
            <rect x={26} y={90} width={48} height={6} />
          </>
        )}
      </g>
      <path d="M42 4 Q50 12 58 4" fill="none" stroke={cor2} strokeWidth={3} />
      <path d={corpo} fill="none" stroke="#0b1324" strokeOpacity={0.5} strokeWidth={1.5} />
    </svg>
  );
}

const TAMANHO_ESCUDO: Record<string, number> = { mini: 28, grande: 58, enorme: 96 };

/**
 * Escudo de um clube: o emblema desenhado, se for um time próprio; senão, a
 * sigla no fundo da cor do clube (sem escudos oficiais).
 */
export function Escudo({
  time,
  className = "escudo",
}: {
  time: { id: string; cor: string; sigla: string };
  className?: string;
}) {
  const cp = CLUBES_PROPRIOS.get(time.id);
  if (cp) {
    const tam = Object.entries(TAMANHO_ESCUDO).find(([k]) => className.split(" ").includes(k))?.[1] ?? 44;
    return (
      <span className={`${className} escudo-proprio`}>
        <Emblema
          forma={cp.emblema.forma}
          simbolo={cp.emblema.simbolo}
          cor={cp.cor}
          cor2={cp.corSecundaria}
          sigla={cp.sigla}
          tamanho={tam}
        />
      </span>
    );
  }
  return (
    <span className={className} style={estiloEscudo(time.cor)}>
      {time.sigla}
    </span>
  );
}
