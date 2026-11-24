import { useState } from "react";
import { montarTimesAtuais } from "../data/clubes";
import type { Time } from "../engine/types";
import { TelaElenco } from "./TelaElenco";
import { TelaLendas } from "./TelaLendas";
import { TelaPartida } from "./TelaPartida";

type Aba = "elenco" | "partida" | "lendas";

export function App() {
  const [times, setTimes] = useState<Time[]>(montarTimesAtuais);
  const [meuTimeId, setMeuTimeId] = useState("flamengo");
  const [aba, setAba] = useState<Aba>("elenco");

  const meuTime = times.find((t) => t.id === meuTimeId)!;
  const atualizar = (t: Time) => setTimes((ts) => ts.map((x) => (x.id === t.id ? t : x)));

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">Fantasy</div>
        <label className="clube" style={{ borderColor: meuTime.cor }}>
          <select value={meuTimeId} onChange={(e) => setMeuTimeId(e.target.value)} title="Seu clube">
            {times.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <nav>
          <button className={aba === "elenco" ? "ativo" : ""} onClick={() => setAba("elenco")}>
            Elenco
          </button>
          <button className={aba === "partida" ? "ativo" : ""} onClick={() => setAba("partida")}>
            Partida
          </button>
          <button className={aba === "lendas" ? "ativo" : ""} onClick={() => setAba("lendas")}>
            Lendas
          </button>
        </nav>
      </header>
      <main>
        {aba === "elenco" && <TelaElenco time={meuTime} onChange={atualizar} />}
        {aba === "lendas" && <TelaLendas />}
        {aba === "partida" && (
          <TelaPartida meuTime={meuTime} adversarios={times.filter((t) => t.id !== meuTimeId)} />
        )}
      </main>
    </div>
  );
}
