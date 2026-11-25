#!/usr/bin/env python3
"""Junta data/estadios.txt em data/clubes.json: estádio, cores, camisas e emblema de cada clube.

Uso: python3 scripts/gerar_estadios.py

Cada clube ganha:
  estadio  = {nome, capacidade, atmosfera, qualidade}
  camisas  = [principal, reserva], cada uma {modelo, cor, cor2}
  emblema  = {forma, simbolo}  (escudo estilizado nas cores do clube, sem arte oficial)
Atmosfera/qualidade em branco no .txt são estimadas pelo nível do clube, país e capacidade.
"""
import json
import re
import sys
import zlib
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MODELOS = {"lisa", "listras", "horizontais", "faixa", "metades", "detalhes", "faixa-peito", "faixa-central"}
FORMAS = ["escudo", "classico", "redondo", "losango"]
COR = re.compile(r"^#[0-9a-fA-F]{6}$")
# Torcida mais quente ou mais fria que a média, por país (só para atmosfera em branco).
CALOR_PAIS = {"ARG": 12, "BRA": 7, "SRB": 6, "SCO": 5, "GER": 5, "ENG": 3, "ITA": 3, "POR": 2,
              "NED": 2, "ESP": 2, "FRA": 0, "BEL": 0, "DEN": -2, "AUT": -2, "NOR": -4, "KSA": -6}


def erro(msg):
    sys.exit(f"estadios.txt: {msg}")


def camisa(txt, padrao):
    if not txt:
        return padrao
    partes = txt.split()
    if partes[0] not in MODELOS:
        erro(f"modelo de camisa desconhecido: {partes[0]}")
    if len(partes) == 1:
        return {**padrao, "modelo": partes[0]}
    if len(partes) != 3 or not all(COR.match(c) for c in partes[1:]):
        erro(f"camisa inválida: {txt}")
    return {"modelo": partes[0], "cor": partes[1].lower(), "cor2": partes[2].lower()}


def main():
    clubes = json.loads((RAIZ / "data/clubes.json").read_text("utf-8"))
    por_id = {c["id"]: c for c in clubes}
    ligas_ts = (RAIZ / "src/engine/ligas.ts").read_text("utf-8")
    pais_da_liga = dict(re.findall(r'chave: "([^"]+)".*?sigla: "(\w+)"', ligas_ts))
    vistos = set()
    for n, linha in enumerate((RAIZ / "data/estadios.txt").read_text("utf-8").splitlines(), 1):
        linha = linha.strip()
        if not linha or linha.startswith("#"):
            continue
        campos = [x.strip() for x in linha.split("|")]
        if len(campos) != 8:
            erro(f"linha {n}: esperava 8 campos, veio {len(campos)}")
        cid, nome, cap, atm, qual, cores, cam1, cam2 = campos
        c = por_id.get(cid) or erro(f"linha {n}: clube desconhecido {cid}")
        if cid in vistos:
            erro(f"linha {n}: {cid} repetido")
        vistos.add(cid)
        if cores:
            cs = cores.split()
            if len(cs) != 2 or not all(COR.match(x) for x in cs):
                erro(f"linha {n}: cores inválidas")
            c["cor"], c["corSecundaria"] = cs[0].lower(), cs[1].lower()
        cor, cor2 = c["cor"], c.get("corSecundaria") or "#ffffff"
        if cor.lower() == cor2.lower():
            erro(f"linha {n}: {cid} com as duas cores iguais")
        capacidade = int(cap)
        pais = pais_da_liga.get(c["liga"], "BRA")
        if not atm:
            atm = round(40 + (c["nivel"] - 60) * 0.9 + CALOR_PAIS.get(pais, 0) + min(10, capacidade / 5000))
        if not qual:
            qual = round(45 + (c["nivel"] - 60) * 0.8 + min(10, capacidade / 6000))
        atm, qual = max(1, min(100, int(atm))), max(1, min(100, int(qual)))
        c["estadio"] = {"nome": nome, "capacidade": capacidade, "atmosfera": atm, "qualidade": qual}
        principal = camisa(cam1, {"modelo": "detalhes", "cor": cor, "cor2": cor2})
        reserva = camisa(cam2, {"modelo": "detalhes", "cor": cor2, "cor2": cor})
        if principal["cor"] == reserva["cor"]:
            erro(f"linha {n}: {cid} com principal e reserva da mesma cor")
        c["camisas"] = [principal, reserva]
        c["emblema"] = {"forma": FORMAS[zlib.crc32(cid.encode()) % len(FORMAS)], "simbolo": "nenhum"}
    faltam = [c["id"] for c in clubes if c["id"] not in vistos]
    if faltam:
        erro(f"clubes sem estádio: {', '.join(faltam)}")
    (RAIZ / "data/clubes.json").write_text(json.dumps(clubes, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"{len(vistos)} clubes com estádio, cores e camisas.")


if __name__ == "__main__":
    main()
