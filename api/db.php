<?php
declare(strict_types=1);

/** Os 8 atributos, na ordem do jogo (src/engine/types.ts). */
const ATRIBUTOS = ['finalizacao', 'passe', 'drible', 'velocidade', 'defesa', 'fisico', 'mentalidade', 'goleiro'];

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
    header('Access-Control-Allow-Headers: Content-Type, X-Fantasy-Dispositivo');
    // Login por sessão (cookie): o front precisa usar credentials: "include".
    header('Access-Control-Allow-Credentials: true');
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
        'atributos' => array_combine(ATRIBUTOS, array_map(fn($k) => (int) $r[$k], ATRIBUTOS)),
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

/** Corpo JSON de um POST. */
function corpoJson(): array
{
    $d = json_decode(file_get_contents('php://input') ?: '{}', true);
    return is_array($d) ? $d : [];
}

function iniciarSessao(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
        session_start();
    }
}

/**
 * Guarda o aparelho (id aleatório que o navegador manda no cabeçalho X-Fantasy-Dispositivo)
 * e o IP de cada conta, uma vez por minuto no máximo. Serve para achar contas ligadas.
 */
function registrarDispositivo(int $uid): void
{
    $disp = (string) ($_SERVER['HTTP_X_FANTASY_DISPOSITIVO'] ?? '');
    if (!preg_match('/^[A-Za-z0-9-]{16,64}$/', $disp)) return;
    $chave = "disp_$disp";
    if (($_SESSION[$chave] ?? 0) > time() - 60) return;
    $_SESSION[$chave] = time();
    db()->prepare('INSERT INTO dispositivos (usuario_id, dispositivo, ip) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE ip = VALUES(ip), ultimo_uso = NOW()')
        ->execute([$uid, $disp, substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45)]);
}

/** Id do usuário logado, ou responde 401. */
function exigirUsuario(): int
{
    iniciarSessao();
    $id = $_SESSION['usuario_id'] ?? null;
    if (!$id) responder(['erro' => 'Faça login para jogar online.'], 401);
    registrarDispositivo((int) $id);
    return (int) $id;
}

// Regras de economia das cartas. Iguais a src/engine/pacotes.ts e src/engine/mercadoCartas.ts.
const VALOR_VENDA = ['comum' => 100, 'rara' => 200, 'icone' => 400];
const TAXA_MERCADO = 0.05;
const PRECO_MINIMO = 10;
const PRECO_MAXIMO = 1000000;

function faixa(int $geral): string
{
    return $geral >= 88 ? 'icone' : ($geral >= 80 ? 'rara' : 'comum');
}

/** Preço básico ao vender para o sistema: cai 15% por cópia repetida, até a metade. */
function valorDeVenda(int $geral, int $copias): int
{
    $fator = max(0.5, 1 - 0.15 * max(0, $copias - 1));
    return (int) (round(VALOR_VENDA[faixa($geral)] * $fator / 5) * 5);
}
