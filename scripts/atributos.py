"""Tabela de pesos e funções comuns aos scripts de dados (igual a src/engine/ratings.ts)."""
import hashlib

ATRIBUTOS = ["finalizacao", "passe", "drible", "velocidade", "defesa", "fisico", "mentalidade", "goleiro"]

PESOS = {
    "GOL": dict(goleiro=0.75, mentalidade=0.1, fisico=0.05, passe=0.05, velocidade=0.05),
    "ZAG": dict(defesa=0.5, fisico=0.2, mentalidade=0.1, velocidade=0.1, passe=0.1),
    "LAT": dict(defesa=0.3, velocidade=0.25, passe=0.15, drible=0.1, fisico=0.1, mentalidade=0.05, finalizacao=0.05),
    "VOL": dict(defesa=0.35, passe=0.25, fisico=0.15, mentalidade=0.15, drible=0.05, velocidade=0.05),
    "MEI": dict(passe=0.35, drible=0.25, finalizacao=0.15, mentalidade=0.15, velocidade=0.05, fisico=0.05),
    "ATA": dict(finalizacao=0.45, drible=0.15, velocidade=0.15, fisico=0.1, mentalidade=0.1, passe=0.05),
}


def geral(atr, pos):
    return max(1, min(100, round(sum(atr[k] * p for k, p in PESOS[pos].items()))))


def ruido(chave, a, b):
    """Inteiro fixo entre a e b derivado do texto (mesma entrada, mesmo valor)."""
    h = int(hashlib.md5(chave.encode()).hexdigest(), 16)
    return a + h % (b - a + 1)


def ajustar_ao_alvo(atr, pos, alvo):
    """Sobe ou desce os atributos que pesam na posição até o geral bater o alvo."""
    for _ in range(8):
        d = alvo - geral(atr, pos)
        if d == 0:
            break
        for k, p in PESOS[pos].items():
            if p >= 0.1:
                atr[k] = max(1, min(99, atr[k] + d))
    return atr
