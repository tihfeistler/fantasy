"""Gera data/jogadores.json a partir de data/jogadores.txt.

Uso: python3 scripts/gerar_jogadores.py
Formato de cada linha do .txt:
nome|nac|pos|pe|inicio|fim|auge|clube|ataque defesa passe velocidade fisico goleiro
"""
import json, re, sys, unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ATRS = ["ataque", "defesa", "passe", "velocidade", "fisico", "goleiro"]
# Mesmos pesos de src/engine/ratings.ts (PESOS). Mudou lá, mude aqui.
PESOS = {
    "GOL": dict(ataque=0, defesa=0.1, passe=0.05, velocidade=0, fisico=0.05, goleiro=0.8),
    "ZAG": dict(ataque=0, defesa=0.55, passe=0.1, velocidade=0.1, fisico=0.25, goleiro=0),
    "LAT": dict(ataque=0.1, defesa=0.35, passe=0.2, velocidade=0.25, fisico=0.1, goleiro=0),
    "VOL": dict(ataque=0.05, defesa=0.4, passe=0.3, velocidade=0.05, fisico=0.2, goleiro=0),
    "MEI": dict(ataque=0.3, defesa=0.05, passe=0.45, velocidade=0.1, fisico=0.1, goleiro=0),
    "ATA": dict(ataque=0.6, defesa=0, passe=0.1, velocidade=0.2, fisico=0.1, goleiro=0),
}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def geral(atr, pos):
    v = sum(atr[k] * PESOS[pos][k] for k in ATRS)
    # Math.round do JS: arredonda .5 para cima
    return max(1, min(100, int(v + 0.5)))


def main():
    jogadores, ids, erros = [], set(), []
    for n, linha in enumerate((RAIZ / "data/jogadores.txt").read_text(encoding="utf-8").splitlines(), 1):
        linha = linha.strip()
        if not linha or linha.startswith("#"):
            continue
        p = linha.split("|")
        if len(p) != 9:
            erros.append(f"linha {n}: {len(p)} campos"); continue
        nome, nac, pos, pe, ini, fim, auge, clube, notas = p
        vals = [int(x) for x in notas.split()]
        atr = dict(zip(ATRS, vals))
        jid = slug(nome)
        ini, fim, auge = int(ini), int(fim), int(auge)
        if jid in ids: erros.append(f"linha {n}: id repetido {jid}")
        if pos not in PESOS: erros.append(f"linha {n}: posição {pos}")
        if pe not in "DEA" or len(pe) != 1: erros.append(f"linha {n}: pé {pe}")
        if len(vals) != 6 or not all(1 <= v <= 100 for v in vals): erros.append(f"linha {n}: atributos {notas}")
        if not (ini <= auge <= fim): erros.append(f"linha {n}: auge fora da época")
        if not re.fullmatch(r"[A-Z]{3}", nac): erros.append(f"linha {n}: nacionalidade {nac}")
        ids.add(jid)
        jogadores.append({
            "id": jid, "nome": nome, "nacionalidade": nac, "posicao": pos, "pe": pe,
            "epoca": {"inicio": ini, "fim": fim}, "auge": auge, "clubeMarcante": clube,
            "atributos": atr, "geral": geral(atr, pos),
        })
    if erros:
        print("\n".join(erros)); sys.exit(1)
    saida = RAIZ / "data/jogadores.json"
    saida.write_text(json.dumps(jogadores, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(jogadores)} jogadores -> {saida.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
