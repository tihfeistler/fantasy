<?php
declare(strict_types=1);

function config(): array
{
    static $c = null;
    return $c ??= require __DIR__ . '/config.php';
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config();
    $dsn = "mysql:host={$c['db_host']};port={$c['db_port']};dbname={$c['db_nome']};charset=utf8mb4";
    $pdo = new PDO($dsn, $c['db_usuario'], $c['db_senha'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function responder(mixed $dados, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function iniciarApi(): void
{
    header('Access-Control-Allow-Origin: ' . config()['cors_origem']);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') exit;
    set_exception_handler(function (Throwable $e) {
        error_log((string) $e);
        responder(['erro' => 'Erro no servidor. Veja o log do Apache/PHP.'], 500);
    });
}

/** Converte uma linha da tabela jogadores para o formato JSON do jogo. */
function linhaParaJogador(array $r): array
{
    $j = [
        'id' => $r['id'],
        'tipo' => $r['tipo'],
        'nome' => $r['nome'],
        'nacionalidade' => $r['nacionalidade'],
        'posicao' => $r['posicao'],
        'pe' => $r['pe'],
        'atributos' => [
            'ataque' => (int) $r['ataque'],
            'defesa' => (int) $r['defesa'],
            'passe' => (int) $r['passe'],
            'velocidade' => (int) $r['velocidade'],
            'fisico' => (int) $r['fisico'],
            'goleiro' => (int) $r['goleiro'],
        ],
        'geral' => (int) $r['geral'],
    ];
    if ($r['nome_completo'] !== null) $j['nomeCompleto'] = $r['nome_completo'];
    if ($r['epoca_inicio'] !== null) $j['epoca'] = ['inicio' => (int) $r['epoca_inicio'], 'fim' => (int) $r['epoca_fim']];
    if ($r['auge'] !== null) $j['auge'] = (int) $r['auge'];
    if ($r['clube_marcante'] !== null) $j['clubeMarcante'] = $r['clube_marcante'];
    if ($r['clube_id'] !== null) $j['clubeId'] = $r['clube_id'];
    if ($r['nascimento'] !== null) $j['nascimento'] = $r['nascimento'];
    if ($r['potencial'] !== null) $j['potencial'] = (int) $r['potencial'];
    return $j;
}
