<?php
// GET api/jogadores.php?tipo=classico&posicao=ATA&clube=flamengo&busca=pel
declare(strict_types=1);
require __DIR__ . '/db.php';
iniciarApi();

$where = [];
$params = [];
foreach (['tipo' => 'tipo', 'posicao' => 'posicao', 'clube' => 'clube_id'] as $param => $coluna) {
    if (!empty($_GET[$param])) {
        $where[] = "$coluna = ?";
        $params[] = (string) $_GET[$param];
    }
}
if (!empty($_GET['busca'])) {
    $where[] = 'nome LIKE ?';
    $params[] = '%' . (string) $_GET['busca'] . '%';
}
$sql = 'SELECT * FROM jogadores' . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
    . ' ORDER BY geral DESC, nome';
$stmt = db()->prepare($sql);
$stmt->execute($params);
responder(array_map('linhaParaJogador', $stmt->fetchAll()));
