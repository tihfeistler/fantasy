#!/usr/bin/env python3
"""
Converte um JSON de jogadores do formato antigo (6 atributos: ataque, defesa,
passe, velocidade, fisico, goleiro) para o novo (8 atributos), mantendo o geral.

    python3 scripts/converter_atributos.py data/jogadores.json

Regras: finalizacao = ataque; drible = mistura de ataque, passe e velocidade;
mentalidade = perto do geral antigo (variação fixa por jogador). Depois os
atributos são ajustados para o geral novo ficar igual ao antigo.
Arquivos já no formato novo ficam como estão.
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from atributos import ATRIBUTOS, ajustar_ao_alvo, geral, ruido

def converter(j):
    a = j["atributos"]
    if "finalizacao" in a:
        return j, False
    pos, alvo = j["posicao"], j["geral"]
    gk = pos == "GOL"
    novo = dict(
        finalizacao=a["ataque"],
        passe=a["passe"],
        drible=20 if gk else round(0.5 * a["ataque"] + 0.3 * a["passe"] + 0.2 * a["velocidade"]),
        velocidade=a["velocidade"],
        defesa=a["defesa"],
        fisico=a["fisico"],
        mentalidade=max(1, min(99, alvo + ruido(j["id"] + "men", -4, 4))),
        goleiro=a["goleiro"],
    )
    j["atributos"] = {k: novo[k] for k in ATRIBUTOS}
    ajustar_ao_alvo(j["atributos"], pos, alvo)
    j["geral"] = geral(j["atributos"], pos)
    return j, True

def main(caminho):
    p = Path(caminho)
    dados = json.loads(p.read_text("utf-8"))
    n = sum(converter(j)[1] for j in dados)
    p.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"{n} de {len(dados)} jogadores convertidos em {p}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/jogadores.json")
