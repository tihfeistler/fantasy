<?php
// Padrões do XAMPP: usuário root sem senha. Para mudar sem mexer aqui,
// crie api/config.local.php retornando um array com as chaves que quiser
// sobrescrever (esse arquivo fica fora do git).
$config = [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_nome' => 'fantasy',
    'db_usuario' => 'root',
    'db_senha' => '',
    // Origem do front em desenvolvimento (npm run dev)
    'cors_origem' => 'http://localhost:5173',
];
$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
    $config = array_merge($config, require $local);
}
return $config;
