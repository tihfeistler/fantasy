<?php
// Regras do modo online compartilhadas por api/online.php e api/ranqueado.php.
// As fórmulas são as mesmas do motor em TypeScript (src/engine/*.ts); se mudar
// uma, mude a outra.
declare(strict_types=1);

const CAIXA_INICIAL_ONLINE = 2000;     // R$ mil, como TIME_CARTAS_INICIAL
const CACHE_LENDA = 2;                 // lendas cobram cachê em dobro
const MAX_LENDAS_EM_CAMPO = 3;
const VAGAS_BANCO = 12;
const PRECO_PACOTE = 500;
const CARTAS_POR_PACOTE = 5;
const KIT_INICIAL = ['GOL' => 2, 'ZAG' => 3, 'LAT' => 3, 'VOL' => 2, 'MEI' => 3, 'ATA' => 3];
const FORMACOES = [
    '4-4-2' => ['ZAG' => 2, 'LAT' => 2, 'VOL' => 2, 'MEI' => 2, 'ATA' => 2],
    '4-3-3' => ['ZAG' => 2, 'LAT' => 2, 'VOL' => 1, 'MEI' => 2, 'ATA' => 3],
    '3-5-2' => ['ZAG' => 3, 'LAT' => 2, 'VOL' => 2, 'MEI' => 1, 'ATA' => 2],
    '4-5-1' => ['ZAG' => 2, 'LAT' => 2, 'VOL' => 2, 'MEI' => 3, 'ATA' => 1],
];
const CORES_TIME = ['#1e5bb8', '#c8102e', '#0b7a5a', '#f36c21', '#6a3fb5', '#b5121b', '#1b6a3f', '#d4a017'];

function erro(string $msg, int $status = 422): never
{
    if (db()->inTransaction()) db()->rollBack();
    responder(['erro' => $msg], $status);
}

// ---------------------------------------------------------------- economia

/** src/engine/mercado.ts: valorDeMercado e salarioMensal. */
function valorDeMercado(int $geral): int
{
    return (int) max(100, round(2000 * 2 ** (($geral - 60) / 5) / 50) * 50);
}
function salarioMensal(int $geral): int
{
    return (int) max(20, round(valorDeMercado($geral) / 100 / 5) * 5);
}
/** src/engine/desafios.ts: custoPorPartida, precoCartaBase, vendaCartaBase. */
function custoPorPartida(array $j): int
{
    return (int) round(salarioMensal((int) $j['geral']) / 4 * ($j['tipo'] === 'classico' ? CACHE_LENDA : 1));
}
function precoCartaBase(int $geral): int
{
    return (int) max(20, round(20 * 1.12 ** ($geral - 60) / 10) * 10);
}
function vendaCartaBase(int $geral): int
{
    return (int) max(5, round(precoCartaBase($geral) * 0.4 / 5) * 5);
}

// ---------------------------------------------------------------- cartas e time

