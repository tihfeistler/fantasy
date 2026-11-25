<?php
// Contas (login por sessão PHP). Cada conta tem UMA carreira, num clube escolhido no cadastro;
// para jogar com outro clube é preciso criar outra conta.
//
// GET  api/auth.php                          -> usuário logado ou null
// POST api/auth.php {acao:"registrar", usuario, email, senha, senha2, tecnico, nascimento, pais,
//                    clube | time_proprio, clube_coracao?, termos:true}
//      time_proprio = {nome, sigla, pais, divisao, cidade, estadio, nomeEstadio, cor, corSecundaria, emblema, camisa}:
//      em vez de um clube existente, cria o time do técnico; o elenco sai do draft (api/time_proprio.php).
// POST api/auth.php {acao:"entrar", nome, senha}            nome = usuário ou e-mail
// POST api/auth.php {acao:"completar", email, tecnico, nascimento, pais, clube_coracao?, termos:true}
//      Contas de antes do cadastro completo preenchem o que falta.
// POST api/auth.php {acao:"sair"}
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/time_proprio_lib.php';
iniciarApi();
iniciarSessao();

const MOEDAS_INICIAIS = 1500;
const IDADE_MINIMA = 13;

function usuarioPublico(int $id): ?array
{
    $s = db()->prepare('SELECT id, nome, moedas, email, tecnico, nascimento, pais, clube_coracao, clube_carreira,
        termos_em FROM usuarios WHERE id = ?');
    $s->execute([$id]);
    $u = $s->fetch();
    if (!$u) return null;
    return [
        'id' => (int) $u['id'], 'nome' => $u['nome'], 'moedas' => (int) $u['moedas'],
        'email' => $u['email'], 'tecnico' => $u['tecnico'], 'nascimento' => $u['nascimento'], 'pais' => $u['pais'],
        'clubeCoracao' => $u['clube_coracao'], 'clubeCarreira' => $u['clube_carreira'],
        // Contas antigas (sem e-mail ou sem aceite dos termos) precisam completar o cadastro.
        'completo' => $u['email'] !== null && $u['termos_em'] !== null && $u['tecnico'] !== null,
        'timeProprio' => clubeProprioPublico(timeProprio($id)),
    ];
}

function invalido(string $msg, int $status = 422): never
{
    responder(['erro' => $msg], $status);
}

function clubeExiste(string $id): bool
{
    $s = db()->prepare('SELECT 1 FROM clubes WHERE id = ?');
    $s->execute([$id]);
    return (bool) $s->fetch();
}

/**
 * Confere os dados de perfil comuns ao cadastro e ao completar. Devolve
 * [email, tecnico, nascimento, pais, clube_coracao] já limpos.
 */
function perfilValido(array $d, ?int $eu = null): array
{
    $email = mb_strtolower(trim((string) ($d['email'] ?? '')));
    if (strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)) invalido('Digite um e-mail válido.');
    $s = db()->prepare('SELECT id FROM usuarios WHERE email = ?');
    $s->execute([$email]);
    $dono = $s->fetchColumn();
    if ($dono !== false && (int) $dono !== $eu) invalido('Esse e-mail já tem uma conta.', 409);

    $tecnico = preg_replace('/\s+/u', ' ', trim((string) ($d['tecnico'] ?? '')));
    if (!preg_match("/^[\\p{L}][\\p{L} .'-]{1,39}$/u", $tecnico)) {
        invalido('O nome do técnico deve ter de 2 a 40 letras (pode ter espaço, ponto, hífen e apóstrofo).');
    }

    $nasc = (string) ($d['nascimento'] ?? '');
    $data = DateTimeImmutable::createFromFormat('!Y-m-d', $nasc);
    if (!$data || $data->format('Y-m-d') !== $nasc) invalido('Digite a data de nascimento.');
    $idade = $data->diff(new DateTimeImmutable('today'))->y;
    if ($data > new DateTimeImmutable('today') || $idade > 110) invalido('Data de nascimento inválida.');
    if ($idade < IDADE_MINIMA) invalido('É preciso ter pelo menos ' . IDADE_MINIMA . ' anos para criar uma conta.');

    $pais = trim((string) ($d['pais'] ?? ''));
    if (!preg_match('/^[\p{L} .-]{2,40}$/u', $pais)) invalido('Escolha o seu país.');

    $coracao = trim((string) ($d['clube_coracao'] ?? ''));
    if ($coracao === '') $coracao = null;
    elseif (!clubeExiste($coracao)) invalido('Clube do coração desconhecido.');

    if (($d['termos'] ?? false) !== true) invalido('É preciso aceitar os termos de uso para jogar.');
    return [$email, $tecnico, $nasc, $pais, $coracao];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    responder(isset($_SESSION['usuario_id']) ? usuarioPublico((int) $_SESSION['usuario_id']) : null);
}

$d = corpoJson();
$acao = (string) ($d['acao'] ?? '');
$senha = (string) ($d['senha'] ?? '');

