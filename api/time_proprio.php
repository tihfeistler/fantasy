<?php
// Draft do elenco do time próprio (escolhido no cadastro). Exige login.
//
// GET  api/time_proprio.php                                   -> estado do time próprio (ou null)
// POST api/time_proprio.php {acao:"sortear", funcao, nacionalidade}
//      Sorteia 5 opções para a próxima escolha. Enquanto houver opções na mesa, não dá para
//      sortear de novo: é preciso ficar com uma delas.
// POST api/time_proprio.php {acao:"escolher", jogador}         fica com uma das opções.
// Depois das 30 escolhas, api/carreira.php cria a carreira com esse elenco.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/time_proprio_lib.php';
iniciarApi();
$eu = exigirUsuario();
$pdo = db();

function estado(int $uid): never
{
    $t = timeProprio($uid);
    responder($t ? clubeProprioPublico($t) + ['escolhas' => $t['escolhas'], 'opcoes' => $t['opcoes']] : null);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') estado($eu);

$d = corpoJson();
$pdo->beginTransaction();
$t = timeProprio($eu, true);
if (!$t) erro('Esta conta não tem time próprio.', 404);
$n = count($t['escolhas']);
if ($n >= TOTAL_DRAFT) erro('O elenco já está completo.', 409);

switch ((string) ($d['acao'] ?? '')) {
    case 'sortear': {
        if ($t['opcoes'] !== null) erro('Escolha um dos jogadores sorteados antes de sortear de novo.', 409);
        $funcao = (string) ($d['funcao'] ?? '');
        if (!in_array($funcao, funcoesDaEscolha($n), true)) erro('Função inválida para esta escolha.');
        $nac = (string) ($d['nacionalidade'] ?? '');
        if (!preg_match('/^[A-Z]{3}$/', $nac)) erro('Escolha a nacionalidade.');
        $ids = sortearOpcoesDraft($funcao, $nac, idsEscolhidos($t));
        if (!$ids) erro('Não há jogadores dessa nacionalidade nessa posição. Escolha outra.');
        $opcoes = ['funcao' => $funcao, 'nacionalidade' => $nac, 'ids' => $ids];
        $pdo->prepare('UPDATE times_proprios SET opcoes = ? WHERE usuario_id = ?')->execute([json_encode($opcoes), $eu]);
        break;
    }
    case 'escolher': {
        $id = (string) ($d['jogador'] ?? '');
        if ($t['opcoes'] === null || !in_array($id, $t['opcoes']['ids'], true)) erro('Esse jogador não está entre as opções.');
        $t['escolhas'][] = ['funcao' => $t['opcoes']['funcao'], 'jogadorId' => $id];
        $pdo->prepare('UPDATE times_proprios SET escolhas = ?, opcoes = NULL WHERE usuario_id = ?')
            ->execute([json_encode($t['escolhas'], JSON_UNESCAPED_UNICODE), $eu]);
        // Lenda sorteada vira carta da conta (e entra no elenco quando a carreira começar).
        $s = $pdo->prepare("SELECT 1 FROM jogadores WHERE id = ? AND tipo = 'classico'");
        $s->execute([$id]);
        if ($s->fetch()) {
            $pdo->prepare("INSERT INTO cartas (usuario_id, jogador_id, origem) VALUES (?, ?, 'draft')")->execute([$eu, $id]);
        }
        break;
    }
    default:
        erro('Ação desconhecida.');
}
$pdo->commit();
estado($eu);
