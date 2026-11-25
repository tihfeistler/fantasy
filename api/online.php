<?php
// Time de cartas do modo online. Exige login (api/auth.php).
//
// GET  api/online.php                          -> usuário, moedas, time (caixa e escalação), cartas, perfil ranqueado
// POST api/online.php {acao:"escalar", formacao, titulares:[ids], banco:[ids]}
// POST api/online.php {acao:"comprar_base", jogador_id}   carta base (jogador atual) do sistema, com moedas
// POST api/online.php {acao:"vender_base", jogador_id}    devolve a carta base ao sistema por 40% do preço
// POST api/online.php {acao:"abrir_pacote"}               500 moedas, 5 lendas (70% comum, 25% rara, 5% ícone)
//
// Na primeira consulta o servidor cria o time com R$ 2 mi de caixa e um kit de 16 cartas base fracas.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/online_lib.php';
iniciarApi();
$eu = exigirUsuario();
$pdo = db();

function situacao(int $uid): array
{
    $s = db()->prepare('SELECT id, nome, moedas FROM usuarios WHERE id = ?');
    $s->execute([$uid]);
    $u = $s->fetch();
    $time = timeOnline($uid);
    $cartas = cartasDoUsuario($uid);
    return [
        'usuario' => ['id' => (int) $u['id'], 'nome' => $u['nome'], 'timeId' => "u$uid"],
        'moedas' => (int) $u['moedas'],
        'time' => $time + ['custo' => custoDoTime($time, $cartas)],
        'cartas' => array_values($cartas),
        'ranqueado' => perfilPublico(perfilRanqueado($uid)),
        'ultimaTemporada' => ultimaTemporada($uid),
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') responder(situacao($eu));

$d = corpoJson();
switch ((string) ($d['acao'] ?? '')) {
    case 'escalar':
        $formacao = (string) ($d['formacao'] ?? '');
        if (!isset(FORMACOES[$formacao])) erro('Formação inválida.');
        $titulares = array_values(array_unique(array_map('strval', (array) ($d['titulares'] ?? []))));
        $banco = array_values(array_unique(array_map('strval', (array) ($d['banco'] ?? []))));
        $cartas = cartasDoUsuario($eu);
        foreach ([...$titulares, ...$banco] as $id) if (!isset($cartas[$id])) erro("Você não tem a carta '$id'.");
        if (count($titulares) > 11) erro('No máximo 11 titulares.');
        if (count($banco) > VAGAS_BANCO) erro('O banco tem ' . VAGAS_BANCO . ' vagas.');
        if (array_intersect($titulares, $banco)) erro('Um jogador não pode ser titular e reserva ao mesmo tempo.');
        $lendas = count(array_filter($titulares, fn($id) => $cartas[$id]['tipo'] === 'classico'));
        if ($lendas > MAX_LENDAS_EM_CAMPO) erro('No máximo ' . MAX_LENDAS_EM_CAMPO . ' lendas em campo.');
        timeOnline($eu);
        $pdo->prepare('UPDATE times_online SET formacao = ?, titulares = ?, banco = ? WHERE usuario_id = ?')
            ->execute([$formacao, json_encode($titulares), json_encode($banco), $eu]);
        responder(situacao($eu));

    case 'comprar_base':
        $jid = (string) ($d['jogador_id'] ?? '');
        $pdo->beginTransaction();
        $s = $pdo->prepare("SELECT geral FROM jogadores WHERE id = ? AND tipo = 'atual'");
        $s->execute([$jid]);
        $geral = $s->fetchColumn();
        if ($geral === false) erro('Só jogadores atuais têm carta base à venda.', 404);
        $s = $pdo->prepare('SELECT 1 FROM cartas WHERE usuario_id = ? AND jogador_id = ?');
        $s->execute([$eu, $jid]);
        if ($s->fetch()) erro('Você já tem essa carta.');
        $preco = precoCartaBase((int) $geral);
        $s = $pdo->prepare('SELECT moedas FROM usuarios WHERE id = ? FOR UPDATE');
        $s->execute([$eu]);
        if ((int) $s->fetchColumn() < $preco) erro('Moedas insuficientes.');
        $pdo->prepare('UPDATE usuarios SET moedas = moedas - ? WHERE id = ?')->execute([$preco, $eu]);
        $pdo->prepare("INSERT INTO cartas (usuario_id, jogador_id, origem) VALUES (?, ?, 'sistema')")->execute([$eu, $jid]);
        $pdo->commit();
        responder(situacao($eu));

    case 'vender_base':
        $jid = (string) ($d['jogador_id'] ?? '');
        $pdo->beginTransaction();
        $s = $pdo->prepare("SELECT c.id, j.geral FROM cartas c JOIN jogadores j ON j.id = c.jogador_id
            WHERE c.usuario_id = ? AND c.jogador_id = ? AND j.tipo = 'atual' LIMIT 1 FOR UPDATE");
        $s->execute([$eu, $jid]);
        $c = $s->fetch() ?: erro('Você não tem essa carta base.', 404);
        $valor = vendaCartaBase((int) $c['geral']);
        $pdo->prepare('DELETE FROM cartas WHERE id = ?')->execute([$c['id']]);
        $pdo->prepare('UPDATE usuarios SET moedas = moedas + ? WHERE id = ?')->execute([$valor, $eu]);
        $pdo->prepare('INSERT INTO vendas (jogador_id, vendedor_id, valor) VALUES (?, ?, ?)')->execute([$jid, $eu, $valor]);
        tirarDaEscalacaoSeAcabou($eu, $jid);
        $pdo->commit();
        responder(situacao($eu));

    case 'abrir_pacote':
        $pdo->beginTransaction();
        $s = $pdo->prepare('SELECT moedas FROM usuarios WHERE id = ? FOR UPDATE');
        $s->execute([$eu]);
        if ((int) $s->fetchColumn() < PRECO_PACOTE) erro('Moedas insuficientes.');
        $pdo->prepare('UPDATE usuarios SET moedas = moedas - ? WHERE id = ?')->execute([PRECO_PACOTE, $eu]);
        $faixas = ['icone' => 'geral >= 88', 'rara' => 'geral >= 80 AND geral < 88', 'comum' => 'geral < 80'];
        $ins = $pdo->prepare("INSERT INTO cartas (usuario_id, jogador_id, origem) VALUES (?, ?, 'pacote')");
        $novas = [];
        for ($i = 0; $i < CARTAS_POR_PACOTE; $i++) {
            $r = mt_rand() / mt_getrandmax();
            $ordem = $r < 0.05 ? ['icone', 'rara', 'comum'] : ($r < 0.30 ? ['rara', 'comum', 'icone'] : ['comum', 'rara', 'icone']);
            foreach ($ordem as $f) {
                $q = $pdo->query("SELECT * FROM jogadores WHERE tipo = 'classico' AND {$faixas[$f]} ORDER BY RAND() LIMIT 1");
                if ($linha = $q->fetch()) {
                    $ins->execute([$eu, $linha['id']]);
                    $novas[] = linhaParaJogador($linha);
                    break;
                }
            }
        }
        $pdo->commit();
        responder(situacao($eu) + ['novas' => $novas]);

    default:
        erro('Ação desconhecida.', 400);
}
