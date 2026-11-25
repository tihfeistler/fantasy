<?php
// Importa data/clubes.json, data/jogadores.json (clássicos) e data/atuais.json para o MySQL.
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

$st = $pdo->prepare('INSERT INTO jogadores (id, tipo, nome, nome_completo, nacionalidade, posicao, pe,
    epoca_inicio, epoca_fim, auge, clube_marcante, clube_id, nascimento, potencial,
    finalizacao, passe, drible, velocidade, defesa, fisico, mentalidade, goleiro, geral)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE tipo=VALUES(tipo), nome=VALUES(nome), nome_completo=VALUES(nome_completo),
    nacionalidade=VALUES(nacionalidade), posicao=VALUES(posicao), pe=VALUES(pe),
    epoca_inicio=VALUES(epoca_inicio), epoca_fim=VALUES(epoca_fim), auge=VALUES(auge),
    clube_marcante=VALUES(clube_marcante), clube_id=VALUES(clube_id), nascimento=VALUES(nascimento),
    potencial=VALUES(potencial), finalizacao=VALUES(finalizacao), passe=VALUES(passe), drible=VALUES(drible),
    velocidade=VALUES(velocidade), defesa=VALUES(defesa), fisico=VALUES(fisico),
    mentalidade=VALUES(mentalidade), goleiro=VALUES(goleiro), geral=VALUES(geral)');
$n = 0;
// jogadores.json = clássicos; atuais.json = elencos da temporada
$todos = [];
foreach (['jogadores.json', 'atuais.json'] as $arq) {
    if (is_file("$raiz/data/$arq")) {
        array_push($todos, ...json_decode(file_get_contents("$raiz/data/$arq"), true, flags: JSON_THROW_ON_ERROR));
    } else {
        echo "Aviso: data/$arq não encontrado, pulando.\n";
    }
}
$vistos = [];
foreach ($todos as $j) {
    if (isset($vistos[$j['id']])) {
        $pdo->rollBack();
        exit("Erro: id repetido '{$j['id']}'. Cada jogador precisa de um id único.\n");
    }
    $vistos[$j['id']] = true;
    $a = $j['atributos'];
    foreach (ATRIBUTOS as $k) {
        if (!isset($a[$k])) {
            $pdo->rollBack();
            exit("Erro: '{$j['id']}' não tem o atributo '$k'. Formato antigo? Rode scripts/converter_atributos.py.\n");
        }
    }
    $st->execute([
        $j['id'], $j['tipo'] ?? 'classico', $j['nome'], $j['nomeCompleto'] ?? null,
        $j['nacionalidade'], $j['posicao'], $j['pe'] ?? 'D',
        $j['epoca']['inicio'] ?? null, $j['epoca']['fim'] ?? null, $j['auge'] ?? null,
        $j['clubeMarcante'] ?? null, $j['clubeId'] ?? null, $j['nascimento'] ?? null, $j['potencial'] ?? null,
        ...array_map(fn($k) => $a[$k], ATRIBUTOS), $j['geral'],
    ]);
    $n++;
}
$pdo->commit();
echo "Importados: $nClubes clubes, $n jogadores.\n";
