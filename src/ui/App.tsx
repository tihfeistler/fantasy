import { useState } from "react";
import { TIMES_EXEMPLO } from "../data/exemplo";
import type { Time } from "../engine/types";
import { TelaElenco } from "./TelaElenco";
import { TelaPartida } from "./TelaPartida";

type Aba = "elenco" | "partida";

export function App() {
  const [times, setTimes] = useState<Time[]>(TIMES_EXEMPLO);
  const [meuTimeId] = useState(TIMES_EXEMPLO[0].id);
  const [aba, setAba] = useState<Aba>("elenco");

  const meuTime = times.find((t) => t.id === meuTimeId)!;
  const atualizar = (t: Time) => setTimes((ts) => ts.map((x) => (x.id === t.id ? t : x)));

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">Fantasy</div>
        <div className="clube" style={{ borderColor: meuTime.cor }}>
          {meuTime.nome}
        </div>
        <nav>
          <button className={aba === "elenco" ? "ativo" : ""} onClick={() => setAba("elenco")}>
            Elenco
          </button>
          <button className={aba === "partida" ? "ativo" : ""} onClick={() => setAba("partida")}>
            Partida
          </button>
        </nav>
      </header>
      <main>
        {aba === "elenco" && <TelaElenco time={meuTime} onChange={atualizar} />}
        {aba === "partida" && (
          <TelaPartida meuTime={meuTime} adversarios={times.filter((t) => t.id !== meuTimeId)} />
        )}
      </main>
    </div>
  );
}
