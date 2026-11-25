<?php
// GET api/clubes.php?liga=brasileirao-a
declare(strict_types=1);
require __DIR__ . '/db.php';
iniciarApi();

$sql = 'SELECT id, nome, sigla, cor, cor_secundaria AS corSecundaria, liga, nivel,
    estadio, capacidade, atmosfera, qualidade, visual FROM clubes';
$params = [];
if (!empty($_GET['liga'])) {
    $sql .= ' WHERE liga = ?';
    $params[] = (string) $_GET['liga'];
}
$stmt = db()->prepare($sql . ' ORDER BY nome');
$stmt->execute($params);
// Mesmo formato de data/clubes.json: estadio {nome, capacidade, atmosfera, qualidade}, camisas e emblema.
responder(array_map(function (array $c): array {
    $visual = $c['visual'] ? json_decode($c['visual'], true) : [];
    $estadio = $c['estadio'] === null ? null : ['nome' => $c['estadio'], 'capacidade' => (int) $c['capacidade'],
        'atmosfera' => (int) $c['atmosfera'], 'qualidade' => (int) $c['qualidade']];
    unset($c['estadio'], $c['capacidade'], $c['atmosfera'], $c['qualidade'], $c['visual']);
    return $c + ['estadio' => $estadio] + $visual;
}, $stmt->fetchAll()));
