<?php
// Ranqueado online: fila, partida ao vivo entre dois técnicos, divisões e pontos de liga.
// Exige login (api/auth.php) e usa o time de cartas de api/online.php.
//
// GET  api/ranqueado.php?acao=estado[&partida=id]  fila e partida atual (o cliente consulta a cada 1-2 s)
// GET  api/ranqueado.php?acao=ranking              top 100 da temporada, minha posição e meus últimos jogos
// POST api/ranqueado.php {acao:"entrar_fila"}      precisa de 11 titulares e caixa para o salário da partida
// POST api/ranqueado.php {acao:"sair_fila"}
// POST api/ranqueado.php {acao:"decidir", partida_id, decisao:{tipo:"tatica", tatica} | {tipo:"sub", sai, entra}}
// POST api/ranqueado.php {acao:"relatar", partida_id, gols:[mandante, visitante]}
// POST api/ranqueado.php {acao:"convidar", nome}                   amistoso com um amigo (vale 5 minutos)
// POST api/ranqueado.php {acao:"responder_convite", convite_id, aceitar:true|false}
// POST api/ranqueado.php {acao:"cancelar_convite", convite_id}
//
// Amistoso: mesma partida ao vivo, só pela diversão: sem salário, sem prêmio e sem pontos de liga.
//
// Como a partida funciona: ao parear dois técnicos, o servidor cobra o salário de cada um,
// guarda a seed e os dois times e marca o início. O relógio é do servidor: cada minuto de
// jogo dura SEG_POR_MINUTO segundos. As decisões recebem o minuto do servidor + 1, então
// valem para os dois clientes ao mesmo tempo. Os dois rodam o mesmo motor determinístico
// (src/engine/match.ts) e, no apito final, relatam o placar. Placares iguais encerram a
// partida; diferentes anulam (o salário volta). Se só um relatar, vale o relato dele.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/online_lib.php';
iniciarApi();
$eu = exigirUsuario();
$pdo = db();

// 90 minutos = 3 minutos de relógio. Dá para acelerar em testes com 'seg_por_minuto' no config.local.php.
define('SEG_POR_MINUTO', (float) (config()['seg_por_minuto'] ?? 2));
const ESPERA_INICIO = 8;           // segundos entre parear e a bola rolar
const FILA_INATIVA = 10;           // quem não consulta há 10 s sai do pareamento
const PRAZO_RELATO = 20;           // depois do fim, espera o outro relato por 20 s
const PRAZO_ANULAR = 120;          // sem nenhum relato em 2 min, anula

function partidaPorId(int $id, bool $travar = false): ?array
{
    $s = db()->prepare('SELECT p.*, ROUND(UNIX_TIMESTAMP(p.inicio) * 1000) AS inicio_ms,
        ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000) AS agora_ms FROM partidas_online p WHERE p.id = ?' . ($travar ? ' FOR UPDATE' : ''));
    $s->execute([$id]);
    return $s->fetch() ?: null;
}

