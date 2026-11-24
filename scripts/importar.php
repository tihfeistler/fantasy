<?php
// Importa data/clubes.json (se existir) e data/jogadores.json para o MySQL.
// Uso: php scripts/importar.php   (no XAMPP: C:\xampp\php\php.exe scripts\importar.php)
// Pode rodar várias vezes: atualiza quem já existe.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("Rode pela linha de comando.\n"); }
require __DIR__ . '/../api/db.php';

$raiz = dirname(__DIR__);
$pdo = db();
$pdo->beginTransaction();

$arqClubes = "$raiz/data/clubes.json";
$nClubes = 0;
if (is_file($arqClubes)) {
    $st = $pdo->prepare('INSERT INTO clubes (id, nome, sigla, cor, cor_secundaria, liga, nivel)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE nome=VALUES(nome), sigla=VALUES(sigla), cor=VALUES(cor),
        cor_secundaria=VALUES(cor_secundaria), liga=VALUES(liga), nivel=VALUES(nivel)');
    foreach (json_decode(file_get_contents($arqClubes), true, flags: JSON_THROW_ON_ERROR) as $c) {
        $st->execute([$c['id'], $c['nome'], $c['sigla'], $c['cor'] ?? '#888888',
            $c['corSecundaria'] ?? null, $c['liga'] ?? null, $c['nivel'] ?? null]);
        $nClubes++;
    }
}

$arqJog = "$raiz/data/jogadores.json";
if (!is_file($arqJog)) exit("Não achei $arqJog\n");
$st = $pdo->prepare('INSERT INTO jogadores (id, tipo, nome, nome_completo, nacionalidade, posicao, pe,
    epoca_inicio, epoca_fim, auge, clube_marcante, clube_id, nascimento, potencial,
    ataque, defesa, passe, velocidade, fisico, goleiro, geral)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE tipo=VALUES(tipo), nome=VALUES(nome), nome_completo=VALUES(nome_completo),
    nacionalidade=VALUES(nacionalidade), posicao=VALUES(posicao), pe=VALUES(pe),
    epoca_inicio=VALUES(epoca_inicio), epoca_fim=VALUES(epoca_fim), auge=VALUES(auge),
    clube_marcante=VALUES(clube_marcante), clube_id=VALUES(clube_id), nascimento=VALUES(nascimento),
    potencial=VALUES(potencial), ataque=VALUES(ataque), defesa=VALUES(defesa), passe=VALUES(passe),
    velocidade=VALUES(velocidade), fisico=VALUES(fisico), goleiro=VALUES(goleiro), geral=VALUES(geral)');
$n = 0;
foreach (json_decode(file_get_contents($arqJog), true, flags: JSON_THROW_ON_ERROR) as $j) {
    $a = $j['atributos'];
    $st->execute([
        $j['id'], $j['tipo'] ?? 'classico', $j['nome'], $j['nomeCompleto'] ?? null,
        $j['nacionalidade'], $j['posicao'], $j['pe'] ?? 'D',
        $j['epoca']['inicio'] ?? null, $j['epoca']['fim'] ?? null, $j['auge'] ?? null,
        $j['clubeMarcante'] ?? null, $j['clubeId'] ?? null, $j['nascimento'] ?? null, $j['potencial'] ?? null,
        $a['ataque'], $a['defesa'], $a['passe'], $a['velocidade'], $a['fisico'], $a['goleiro'], $j['geral'],
    ]);
    $n++;
}
$pdo->commit();
echo "Importados: $nClubes clubes, $n jogadores.\n";
