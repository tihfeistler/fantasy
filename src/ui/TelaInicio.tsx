import type { ReactNode } from "react";

/** Tela de entrada do jogo (login, servidor fora): o mesmo gramado do lobby. */
export function TelaInicio({ children }: { children: ReactNode }) {
  return (
    <section className="lobby inicio">
      <div className="lobby-luzes" aria-hidden="true" />
      <header className="lobby-topo">
        <div className="marca grande">
          Fantasy<span>Manager</span>
        </div>
      </header>
      <div className="inicio-corpo">{children}</div>
    </section>
  );
}