function partidaAoVivoDe(int $uid): ?array
{
    $s = db()->prepare("SELECT id FROM partidas_online WHERE status = 'ao_vivo' AND (mandante_id = ? OR visitante_id = ?)
        ORDER BY id DESC LIMIT 1");
    $s->execute([$uid, $uid]);
    $id = $s->fetchColumn();
    return $id ? partidaPorId((int) $id) : null;
}

function minutoDoServidor(array $p): int
{
    return (int) floor(((int) $p['agora_ms'] - (int) $p['inicio_ms']) / 1000 / SEG_POR_MINUTO);
}

function payloadPartida(array $p, int $uid): array
{
    $s = db()->prepare('SELECT id, usuario_id, minuto, dados FROM decisoes_online WHERE partida_id = ? ORDER BY id');
    $s->execute([$p['id']]);
    $decisoes = array_map(fn($d) => ['id' => (int) $d['id'], 'minuto' => (int) $d['minuto'], 'timeId' => 'u' . $d['usuario_id']]
        + json_decode($d['dados'], true), $s->fetchAll());
    $souMandante = (int) $p['mandante_id'] === $uid;
    return [
        'id' => (int) $p['id'],
        'status' => $p['status'],
        'tipo' => $p['tipo'],
        'seed' => (int) $p['seed'],
        'mandante' => json_decode($p['time_mandante'], true),
        'visitante' => json_decode($p['time_visitante'], true),
        'meuTimeId' => "u$uid",
        'inicioMs' => (int) $p['inicio_ms'],
        'agoraMs' => (int) $p['agora_ms'],
        'segPorMinuto' => SEG_POR_MINUTO,
        'decisoes' => $decisoes,
        'custo' => (int) ($souMandante ? $p['custo_mandante'] : $p['custo_visitante']),
        'relatei' => ($souMandante ? $p['relato_mandante'] : $p['relato_visitante']) !== null,
        'gols' => $p['gols_mandante'] === null ? null : [(int) $p['gols_mandante'], (int) $p['gols_visitante']],
        'pdl' => $p['pdl_mandante'] === null ? null : (int) ($souMandante ? $p['pdl_mandante'] : $p['pdl_visitante']),
    ];
}

/** Encerra ou anula a partida quando os relatos chegam ou os prazos vencem. */
function finalizarSePreciso(array $p): array
{
    if ($p['status'] !== 'ao_vivo') return $p;
    $fim = (int) $p['inicio_ms'] + 90 * SEG_POR_MINUTO * 1000;
    $agora = (int) $p['agora_ms'];
    if ($agora < $fim) return $p;
    $rm = $p['relato_mandante'];
    $rv = $p['relato_visitante'];
    if ($rm !== null && $rv !== null) $rm === $rv ? encerrar((int) $p['id'], $rm) : anular((int) $p['id']);
    elseif (($rm ?? $rv) !== null && $agora > $fim + PRAZO_RELATO * 1000) encerrar((int) $p['id'], $rm ?? $rv);
    elseif ($agora > $fim + PRAZO_ANULAR * 1000) anular((int) $p['id']);
    else return $p;
    return partidaPorId((int) $p['id']);
}

function encerrar(int $id, string $placar): void
{
    $pdo = db();
    $pdo->beginTransaction();
    $p = partidaPorId($id, true);
    if ($p['status'] !== 'ao_vivo') {
        $pdo->rollBack();
        return;
    }
    [$gm, $gv] = array_map('intval', explode('-', $placar));
    $m = (int) $p['mandante_id'];
    $v = (int) $p['visitante_id'];
    $s = $pdo->prepare('SELECT * FROM ranqueado WHERE usuario_id = ? AND temporada = ? FOR UPDATE');
    $s->execute([$m, $p['temporada']]);
    $pm = $s->fetch();
    $s->execute([$v, $p['temporada']]);
    $pv = $s->fetch();
    $pontosM = $gm > $gv ? 1.0 : ($gm === $gv ? 0.5 : 0.0);
    if ($p['tipo'] === 'amistoso') {
        // Amistoso não mexe em nada: só registra o placar.
        $pdo->prepare("UPDATE partidas_online SET status = 'encerrada', gols_mandante = ?, gols_visitante = ?,
            finalizada_em = NOW() WHERE id = ?")->execute([$gm, $gv, $id]);
        $pdo->commit();
        return;
    }
    $deltas = [];
    foreach ([[$m, $pm, $pv, $pontosM], [$v, $pv, $pm, 1 - $pontosM]] as [$uid, $eu, $adv, $pontos]) {
        $chave = $pontos === 1.0 ? 'vitoria' : ($pontos === 0.5 ? 'empate' : 'derrota');
        {
            $delta = variacaoPdl((int) $eu['tier'], (int) $eu['mmr'], $pontos);
            [$tier, $pdl] = aplicarPdl((int) $eu['tier'], (int) $eu['pdl'], $delta);
            $col = $pontos === 1.0 ? 'vitorias' : ($pontos === 0.5 ? 'empates' : 'derrotas');
            $pdo->prepare("UPDATE ranqueado SET tier = ?, tier_max = GREATEST(tier_max, ?), pdl = ?, mmr = ?, $col = $col + 1
                WHERE usuario_id = ? AND temporada = ?")
                ->execute([$tier, $tier, $pdl, novoMmr((int) $eu['mmr'], (int) $adv['mmr'], $pontos), $uid, $p['temporada']]);
            [$dinheiro, $moedas] = PREMIO_RANQUEADO[$chave];
        }
        $pdo->prepare('UPDATE times_online SET caixa = caixa + ? WHERE usuario_id = ?')->execute([$dinheiro, $uid]);
        $pdo->prepare('UPDATE usuarios SET moedas = moedas + ? WHERE id = ?')->execute([$moedas, $uid]);
        $deltas[] = $delta;
    }
    $pdo->prepare("UPDATE partidas_online SET status = 'encerrada', gols_mandante = ?, gols_visitante = ?,
        pdl_mandante = ?, pdl_visitante = ?, finalizada_em = NOW() WHERE id = ?")
        ->execute([$gm, $gv, $deltas[0], $deltas[1], $id]);
    $pdo->commit();
}

function anular(int $id): void
{
    $pdo = db();
    $pdo->beginTransaction();
    $p = partidaPorId($id, true);
    if ($p['status'] === 'ao_vivo') {
        $u = $pdo->prepare('UPDATE times_online SET caixa = caixa + ? WHERE usuario_id = ?');
        $u->execute([$p['custo_mandante'], $p['mandante_id']]);
        $u->execute([$p['custo_visitante'], $p['visitante_id']]);
        $pdo->prepare("UPDATE partidas_online SET status = 'anulada', finalizada_em = NOW() WHERE id = ?")->execute([$id]);
    }
    $pdo->commit();
}

function nomeDe(int $uid): string
{
    $s = db()->prepare('SELECT nome FROM usuarios WHERE id = ?');
    $s->execute([$uid]);
    return (string) $s->fetchColumn();
}

/** Motivo para não poder jogar agora, ou null. */
function impedimento(int $uid, bool $cobraSalario = true): ?string
{
    $t = timeOnline($uid);
    $cartas = cartasDoUsuario($uid);
    $tit = array_filter($t['titulares'], fn($id) => isset($cartas[$id]));
    if (count($tit) < 11) return 'Escale 11 titulares no seu time online antes de procurar partida.';
    $custo = custoDoTime($t, $cartas);
    if ($cobraSalario && $t['caixa'] < $custo) return 'Sem caixa para o salário da partida (' . $custo . ' mil). Jogue desafios de treino ou escale jogadores mais baratos.';
    return null;
}

/** Procura adversário com MMR próximo; a janela abre 20 pontos por segundo de espera. */
function tentarParear(int $uid): ?int
{
    $pdo = db();
    $pdo->query("SELECT GET_LOCK('fantasy_fila', 5)");
    try {
        $s = $pdo->prepare('SELECT mmr, TIMESTAMPDIFF(SECOND, entrou_em, NOW(3)) AS espera FROM fila WHERE usuario_id = ?');
        $s->execute([$uid]);
        $eu = $s->fetch();
        if (!$eu) return null;
        $s = $pdo->prepare('SELECT usuario_id, mmr, TIMESTAMPDIFF(SECOND, entrou_em, NOW(3)) AS espera FROM fila
            WHERE usuario_id <> ? AND visto_em > NOW(3) - INTERVAL ' . FILA_INATIVA . ' SECOND
            ORDER BY ABS(mmr - ?) LIMIT 20');
        $s->execute([$uid, $eu['mmr']]);
        // Contas do mesmo aparelho não se enfrentam no ranqueado.
        $adv = null;
        foreach ($s->fetchAll() as $c) {
            if (!contasLigadas($uid, (int) $c['usuario_id'])) {
                $adv = $c;
                break;
            }
        }
        if (!$adv) return null;
        $janela = 100 + 20 * max((int) $eu['espera'], (int) $adv['espera']);
        if (abs((int) $adv['mmr'] - (int) $eu['mmr']) > $janela) return null;
        $outro = (int) $adv['usuario_id'];
        $tira = $pdo->prepare('DELETE FROM fila WHERE usuario_id = ?');
        if (impedimento($outro)) {
            $tira->execute([$outro]);
            return null;
        }
        if (impedimento($uid)) {
            $tira->execute([$uid]);
            return null;
        }
        $id = criarPartida($uid, $outro, 'ranqueado');
        $tira->execute([$uid]);
        $tira->execute([$outro]);
        return $id;
    } finally {
        $pdo->query("SELECT RELEASE_LOCK('fantasy_fila')");
    }
}

/** Cobra o salário dos dois (no ranqueado), sorteia o mando e cria a partida (começa em ESPERA_INICIO segundos). */
function criarPartida(int $uid, int $outro, string $tipo): int
{
    $pdo = db();
    [$m, $v] = random_int(0, 1) ? [$uid, $outro] : [$outro, $uid];
    $pdo->beginTransaction();
    $custos = [];
    foreach ([$m, $v] as $x) {
        $t = timeOnline($x, true);
        // Amistoso é só pela diversão: não cobra salário.
        $custos[] = $tipo === 'amistoso' ? 0 : custoDoTime($t, cartasDoUsuario($x));
        $pdo->prepare('UPDATE times_online SET caixa = caixa - ? WHERE usuario_id = ?')->execute([end($custos), $x]);
        perfilRanqueado($x);
    }
    $pdo->prepare('INSERT INTO partidas_online (temporada, tipo, mandante_id, visitante_id, seed, time_mandante, time_visitante,
        custo_mandante, custo_visitante, inicio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3) + INTERVAL ' . ESPERA_INICIO . ' SECOND)')
        ->execute([temporadaAtual(), $tipo, $m, $v, random_int(0, 2 ** 31 - 1),
            json_encode(timeDaPartida($m, nomeDe($m)), JSON_UNESCAPED_UNICODE),
            json_encode(timeDaPartida($v, nomeDe($v)), JSON_UNESCAPED_UNICODE), $custos[0], $custos[1]]);
    $id = (int) $pdo->lastInsertId();
    $pdo->commit();
    return $id;
}

/** Convites de amistoso pendentes (dos últimos 5 minutos), recebidos e enviados. */
function convites(int $uid): array
{
    $s = db()->prepare("SELECT c.id, c.de_id, c.para_id, ud.nome AS de, up.nome AS para FROM convites c
        JOIN usuarios ud ON ud.id = c.de_id JOIN usuarios up ON up.id = c.para_id
        WHERE c.status = 'pendente' AND c.criado_em > NOW() - INTERVAL 5 MINUTE AND (c.de_id = ? OR c.para_id = ?) ORDER BY c.id DESC");
    $s->execute([$uid, $uid]);
    $r = ['recebidos' => [], 'enviados' => []];
    foreach ($s->fetchAll() as $c) {
        $info = ['id' => (int) $c['id']];
        if ((int) $c['para_id'] === $uid) $r['recebidos'][] = $info + ['nome' => $c['de']];
        else $r['enviados'][] = $info + ['nome' => $c['para']];
    }
    return $r;
}

function estado(int $uid, ?int $partidaId): array
{
    $pdo = db();
    $p = null;
    if ($partidaId) {
        $p = partidaPorId($partidaId);
        if ($p && (int) $p['mandante_id'] !== $uid && (int) $p['visitante_id'] !== $uid) $p = null;
    }
    $p ??= partidaAoVivoDe($uid);
    $naFila = false;
    $espera = 0;
    if (!$p) {
        $pdo->prepare('UPDATE fila SET visto_em = NOW(3) WHERE usuario_id = ?')->execute([$uid]);
        $id = tentarParear($uid);
        if ($id) $p = partidaPorId($id);
        else {
            $s = $pdo->prepare('SELECT TIMESTAMPDIFF(SECOND, entrou_em, NOW(3)) FROM fila WHERE usuario_id = ?');
            $s->execute([$uid]);
            $e = $s->fetchColumn();
            $naFila = $e !== false;
            $espera = (int) $e;
        }
    }
    if ($p) $p = finalizarSePreciso($p);
    $t = timeOnline($uid);
    return [
        'fila' => $naFila,
        'espera' => $espera,
        'partida' => $p ? payloadPartida($p, $uid) : null,
        'perfil' => perfilPublico(perfilRanqueado($uid)),
        'caixa' => $t['caixa'],
        'impedimento' => $p || $naFila ? null : impedimento($uid),
        'convites' => convites($uid),
        'ultimaTemporada' => ultimaTemporada($uid),
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $acao = $_GET['acao'] ?? 'estado';
    if ($acao === 'estado') responder(estado($eu, isset($_GET['partida']) ? (int) $_GET['partida'] : null));
    if ($acao === 'ranking') {
        $temp = temporadaAtual();
        $meu = perfilRanqueado($eu);
        $s = $pdo->prepare('SELECT r.*, u.nome FROM ranqueado r JOIN usuarios u ON u.id = r.usuario_id
            WHERE r.temporada = ? AND (r.vitorias + r.empates + r.derrotas) > 0 ORDER BY r.tier DESC, r.pdl DESC, r.mmr DESC LIMIT 100');
        $s->execute([$temp]);
        $top = array_map(fn($r) => ['nome' => $r['nome'], 'eu' => (int) $r['usuario_id'] === $eu] + perfilPublico($r), $s->fetchAll());
        $s = $pdo->prepare('SELECT COUNT(*) + 1 FROM ranqueado WHERE temporada = ? AND (vitorias + empates + derrotas) > 0
            AND (tier > ? OR (tier = ? AND pdl > ?))');
        $s->execute([$temp, $meu['tier'], $meu['tier'], $meu['pdl']]);
        $s2 = $pdo->prepare("SELECT p.*, um.nome AS nome_m, uv.nome AS nome_v FROM partidas_online p
            JOIN usuarios um ON um.id = p.mandante_id JOIN usuarios uv ON uv.id = p.visitante_id
            WHERE (p.mandante_id = ? OR p.visitante_id = ?) AND p.status <> 'ao_vivo' ORDER BY p.id DESC LIMIT 10");
        $s2->execute([$eu, $eu]);
        $hist = array_map(function ($p) use ($eu) {
            $m = (int) $p['mandante_id'] === $eu;
            return [
                'id' => (int) $p['id'],
                'adversario' => $m ? $p['nome_v'] : $p['nome_m'],
                'status' => $p['status'],
                'tipo' => $p['tipo'],
                'meus' => $p['gols_mandante'] === null ? null : (int) ($m ? $p['gols_mandante'] : $p['gols_visitante']),
                'deles' => $p['gols_mandante'] === null ? null : (int) ($m ? $p['gols_visitante'] : $p['gols_mandante']),
                'pdl' => $p['pdl_mandante'] === null ? null : (int) ($m ? $p['pdl_mandante'] : $p['pdl_visitante']),
            ];
        }, $s2->fetchAll());
        responder(['temporada' => $temp, 'top' => $top, 'minhaPosicao' => (int) $s->fetchColumn(),
            'perfil' => perfilPublico($meu), 'historico' => $hist]);
    }
    erro('Ação desconhecida.', 400);
}

$d = corpoJson();
switch ((string) ($d['acao'] ?? '')) {
    case 'entrar_fila':
        if (partidaAoVivoDe($eu)) erro('Você já está numa partida.');
        if ($motivo = impedimento($eu)) erro($motivo);
        $mmr = (int) perfilRanqueado($eu)['mmr'];
        $pdo->prepare('INSERT INTO fila (usuario_id, mmr, entrou_em, visto_em) VALUES (?, ?, NOW(3), NOW(3))
            ON DUPLICATE KEY UPDATE visto_em = NOW(3)')->execute([$eu, $mmr]);
        responder(estado($eu, null));

    case 'sair_fila':
        $pdo->prepare('DELETE FROM fila WHERE usuario_id = ?')->execute([$eu]);
        responder(estado($eu, null));

    case 'decidir':
        $p = partidaPorId((int) ($d['partida_id'] ?? 0));
        if (!$p || $p['status'] !== 'ao_vivo' || ((int) $p['mandante_id'] !== $eu && (int) $p['visitante_id'] !== $eu)) {
            erro('Partida não encontrada.', 404);
        }
        $minuto = max(0, minutoDoServidor($p) + 1);
        if ($minuto > 89) erro('O jogo está acabando: não dá mais para mexer.');
        $x = (array) ($d['decisao'] ?? []);
        if (($x['tipo'] ?? '') === 'tatica' && in_array($x['tatica'] ?? '', ['defensiva', 'equilibrada', 'ofensiva'], true)) {
            $dados = ['tipo' => 'tatica', 'tatica' => $x['tatica']];
        } elseif (($x['tipo'] ?? '') === 'sub' && is_string($x['sai'] ?? null) && is_string($x['entra'] ?? null)) {
            $s = $pdo->prepare("SELECT COUNT(*) FROM decisoes_online WHERE partida_id = ? AND usuario_id = ? AND dados LIKE '%\"sub\"%'");
            $s->execute([$p['id'], $eu]);
            if ((int) $s->fetchColumn() >= 5) erro('Você já fez as 5 substituições.');
            $dados = ['tipo' => 'sub', 'sai' => $x['sai'], 'entra' => $x['entra']];
        } else erro('Decisão inválida.');
        $pdo->prepare('INSERT INTO decisoes_online (partida_id, usuario_id, minuto, dados) VALUES (?, ?, ?, ?)')
            ->execute([$p['id'], $eu, $minuto, json_encode($dados)]);
        responder(estado($eu, (int) $p['id']));

    case 'relatar':
        $p = partidaPorId((int) ($d['partida_id'] ?? 0));
        if (!$p || ((int) $p['mandante_id'] !== $eu && (int) $p['visitante_id'] !== $eu)) erro('Partida não encontrada.', 404);
        $gols = (array) ($d['gols'] ?? []);
        if (count($gols) !== 2 || !is_int($gols[0]) || !is_int($gols[1]) || min($gols) < 0 || max($gols) > 30) erro('Placar inválido.');
        if ($p['status'] === 'ao_vivo' && minutoDoServidor($p) >= 90) {
            $col = (int) $p['mandante_id'] === $eu ? 'relato_mandante' : 'relato_visitante';
            $pdo->prepare("UPDATE partidas_online SET $col = ? WHERE id = ? AND $col IS NULL")->execute(["$gols[0]-$gols[1]", $p['id']]);
        }
        responder(estado($eu, (int) $p['id']));

    case 'convidar':
        $s = $pdo->prepare('SELECT id FROM usuarios WHERE nome = ?');
        $s->execute([trim((string) ($d['nome'] ?? ''))]);
        $para = (int) ($s->fetchColumn() ?: erro('Não achei um técnico com esse nome.', 404));
        if ($para === $eu) erro('Convide outro técnico.');
        if ($motivo = impedimento($eu, false)) erro($motivo);
        $pdo->prepare("UPDATE convites SET status = 'cancelado' WHERE de_id = ? AND para_id = ? AND status = 'pendente'")
            ->execute([$eu, $para]);
        $pdo->prepare('INSERT INTO convites (de_id, para_id) VALUES (?, ?)')->execute([$eu, $para]);
        responder(estado($eu, null));

    case 'cancelar_convite':
        $pdo->prepare("UPDATE convites SET status = 'cancelado' WHERE id = ? AND de_id = ? AND status = 'pendente'")
            ->execute([(int) ($d['convite_id'] ?? 0), $eu]);
        responder(estado($eu, null));

    case 'responder_convite':
        $pdo->query("SELECT GET_LOCK('fantasy_fila', 5)");
        try {
            $s = $pdo->prepare("SELECT * FROM convites WHERE id = ? AND para_id = ? AND status = 'pendente'
                AND criado_em > NOW() - INTERVAL 5 MINUTE");
            $s->execute([(int) ($d['convite_id'] ?? 0), $eu]);
            $c = $s->fetch() ?: erro('Esse convite não vale mais.', 404);
            if (empty($d['aceitar'])) {
                $pdo->prepare("UPDATE convites SET status = 'recusado' WHERE id = ?")->execute([$c['id']]);
                responder(estado($eu, null));
            }
            $de = (int) $c['de_id'];
            if (partidaAoVivoDe($eu) || partidaAoVivoDe($de)) erro('Um de vocês já está numa partida.');
            if ($motivo = impedimento($eu, false)) erro($motivo);
            if (impedimento($de, false)) erro(nomeDe($de) . ' não pode jogar agora: falta escalar 11 titulares.');
            $id = criarPartida($eu, $de, 'amistoso');
            $pdo->prepare("UPDATE convites SET status = 'aceito', partida_id = ? WHERE id = ?")->execute([$id, $c['id']]);
            $pdo->prepare('DELETE FROM fila WHERE usuario_id IN (?, ?)')->execute([$eu, $de]);
        } finally {
            $pdo->query("SELECT RELEASE_LOCK('fantasy_fila')");
        }
        responder(estado($eu, $id));

    default:
        erro('Ação desconhecida.', 400);
}
