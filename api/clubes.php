<?php
// GET api/clubes.php?liga=brasileirao-a
declare(strict_types=1);
require __DIR__ . '/db.php';
iniciarApi();

$sql = 'SELECT id, nome, sigla, cor, cor_secundaria AS corSecundaria, liga, nivel FROM clubes';
$params = [];
if (!empty($_GET['liga'])) {
    $sql .= ' WHERE liga = ?';
    $params[] = (string) $_GET['liga'];
}
$stmt = db()->prepare($sql . ' ORDER BY nome');
$stmt->execute($params);
responder($stmt->fetchAll());
