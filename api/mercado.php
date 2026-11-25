<?php
// Mercado de cartas entre técnicos (modo online). Exige login (api/auth.php).
//
// GET  api/mercado.php?acao=anuncios[&busca=&posicao=&faixa=&ordem=preco|geral|recentes]
// GET  api/mercado.php?acao=minhas          -> minhas cartas, meus anúncios, propostas recebidas e enviadas
// POST api/mercado.php {acao:"anunciar", carta_id, preco}
// POST api/mercado.php {acao:"cancelar_anuncio", anuncio_id}
// POST api/mercado.php {acao:"comprar", anuncio_id}              compra pelo preço anunciado
// POST api/mercado.php {acao:"propor", carta_id, valor}           proposta por qualquer carta de outro técnico
// POST api/mercado.php {acao:"aceitar"|"recusar", proposta_id}    pelo dono da carta
// POST api/mercado.php {acao:"contrapropor", proposta_id, valor}   pelo dono: pede um valor maior
// POST api/mercado.php {acao:"aceitar_contra"|"recusar_contra", proposta_id}  pelo comprador
// POST api/mercado.php {acao:"cancelar_proposta", proposta_id}    pelo comprador
// POST api/mercado.php {acao:"vender_sistema", carta_id}          preço básico (valorDeVenda)
//
// Venda entre técnicos: o comprador paga o valor; o vendedor recebe o valor menos 5% de taxa.
// As moedas só são debitadas quando a venda acontece; uma proposta não reserva moedas.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/online_lib.php';
iniciarApi();
$eu = exigirUsuario();
$pdo = db();

