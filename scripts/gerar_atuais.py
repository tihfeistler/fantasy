#!/usr/bin/env python3
"""
Gera data/atuais.json (jogadores atuais) a partir de data/elencos-2026.txt
(Série A), data/elencos-serie-b-2026.txt (Série B) e
data/elencos-estrangeiros-2026.txt (Inglaterra, Espanha, Itália, Alemanha,
França, Portugal e Argentina).

Formato do .txt, uma linha por jogador:
    clubeId | camisa | GK/DF/MF/FW | NAC | Nome [| POSICAO_FINA] [| geral]
A 6ª coluna (opcional) força a posição do jogo (GOL/ZAG/LAT/VOL/MEI/ATA).
A 7ª coluna (opcional) força o geral alvo (1-100).
data/destaques-2026.txt também define o geral alvo (e, opcional, a posição)
de jogadores conhecidos.

RASCUNHO: as fontes públicas só dão posição genérica, sem atributos.
Posição fina sai da numeração brasileira (2/6 laterais, 5/8 volantes...)
e os atributos saem do nível do clube + papel + uma variação fixa por nome.
Corrija editando o .txt (colunas 6 e 7) e rode de novo:
    python3 scripts/gerar_atuais.py
"""
import json, re, sys, unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
from atributos import ATRIBUTOS, PESOS, ajustar_ao_alvo, geral, ruido  # noqa: E402

# Atributos relativos ao alvo N (N = força desejada no papel principal).
MODELOS = {
    "GOL": lambda N: dict(finalizacao=10, passe=N - 30, drible=20, velocidade=N - 35, defesa=N - 40, fisico=N - 10, mentalidade=N - 4, goleiro=N),
    "ZAG": lambda N: dict(finalizacao=N - 45, passe=N - 18, drible=N - 30, velocidade=N - 15, defesa=N, fisico=N, mentalidade=N - 5, goleiro=10),
    "LAT": lambda N: dict(finalizacao=N - 25, passe=N - 6, drible=N - 10, velocidade=N + 3, defesa=N - 3, fisico=N - 8, mentalidade=N - 8, goleiro=10),
    "VOL": lambda N: dict(finalizacao=N - 25, passe=N - 2, drible=N - 15, velocidade=N - 12, defesa=N, fisico=N - 3, mentalidade=N - 4, goleiro=10),
    "MEI": lambda N: dict(finalizacao=N - 8, passe=N + 1, drible=N, velocidade=N - 6, defesa=N - 35, fisico=N - 14, mentalidade=N - 4, goleiro=10),
    "ATA": lambda N: dict(finalizacao=N + 1, passe=N - 15, drible=N - 4, velocidade=N - 4, defesa=N - 50, fisico=N - 8, mentalidade=N - 6, goleiro=10),
}

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

# Numeração típica de cada escola: (zagueiros, laterais, meias, volantes).
# Brasil: 2/6 laterais, 3/4 zagueiros, 5/8 volantes, 10 meia.
# Europa: 2/3 laterais, 4/5/6 zagueiros, 6/8 volantes, 7/10/11 meias.
# Argentina: 2/6 zagueiros, 3/4 laterais, 5 volante, 10 meia.
NUMERACAO = {
    "BR": ({3, 4, 14, 15}, {2, 6, 13, 16}, {10, 20}, {5, 8}),
    "EU": ({4, 5, 15, 24}, {2, 3, 12, 22}, {10, 7, 11, 20}, {6, 8, 16}),
    "AR": ({2, 6, 26}, {3, 4, 13}, {10, 20}, {5, 8}),
}
ESCOLA = {"brasileirao-a": "BR", "brasileirao-b": "BR", "liga-argentina": "AR"}

def posicoes_finas(jogadores, escola="BR"):
    """Distribui DF em ZAG/LAT e MF em VOL/MEI pela numeração."""
    def divide(lista, fixos_a, fixos_b, pa, pb, frac_b):
        res = {}
        resto = []
        for j in lista:
            if j["camisa"] in fixos_a: res[id(j)] = pa
            elif j["camisa"] in fixos_b: res[id(j)] = pb
            else: resto.append(j)
        alvo_b = round(len(lista) * frac_b) - sum(1 for v in res.values() if v == pb)
        for i, j in enumerate(sorted(resto, key=lambda x: x["camisa"])):
            res[id(j)] = pb if alvo_b > 0 and i % 2 == 1 else pa
            if res[id(j)] == pb: alvo_b -= 1
        return res
    dfs = [j for j in jogadores if j["gen"] == "DF" and not j["fina"]]
    mfs = [j for j in jogadores if j["gen"] == "MF" and not j["fina"]]
    m = {}
    zag, lat, mei, vol = NUMERACAO[escola]
    m.update(divide(dfs, zag, lat, "ZAG", "LAT", 0.4))
    m.update(divide(mfs, mei, vol, "MEI", "VOL", 0.45))
    for j in jogadores:
        if j["fina"]: continue
        j["fina"] = m.get(id(j)) or {"GK": "GOL", "FW": "ATA"}[j["gen"]]

