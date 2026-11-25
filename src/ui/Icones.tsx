/** Ícones de traço simples (24×24), na cor do texto. */
const CAMINHOS = {
  escritorio: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  elenco: "M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3c0 2-1.5 3-4 3S8 5 8 3z",
  partida: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8l3.5 2.5-1.3 4h-4.4l-1.3-4zM12 3v5M20.5 9.5l-5 1M17 19l-2.8-4.5M7 19l2.8-4.5M3.5 9.5l5 1",
  campeonato: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H4c0 3 2 5 4 5M16 6h4c0 3-2 5-4 5M12 13v4M8 20h8M9 17h6",
  mercado: "M4 8h13l-3-3M20 16H7l3 3",
  financas: "M4 20h16M6 16v-5M10 16V8M14 16v-3M18 16V5",
  menu: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  desafios: "M5 19L19 5M14 5h5v5M5 5l5 5M14 14l5 5M5 19v-4",
  online: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  colecao: "M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM3 7v11M21 7v11M12 9l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z",
  estoque: "M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9",
  lendas: "M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z",
  voltar: "M15 5l-7 7 7 7",
  alerta: "M12 4l9 16H3zM12 10v4M12 17v.5",
  copa: "M3 4h5v4H3zM3 16h5v4H3zM8 6h3v12H8M11 12h3M14 10h7v4h-7z",
  noticia: "M5 5h12v14H5zM17 9h2v8a2 2 0 0 1-2 2M8 9h6M8 12h6M8 15h4",
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      className="icone"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
