import { useEffect, type ReactNode } from "react";

/** Janela sobre a tela. Fecha com Esc, clique fora ou no botão. */
export function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);
  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button className="botao" onClick={onFechar} autoFocus>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