/** Jogadores (formato do jogo) de que o usuário tem carta, com o número de cópias. */
function cartasDoUsuario(int $uid): array
{
    $s = db()->prepare('SELECT j.*, COUNT(*) AS copias FROM cartas c JOIN jogadores j ON j.id = c.jogador_id
        WHERE c.usuario_id = ? GROUP BY j.id ORDER BY j.geral DESC');
    $s->execute([$uid]);
    $r = [];
    foreach ($s->fetchAll() as $linha) {
        $j = linhaParaJogador($linha);
        $j['copias'] = (int) $linha['copias'];
        $r[$j['id']] = $j;
    }
    return $r;
}

/** Time online do usuário; cria com caixa inicial e kit de 16 cartas base na primeira vez. */
function timeOnline(int $uid, bool $travar = false): array
{
    $pdo = db();
    $s = $pdo->prepare('SELECT * FROM times_online WHERE usuario_id = ?' . ($travar ? ' FOR UPDATE' : ''));
    $s->execute([$uid]);
    $t = $s->fetch();
    if (!$t) {
        $pdo->prepare('INSERT IGNORE INTO times_online (usuario_id, caixa, formacao, titulares, banco) VALUES (?, ?, ?, ?, ?)')
            ->execute([$uid, CAIXA_INICIAL_ONLINE, '4-4-2', '[]', '[]']);
        $ins = $pdo->prepare("INSERT INTO cartas (usuario_id, jogador_id, origem) VALUES (?, ?, 'kit')");
        foreach (KIT_INICIAL as $pos => $n) {
            $q = $pdo->prepare("SELECT id FROM jogadores WHERE tipo = 'atual' AND posicao = ? AND geral BETWEEN 58 AND 68
                ORDER BY RAND() LIMIT $n");
            $q->execute([$pos]);
            foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $jid) $ins->execute([$uid, $jid]);
        }
        $s->execute([$uid]);
        $t = $s->fetch();
    }
    return [
        'caixa' => (int) $t['caixa'],
        'formacao' => $t['formacao'],
        'titulares' => json_decode($t['titulares'], true) ?: [],
        'banco' => json_decode($t['banco'], true) ?: [],
    ];
}

/** Custo da partida: salário de um quarto do mensal de cada titular, lendas em dobro. */
function custoDoTime(array $time, array $cartas): int
{
    $c = 0;
    foreach ($time['titulares'] as $id) if (isset($cartas[$id])) $c += custoPorPartida($cartas[$id]);
    return $c;
}

/** Time no formato do jogo (src/engine/types.ts, Time) para a partida. */
function timeDaPartida(int $uid, string $nome): array
{
    $t = timeOnline($uid);
    $cartas = cartasDoUsuario($uid);
    $ids = array_values(array_unique([...$t['titulares'], ...$t['banco']]));
    $elenco = [];
    foreach ($ids as $id) if (isset($cartas[$id])) {
        $j = $cartas[$id];
        unset($j['copias']);
        $elenco[] = $j;
    }
    $sigla = mb_strtoupper(mb_substr(preg_replace('/[^\p{L}\p{N}]/u', '', $nome) ?: 'EU', 0, 3));
    return [
        'id' => "u$uid",
        'nome' => $nome,
        'sigla' => $sigla,
        'cor' => CORES_TIME[$uid % count(CORES_TIME)],
        'elenco' => $elenco,
        'formacao' => ['nome' => $t['formacao']] + FORMACOES[$t['formacao']],
        'titulares' => array_values(array_filter($t['titulares'], fn($id) => isset($cartas[$id]))),
        'banco' => array_values(array_filter($t['banco'], fn($id) => isset($cartas[$id]))),
        'maxLendas' => MAX_LENDAS_EM_CAMPO,
    ];
}

// ---------------------------------------------------------------- ranqueado

/** 20 divisões (Bronze IV a Diamante I) e a Elite. */
const LIGAS = ['Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante'];
const ELITE = 20;
const MMR_INICIAL = 1000;

function nomeDivisao(int $tier): string
{
    if ($tier >= ELITE) return 'Elite';
    return LIGAS[intdiv($tier, 4)] . ' ' . ['IV', 'III', 'II', 'I'][$tier % 4];
}

/** Temporada trimestral: 2026 T4 = 20264. */
function temporadaAtual(): int
{
    return (int) date('Y') * 10 + intdiv((int) date('n') - 1, 3) + 1;
}

/** MMR esperado para cada divisão: Bronze IV = 800, cada divisão +40. */
function mmrDaDivisao(int $tier): int
{
    return 800 + 40 * min($tier, ELITE);
}

/** Perfil da temporada; cria com reset parcial (desce 4 divisões) a partir da temporada anterior. */
function perfilRanqueado(int $uid, bool $travar = false): array
{
    $pdo = db();
    $temp = temporadaAtual();
    $s = $pdo->prepare('SELECT * FROM ranqueado WHERE usuario_id = ? AND temporada = ?' . ($travar ? ' FOR UPDATE' : ''));
    $s->execute([$uid, $temp]);
    $p = $s->fetch();
    if (!$p) {
        $ant = $pdo->prepare('SELECT tier, mmr FROM ranqueado WHERE usuario_id = ? AND temporada < ? ORDER BY temporada DESC LIMIT 1');
        $ant->execute([$uid, $temp]);
        $a = $ant->fetch();
        $tier = $a ? max(0, (int) $a['tier'] - 4) : 0;
        $mmr = $a ? (int) round(((int) $a['mmr'] + MMR_INICIAL) / 2) : MMR_INICIAL;
        $pdo->prepare('INSERT IGNORE INTO ranqueado (usuario_id, temporada, tier, pdl, mmr) VALUES (?, ?, ?, 0, ?)')
            ->execute([$uid, $temp, $tier, $mmr]);
        $s->execute([$uid, $temp]);
        $p = $s->fetch();
    }
    return $p;
}

function perfilPublico(array $p): array
{
    return [
        'temporada' => (int) $p['temporada'],
        'tier' => (int) $p['tier'],
        'divisao' => nomeDivisao((int) $p['tier']),
        'pdl' => (int) $p['pdl'],
        'vitorias' => (int) $p['vitorias'],
        'empates' => (int) $p['empates'],
        'derrotas' => (int) $p['derrotas'],
    ];
}

/**
 * Pontos de liga de uma partida. Quem tem MMR acima da divisão ganha mais e
 * perde menos (sobe rápido); quem está abaixo, o contrário. Empate não mexe.
 */
function variacaoPdl(int $tier, int $mmr, float $pontos): int
{
    if ($pontos === 0.5) return 0;
    $ajuste = ($mmr - mmrDaDivisao($tier)) / 25;
    return $pontos === 1.0
        ? (int) max(12, min(30, round(20 + $ajuste)))
        : -(int) max(12, min(28, round(20 - $ajuste)));
}

/** Aplica PDL com promoção (100 pontos) e rebaixamento (abaixo de 0 volta com 75). */
function aplicarPdl(int $tier, int $pdl, int $delta): array
{
    $pdl += $delta;
    while ($tier < ELITE && $pdl >= 100) {
        $tier++;
        $pdl -= 100;
    }
    if ($pdl < 0) {
        if ($tier === 0) $pdl = 0;
        else {
            $tier--;
            $pdl = 75;
        }
    }
    return [$tier, $pdl];
}

/** Elo: K = 32. */
function novoMmr(int $mmr, int $mmrAdv, float $pontos): int
{
    $esperado = 1 / (1 + 10 ** (($mmrAdv - $mmr) / 400));
    return (int) round($mmr + 32 * ($pontos - $esperado));
}

/** Prêmio por partida ranqueada: [R$ mil no caixa, moedas]. */
const PREMIO_RANQUEADO = ['vitoria' => [800, 60], 'empate' => [400, 25], 'derrota' => [200, 10]];
