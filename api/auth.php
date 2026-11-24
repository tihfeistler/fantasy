<?php
// Contas do modo online (login por sessão PHP).
// GET  api/auth.php                          -> usuário logado ou null
// POST api/auth.php {acao:"registrar", nome, senha}
// POST api/auth.php {acao:"entrar", nome, senha}
// POST api/auth.php {acao:"sair"}
declare(strict_types=1);
require __DIR__ . '/db.php';
iniciarApi();
iniciarSessao();

const MOEDAS_INICIAIS = 1500;

function usuarioPublico(int $id): ?array
{
    $s = db()->prepare('SELECT id, nome, moedas FROM usuarios WHERE id = ?');
    $s->execute([$id]);
    $u = $s->fetch();
    return $u ? ['id' => (int) $u['id'], 'nome' => $u['nome'], 'moedas' => (int) $u['moedas']] : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    responder(isset($_SESSION['usuario_id']) ? usuarioPublico((int) $_SESSION['usuario_id']) : null);
}

$d = corpoJson();
$acao = (string) ($d['acao'] ?? '');
$nome = trim((string) ($d['nome'] ?? ''));
$senha = (string) ($d['senha'] ?? '');

switch ($acao) {
    case 'registrar':
        if (!preg_match('/^[\p{L}\p{N} _.-]{3,30}$/u', $nome)) {
            responder(['erro' => 'Nome deve ter de 3 a 30 letras, números, espaço, ponto, hífen ou sublinhado.'], 422);
        }
        if (strlen($senha) < 6) responder(['erro' => 'A senha precisa de pelo menos 6 caracteres.'], 422);
        $s = db()->prepare('SELECT 1 FROM usuarios WHERE nome = ?');
        $s->execute([$nome]);
        if ($s->fetch()) responder(['erro' => 'Esse nome já está em uso.'], 409);
        db()->prepare('INSERT INTO usuarios (nome, senha_hash, moedas) VALUES (?, ?, ?)')
            ->execute([$nome, password_hash($senha, PASSWORD_DEFAULT), MOEDAS_INICIAIS]);
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = (int) db()->lastInsertId();
        responder(usuarioPublico($_SESSION['usuario_id']), 201);

    case 'entrar':
        $s = db()->prepare('SELECT id, senha_hash FROM usuarios WHERE nome = ?');
        $s->execute([$nome]);
        $u = $s->fetch();
        if (!$u || !password_verify($senha, $u['senha_hash'])) responder(['erro' => 'Nome ou senha incorretos.'], 401);
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = (int) $u['id'];
        responder(usuarioPublico((int) $u['id']));

    case 'sair':
        $_SESSION = [];
        session_destroy();
        responder(null);

    default:
        responder(['erro' => 'Ação desconhecida.'], 400);
}