/** Carta com dados do jogador, travada para a transação. */
function cartaTravada(int $cartaId): array
{
    $s = db()->prepare('SELECT c.id, c.usuario_id, c.jogador_id, j.geral, j.tipo FROM cartas c
        JOIN jogadores j ON j.id = c.jogador_id WHERE c.id = ? FOR UPDATE');
    $s->execute([$cartaId]);
    $c = $s->fetch() ?: erro('Carta não encontrada.', 404);
    // Regra do mercado: cartas base (atuais) vêm do sistema e voltam para ele; só lendas circulam entre técnicos.
    if ($c['tipo'] !== 'classico') erro('Cartas base não são negociadas entre técnicos. Venda ao sistema na aba Cartas.');
    return $c;
}

function moedasTravadas(int $usuarioId): int
{
    $s = db()->prepare('SELECT moedas FROM usuarios WHERE id = ? FOR UPDATE');
    $s->execute([$usuarioId]);
    return (int) $s->fetchColumn();
}

/** Passa a carta para o comprador e acerta moedas, anúncio e propostas. */
function transferir(array $carta, int $compradorId, int $valor): array
{
    $pdo = db();
    $vendedor = (int) $carta['usuario_id'];
    if ($compradorId === $vendedor) erro('Você não pode comprar a própria carta.');
    if (moedasTravadas($compradorId) < $valor) erro('Moedas insuficientes.');
    moedasTravadas($vendedor);
    $taxa = (int) ceil($valor * TAXA_MERCADO);
    $pdo->prepare('UPDATE usuarios SET moedas = moedas - ? WHERE id = ?')->execute([$valor, $compradorId]);
    $pdo->prepare('UPDATE usuarios SET moedas = moedas + ? WHERE id = ?')->execute([$valor - $taxa, $vendedor]);
    $pdo->prepare("UPDATE cartas SET usuario_id = ?, origem = 'mercado', obtida_em = NOW() WHERE id = ?")
        ->execute([$compradorId, $carta['id']]);
    $pdo->prepare('DELETE FROM anuncios WHERE carta_id = ?')->execute([$carta['id']]);
    // Outras propostas pela carta deixam de valer: ela mudou de dono.
    $pdo->prepare("UPDATE propostas SET status = 'expirada', respondida_em = NOW()
        WHERE carta_id = ? AND status IN ('aberta', 'contraproposta')")
        ->execute([$carta['id']]);
    $pdo->prepare('INSERT INTO vendas (jogador_id, vendedor_id, comprador_id, valor, taxa) VALUES (?, ?, ?, ?, ?)')
        ->execute([$carta['jogador_id'], $vendedor, $compradorId, $valor, $taxa]);
    tirarDaEscalacaoSeAcabou($vendedor, $carta['jogador_id']);
    return ['carta_id' => (int) $carta['id'], 'valor' => $valor, 'taxa' => $taxa];
}

function validarPreco(mixed $v): int
{
    $n = filter_var($v, FILTER_VALIDATE_INT);
    if ($n === false || $n < PRECO_MINIMO || $n > PRECO_MAXIMO) {
        erro('Valor deve ser um número inteiro de ' . PRECO_MINIMO . ' a ' . PRECO_MAXIMO . ' moedas.');
    }
    return $n;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $acao = (string) ($_GET['acao'] ?? 'anuncios');
    if ($acao === 'anuncios') {
        $where = ['a.vendedor_id <> ?'];
        $params = [$eu];
        if (!empty($_GET['busca'])) {
            $where[] = 'j.nome LIKE ?';
            $params[] = '%' . (string) $_GET['busca'] . '%';
        }
        if (!empty($_GET['posicao'])) {
            $where[] = 'j.posicao = ?';
            $params[] = (string) $_GET['posicao'];
        }
        $faixas = ['comum' => 'j.geral < 80', 'rara' => 'j.geral BETWEEN 80 AND 87', 'icone' => 'j.geral >= 88'];
        if (isset($faixas[$_GET['faixa'] ?? ''])) $where[] = $faixas[$_GET['faixa']];
        $ordem = ['preco' => 'a.preco ASC', 'geral' => 'j.geral DESC', 'recentes' => 'a.criado_em DESC'][$_GET['ordem'] ?? 'preco'] ?? 'a.preco ASC';
        $s = $pdo->prepare('SELECT a.id AS anuncio_id, a.carta_id, a.preco, a.criado_em, u.nome AS vendedor, j.*
            FROM anuncios a JOIN cartas c ON c.id = a.carta_id JOIN jogadores j ON j.id = c.jogador_id
            JOIN usuarios u ON u.id = a.vendedor_id WHERE ' . implode(' AND ', $where) . " ORDER BY $ordem LIMIT 200");
        $s->execute($params);
        responder(array_map(fn($r) => [
            'anuncio_id' => (int) $r['anuncio_id'],
            'carta_id' => (int) $r['carta_id'],
            'preco' => (int) $r['preco'],
            'vendedor' => $r['vendedor'],
            'criado_em' => $r['criado_em'],
            'jogador' => linhaParaJogador($r),
        ], $s->fetchAll()));
    }
    if ($acao === 'minhas') {
        // Só lendas: cartas base não circulam entre técnicos.
        $s = $pdo->prepare("SELECT c.id AS carta_id, a.id AS anuncio_id, a.preco,
            (SELECT COUNT(*) FROM cartas c2 WHERE c2.usuario_id = c.usuario_id AND c2.jogador_id = c.jogador_id) AS copias, j.*
            FROM cartas c JOIN jogadores j ON j.id = c.jogador_id LEFT JOIN anuncios a ON a.carta_id = c.id
            WHERE c.usuario_id = ? AND j.tipo = 'classico' ORDER BY j.geral DESC, c.id");
        $s->execute([$eu]);
        $cartas = array_map(fn($r) => [
            'carta_id' => (int) $r['carta_id'],
            'anuncio_id' => $r['anuncio_id'] === null ? null : (int) $r['anuncio_id'],
            'preco' => $r['preco'] === null ? null : (int) $r['preco'],
            'venda_sistema' => valorDeVenda((int) $r['geral'], (int) $r['copias']),
            'jogador' => linhaParaJogador($r),
        ], $s->fetchAll());
        $prop = fn($r) => [
            'id' => (int) $r['proposta_id'],
            'carta_id' => (int) $r['carta_id'],
            'valor' => (int) $r['valor'],
            'contra_valor' => $r['contra_valor'] === null ? null : (int) $r['contra_valor'],
            'status' => $r['status'],
            'outro' => $r['outro'],
            'jogador' => linhaParaJogador($r),
        ];
        $s = $pdo->prepare("SELECT p.id AS proposta_id, p.carta_id, p.valor, p.contra_valor, p.status, u.nome AS outro, j.*
            FROM propostas p JOIN cartas c ON c.id = p.carta_id JOIN jogadores j ON j.id = c.jogador_id
            JOIN usuarios u ON u.id = p.comprador_id
            WHERE c.usuario_id = ? AND p.status IN ('aberta', 'contraproposta') ORDER BY p.criado_em DESC");
        $s->execute([$eu]);
        $recebidas = array_map($prop, $s->fetchAll());
        $s = $pdo->prepare('SELECT p.id AS proposta_id, p.carta_id, p.valor, p.contra_valor, p.status, u.nome AS outro, j.*
            FROM propostas p JOIN cartas c ON c.id = p.carta_id JOIN jogadores j ON j.id = c.jogador_id
            JOIN usuarios u ON u.id = c.usuario_id WHERE p.comprador_id = ? ORDER BY p.criado_em DESC LIMIT 30');
        $s->execute([$eu]);
        $m = $pdo->prepare('SELECT moedas FROM usuarios WHERE id = ?');
        $m->execute([$eu]);
        responder(['moedas' => (int) $m->fetchColumn(), 'cartas' => $cartas, 'recebidas' => $recebidas,
            'enviadas' => array_map($prop, $s->fetchAll())]);
    }
    erro('Ação desconhecida.', 400);
}

$d = corpoJson();
$acao = (string) ($d['acao'] ?? '');
$pdo->beginTransaction();

switch ($acao) {
    case 'anunciar':
        $carta = cartaTravada((int) ($d['carta_id'] ?? 0));
        if ((int) $carta['usuario_id'] !== $eu) erro('Essa carta não é sua.', 403);
        $preco = validarPreco($d['preco'] ?? null);
        $pdo->prepare('INSERT INTO anuncios (carta_id, vendedor_id, preco) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE preco = VALUES(preco), criado_em = NOW()')->execute([$carta['id'], $eu, $preco]);
        $pdo->commit();
        responder(['ok' => true, 'carta_id' => (int) $carta['id'], 'preco' => $preco], 201);

    case 'cancelar_anuncio':
        $s = $pdo->prepare('DELETE FROM anuncios WHERE id = ? AND vendedor_id = ?');
        $s->execute([(int) ($d['anuncio_id'] ?? 0), $eu]);
        if (!$s->rowCount()) erro('Anúncio não encontrado.', 404);
        $pdo->commit();
        responder(['ok' => true]);

    case 'comprar':
        $s = $pdo->prepare('SELECT carta_id, preco FROM anuncios WHERE id = ? FOR UPDATE');
        $s->execute([(int) ($d['anuncio_id'] ?? 0)]);
        $a = $s->fetch() ?: erro('Esse anúncio não existe mais.', 404);
        $r = transferir(cartaTravada((int) $a['carta_id']), $eu, (int) $a['preco']);
        $pdo->commit();
        responder($r);

    case 'propor':
        $carta = cartaTravada((int) ($d['carta_id'] ?? 0));
        if ((int) $carta['usuario_id'] === $eu) erro('Essa carta já é sua.');
        $valor = validarPreco($d['valor'] ?? null);
        if (moedasTravadas($eu) < $valor) erro('Moedas insuficientes para essa proposta.');
        // Uma proposta aberta por carta e comprador: a nova substitui a antiga.
        $pdo->prepare("UPDATE propostas SET status = 'cancelada', respondida_em = NOW()
            WHERE carta_id = ? AND comprador_id = ? AND status IN ('aberta', 'contraproposta')")->execute([$carta['id'], $eu]);
        $pdo->prepare('INSERT INTO propostas (carta_id, comprador_id, valor) VALUES (?, ?, ?)')
            ->execute([$carta['id'], $eu, $valor]);
        $id = (int) $pdo->lastInsertId();
        $pdo->commit();
        responder(['ok' => true, 'proposta_id' => $id], 201);

    case 'aceitar':
    case 'recusar':
        $s = $pdo->prepare("SELECT id, carta_id, comprador_id, valor FROM propostas WHERE id = ? AND status = 'aberta' FOR UPDATE");
        $s->execute([(int) ($d['proposta_id'] ?? 0)]);
        $p = $s->fetch() ?: erro('Proposta não encontrada ou já respondida.', 404);
        $carta = cartaTravada((int) $p['carta_id']);
        if ((int) $carta['usuario_id'] !== $eu) erro('Essa carta não é sua.', 403);
        $pdo->prepare('UPDATE propostas SET status = ?, respondida_em = NOW() WHERE id = ?')
            ->execute([$acao === 'aceitar' ? 'aceita' : 'recusada', $p['id']]);
        $r = $acao === 'aceitar' ? transferir($carta, (int) $p['comprador_id'], (int) $p['valor']) : ['ok' => true];
        $pdo->commit();
        responder($r);

    case 'contrapropor':
        $s = $pdo->prepare("SELECT id, carta_id, valor FROM propostas WHERE id = ? AND status = 'aberta' FOR UPDATE");
        $s->execute([(int) ($d['proposta_id'] ?? 0)]);
        $p = $s->fetch() ?: erro('Proposta não encontrada ou já respondida.', 404);
        $carta = cartaTravada((int) $p['carta_id']);
        if ((int) $carta['usuario_id'] !== $eu) erro('Essa carta não é sua.', 403);
        $valor = validarPreco($d['valor'] ?? null);
        if ($valor <= (int) $p['valor']) erro('A contraproposta precisa ser maior que a proposta.');
        $pdo->prepare("UPDATE propostas SET status = 'contraproposta', contra_valor = ?, respondida_em = NOW() WHERE id = ?")
            ->execute([$valor, $p['id']]);
        $pdo->commit();
        responder(['ok' => true, 'contra_valor' => $valor]);

    case 'aceitar_contra':
    case 'recusar_contra':
        $s = $pdo->prepare("SELECT id, carta_id, comprador_id, contra_valor FROM propostas
            WHERE id = ? AND status = 'contraproposta' FOR UPDATE");
        $s->execute([(int) ($d['proposta_id'] ?? 0)]);
        $p = $s->fetch() ?: erro('Contraproposta não encontrada ou já respondida.', 404);
        if ((int) $p['comprador_id'] !== $eu) erro('Essa proposta não é sua.', 403);
        $pdo->prepare('UPDATE propostas SET status = ?, respondida_em = NOW() WHERE id = ?')
            ->execute([$acao === 'aceitar_contra' ? 'aceita' : 'recusada', $p['id']]);
        $r = $acao === 'aceitar_contra'
            ? transferir(cartaTravada((int) $p['carta_id']), $eu, (int) $p['contra_valor'])
            : ['ok' => true];
        $pdo->commit();
        responder($r);

    case 'cancelar_proposta':
        $s = $pdo->prepare("UPDATE propostas SET status = 'cancelada', respondida_em = NOW()
            WHERE id = ? AND comprador_id = ? AND status IN ('aberta', 'contraproposta')");
        $s->execute([(int) ($d['proposta_id'] ?? 0), $eu]);
        if (!$s->rowCount()) erro('Proposta não encontrada ou já respondida.', 404);
        $pdo->commit();
        responder(['ok' => true]);

    case 'vender_sistema':
        $carta = cartaTravada((int) ($d['carta_id'] ?? 0));
        if ((int) $carta['usuario_id'] !== $eu) erro('Essa carta não é sua.', 403);
        $s = $pdo->prepare('SELECT COUNT(*) FROM cartas WHERE usuario_id = ? AND jogador_id = ?');
        $s->execute([$eu, $carta['jogador_id']]);
        $valor = valorDeVenda((int) $carta['geral'], (int) $s->fetchColumn());
        $pdo->prepare('DELETE FROM cartas WHERE id = ?')->execute([$carta['id']]);
        $pdo->prepare('UPDATE usuarios SET moedas = moedas + ? WHERE id = ?')->execute([$valor, $eu]);
        $pdo->prepare('INSERT INTO vendas (jogador_id, vendedor_id, comprador_id, valor) VALUES (?, ?, NULL, ?)')
            ->execute([$carta['jogador_id'], $eu, $valor]);
        tirarDaEscalacaoSeAcabou($eu, $carta['jogador_id']);
        $pdo->commit();
        responder(['ok' => true, 'valor' => $valor]);

    default:
        erro('Ação desconhecida.', 400);
}
