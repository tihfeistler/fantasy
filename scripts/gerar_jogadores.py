"""Gera data/jogadores.json a partir de data/jogadores.txt.

Uso: python3 scripts/gerar_jogadores.py
Formato de cada linha do .txt:
nome|nac|pos|pe|inicio|fim|auge|clube|finalizacao passe drible velocidade defesa fisico mentalidade goleiro
"""
import json, re, sys, unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ATRS = ["finalizacao", "passe", "drible", "velocidade", "defesa", "fisico", "mentalidade", "goleiro"]
# Mesmos pesos de src/engine/ratings.ts e scripts/atributos.py. Mudou lá, mude aqui.
PESOS = {
    "GOL": dict(goleiro=0.75, mentalidade=0.1, fisico=0.05, passe=0.05, velocidade=0.05),
    "ZAG": dict(defesa=0.5, fisico=0.2, mentalidade=0.1, velocidade=0.1, passe=0.1),
    "LAT": dict(defesa=0.3, velocidade=0.25, passe=0.15, drible=0.1, fisico=0.1, mentalidade=0.05, finalizacao=0.05),
    "VOL": dict(defesa=0.35, passe=0.25, fisico=0.15, mentalidade=0.15, drible=0.05, velocidade=0.05),
    "MEI": dict(passe=0.35, drible=0.25, finalizacao=0.15, mentalidade=0.15, velocidade=0.05, fisico=0.05),
    "ATA": dict(finalizacao=0.45, drible=0.15, velocidade=0.15, fisico=0.1, mentalidade=0.1, passe=0.05),
}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def geral(atr, pos):
    v = sum(atr[k] * p for k, p in PESOS[pos].items())
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
        if len(vals) != 8 or not all(1 <= v <= 100 for v in vals): erros.append(f"linha {n}: atributos {notas}")
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