switch ($acao) {
    case 'registrar': {
        $nome = trim((string) ($d['usuario'] ?? ''));
        if (!preg_match('/^[A-Za-z0-9_.-]{3,20}$/', $nome)) {
            invalido('O usuário deve ter de 3 a 20 letras sem acento, números, ponto, hífen ou sublinhado (sem espaço).');
        }
        $s = db()->prepare('SELECT 1 FROM usuarios WHERE nome = ?');
        $s->execute([$nome]);
        if ($s->fetch()) invalido('Esse usuário já existe. Escolha outro.', 409);

        if (strlen($senha) < 8 || strlen($senha) > 72 || !preg_match('/\p{L}/u', $senha) || !preg_match('/\d/', $senha)) {
            invalido('A senha precisa de 8 a 72 caracteres, com pelo menos uma letra e um número.');
        }
        if (strcasecmp($senha, $nome) === 0) invalido('A senha não pode ser igual ao usuário.');
        if ($senha !== (string) ($d['senha2'] ?? '')) invalido('A confirmação da senha não confere.');

        [$email, $tecnico, $nasc, $pais, $coracao] = perfilValido($d);

        // Clube da carreira: escolhido aqui e preso à conta para sempre. Ou um time próprio,
        // que fica com a vaga do clube mais fraco da divisão escolhida.
        $proprio = null;
        if (isset($d['time_proprio'])) {
            $proprio = identidadeValida($d['time_proprio']);
            $clube = vagaDoTimeProprio($proprio['divisao'], $proprio['pais']);
            if ($clube === null) invalido('Essa divisão ainda não tem clubes no jogo.');
        } else {
            $clube = trim((string) ($d['clube'] ?? ''));
            $s = db()->prepare("SELECT COUNT(*) FROM jogadores WHERE tipo = 'atual' AND clube_id = ?");
            $s->execute([$clube]);
            if ($clube === '' || !clubeExiste($clube) || (int) $s->fetchColumn() < 11) invalido('Escolha o clube da sua carreira.');
        }

        db()->beginTransaction();
        try {
            db()->prepare('INSERT INTO usuarios (nome, senha_hash, moedas, email, tecnico, nascimento, pais, clube_coracao,
                    clube_carreira, termos_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())')
                ->execute([$nome, password_hash($senha, PASSWORD_DEFAULT), MOEDAS_INICIAIS, $email, $tecnico, $nasc,
                    $pais, $coracao, $clube]);
            $novo = (int) db()->lastInsertId();
            if ($proprio) {
                db()->prepare('INSERT INTO times_proprios (usuario_id, identidade, vaga, escolhas) VALUES (?, ?, ?, ?)')
                    ->execute([$novo, json_encode($proprio, JSON_UNESCAPED_UNICODE), $clube, '[]']);
            }
            db()->commit();
        } catch (PDOException $e) {
            db()->rollBack();
            // Dois cadastros ao mesmo tempo com o mesmo usuário ou e-mail.
            if ($e->getCode() === '23000') invalido('Esse usuário ou e-mail acabou de ser usado. Tente outro.', 409);
            throw $e;
        }
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = $novo;
        registrarDispositivo($_SESSION['usuario_id']);
        responder(usuarioPublico($_SESSION['usuario_id']), 201);
    }

    case 'entrar': {
        $nome = trim((string) ($d['nome'] ?? ''));
        $porEmail = str_contains($nome, '@');
        $s = db()->prepare('SELECT id, senha_hash FROM usuarios WHERE ' . ($porEmail ? 'email' : 'nome') . ' = ?');
        $s->execute([$porEmail ? mb_strtolower($nome) : $nome]);
        $u = $s->fetch();
        if (!$u || !password_verify($senha, $u['senha_hash'])) invalido('Usuário, e-mail ou senha incorretos.', 401);
        session_regenerate_id(true);
        $_SESSION['usuario_id'] = (int) $u['id'];
        registrarDispositivo((int) $u['id']);
        responder(usuarioPublico((int) $u['id']));
    }

    case 'completar': {
        if (!isset($_SESSION['usuario_id'])) invalido('Entre na sua conta primeiro.', 401);
        $eu = (int) $_SESSION['usuario_id'];
        [$email, $tecnico, $nasc, $pais, $coracao] = perfilValido($d, $eu);
        // O técnico de uma carreira já começada continua com o nome dela.
        try {
            db()->prepare('UPDATE usuarios SET email = ?, tecnico = COALESCE(tecnico, ?), nascimento = ?, pais = ?,
                    clube_coracao = ?, termos_em = COALESCE(termos_em, NOW()) WHERE id = ?')
                ->execute([$email, $tecnico, $nasc, $pais, $coracao, $eu]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') invalido('Esse e-mail já tem uma conta.', 409);
            throw $e;
        }
        responder(usuarioPublico($eu));
    }

    case 'sair':
        $_SESSION = [];
        session_destroy();
        responder(null);

    default:
        invalido('Ação desconhecida.', 400);
}