def main():
    clubes = {c["id"]: c for c in json.loads((RAIZ / "data/clubes.json").read_text("utf-8"))}
    por_clube = {}
    linhas = []
    for arq in ("data/elencos-2026.txt", "data/elencos-serie-b-2026.txt", "data/elencos-estrangeiros-2026.txt"):
        if (RAIZ / arq).exists():
            linhas += [(f"{arq}:{n}", l) for n, l in enumerate((RAIZ / arq).read_text("utf-8").splitlines(), 1)]
    for n, linha in linhas:
        linha = linha.strip()
        if not linha or linha.startswith("#"): continue
        cols = [c.strip() for c in linha.split("|")]
        if len(cols) < 5: sys.exit(f"linha {n}: esperado 5+ colunas: {linha}")
        clube, camisa, gen, nac, nome = cols[:5]
        if clube not in clubes: sys.exit(f"linha {n}: clube desconhecido {clube}")
        por_clube.setdefault(clube, []).append(dict(
            clube=clube, camisa=int(camisa) if camisa.isdigit() else 99, gen=gen.upper(),
            nac=nac.upper(), nome=nome, fina=(cols[5].upper() if len(cols) > 5 and cols[5] else None),
            alvo=(int(cols[6]) if len(cols) > 6 and cols[6] else None)))
    destaques = {}
    for arq_d in (RAIZ / "data/destaques-2026.txt", RAIZ / "data/destaques-estrangeiros-2026.txt"):
        if not arq_d.exists(): continue
        for n, linha in enumerate(arq_d.read_text("utf-8").splitlines(), 1):
            if linha.strip() and not linha.startswith("#"):
                cols = [x.strip() for x in linha.split("|")]
                c, nome, g = cols[:3]
                if (c, nome) in destaques: sys.exit(f"{arq_d.name}:{n}: destaque repetido {nome}")
                destaques[(c, nome)] = (int(g), cols[3].upper() if len(cols) > 3 and cols[3] else None)
    usados = set()
    for clube, js in por_clube.items():
        for j in js:
            d = destaques.get((clube, j["nome"]))
            if d:
                usados.add((clube, j["nome"]))
                if d[1] and not j["fina"]: j["fina"] = d[1]
    faltam = sorted(set(destaques) - usados)
    if faltam: print(f"Aviso: {len(faltam)} destaques sem jogador no elenco: {faltam[:10]}")
    saida, ids = [], set()
    for clube, js in por_clube.items():
        posicoes_finas(js, ESCOLA.get(clubes[clube]["liga"], "EU"))
        nivel = clubes[clube]["nivel"]
        for j in js:
            pos = j["fina"]
            papel = 0 if j["camisa"] == 0 else 3 if j["camisa"] <= 11 else (-5 if j["camisa"] >= 40 else 0)
            N = j["alvo"] or destaques.get((clube, j["nome"]), (None,))[0] or nivel - 6 + papel + ruido(clube + j["nome"], -6, 3)
            atr = {k: max(1, min(99, v)) for k, v in MODELOS[pos](N).items()}
            ajustar_ao_alvo(atr, pos, N)
            atr = {k: atr[k] for k in ATRIBUTOS}
            # id = nome + clube de origem. Fica fixo mesmo se o jogador mudar de
            # clube depois, e nunca colide com os ids dos clássicos.
            pid = f"{slug(j['nome'])}-{clube}"
            n = 2
            while pid in ids:
                pid = f"{slug(j['nome'])}-{clube}-{n}"; n += 1
            ids.add(pid)
            saida.append(dict(id=pid, tipo="atual", nome=j["nome"], nacionalidade=j["nac"],
                              posicao=pos, pe="D", clubeId=clube, atributos=atr, geral=geral(atr, pos)))
    (RAIZ / "data/atuais.json").write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"{len(saida)} jogadores atuais em {len(por_clube)} clubes -> data/atuais.json")

if __name__ == "__main__":
    main()
