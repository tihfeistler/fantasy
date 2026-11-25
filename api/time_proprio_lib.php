<?php
// Time próprio: identidade (nome, cidade, estádio, cores, emblema, camisa) e draft do elenco.
// As regras são as mesmas de src/engine/timeProprio.ts; se mudar uma, mude a outra.
declare(strict_types=1);
require_once __DIR__ . '/online_lib.php';

/** Cartas de estádio: id => [fator de bilheteria, custo no caixa inicial em R$ mil]. */
const ESTADIOS = [
    'municipal' => [0.8, 0], 'bairro' => [1.0, 1000], 'arena' => [1.15, 2500],
    'olimpico' => [1.3, 4000], 'monumental' => [1.45, 6000],
];
const FORMAS_EMBLEMA = ['escudo', 'classico', 'redondo', 'losango'];
const SIMBOLOS_EMBLEMA = ['estrela', 'coroa', 'raio', 'bola', 'listras', 'nenhum'];
const MODELOS_CAMISA = ['lisa', 'listras', 'horizontais', 'faixa', 'metades', 'detalhes'];

/** Função de cada escolha => posição da base. */
const POSICAO_DA_FUNCAO = [
    'GOL' => 'GOL', 'LD' => 'LAT', 'LE' => 'LAT', 'ZAG' => 'ZAG',
    'VOL' => 'VOL', 'MC' => 'MEI', 'MEI' => 'MEI', 'MD' => 'MEI', 'ME' => 'MEI',
    'C' => 'ATA', 'PD' => 'ATA', 'PE' => 'ATA', 'SA' => 'ATA',
];
/** Grupos do draft na ordem: [vagas, funções]. Total 30. */
const GRUPOS_DRAFT = [
    [2, ['GOL']], [4, ['LD', 'LE']], [4, ['ZAG']],
    [12, ['VOL', 'MC', 'MEI', 'MD', 'ME']], [8, ['C', 'PD', 'PE', 'SA']],
];
const TOTAL_DRAFT = 30;
const OPCOES_POR_ESCOLHA = 5;
/** Chances de cada raridade, da mais rara para a mais comum (somam 1). */
const CHANCES_DRAFT = ['lenda' => 0.0001, 'especial' => 0.009, 'ouro' => 0.14, 'prata' => 0.5, 'bronze' => 0.3509];
const ORDEM_RARIDADE = ['bronze', 'prata', 'ouro', 'especial', 'lenda'];

function raridadeDraft(array $j): string
{
    if ($j['tipo'] !== 'atual') return 'lenda';
    $g = (int) $j['geral'];
    return $g >= 85 ? 'especial' : ($g >= 75 ? 'ouro' : ($g >= 65 ? 'prata' : 'bronze'));
}

/** Funções permitidas na escolha número $n (0 a 29), ou null se o draft acabou. */
function funcoesDaEscolha(int $n): ?array
{
    $ate = 0;
    foreach (GRUPOS_DRAFT as [$vagas, $funcoes]) {
        $ate += $vagas;
        if ($n < $ate) return $funcoes;
    }
    return null;
}

/** Confere a identidade do time (mesmas regras de problemaNaIdentidade). Devolve a versão limpa. */
function identidadeValida(mixed $d): array
{
    if (!is_array($d)) erro('Monte o seu time.');
    $texto = "/^[\\p{L}\\p{N}][\\p{L}\\p{N} .'-]{1,29}$/u";
    $limpa = fn($k) => preg_replace('/\s+/u', ' ', trim((string) ($d[$k] ?? '')));
    $nome = $limpa('nome');
    if (!preg_match($texto, $nome)) erro('O nome do time deve ter de 2 a 30 letras ou números.');
    $sigla = (string) ($d['sigla'] ?? '');
    if (!preg_match('/^[A-Z]{3}$/', $sigla)) erro('A sigla deve ter 3 letras.');
    $cidade = $limpa('cidade');
    if (!preg_match($texto, $cidade)) erro('Digite a cidade do time.');
    $estadio = (string) ($d['estadio'] ?? '');
    if (!isset(ESTADIOS[$estadio])) erro('Escolha a carta do estádio.');
    $nomeEstadio = $limpa('nomeEstadio');
    if (!preg_match($texto, $nomeEstadio)) erro('Dê um nome ao estádio.');
    $cor = strtolower((string) ($d['cor'] ?? ''));
    $cor2 = strtolower((string) ($d['corSecundaria'] ?? ''));
    if (!preg_match('/^#[0-9a-f]{6}$/', $cor) || !preg_match('/^#[0-9a-f]{6}$/', $cor2)) erro('Escolha as duas cores.');
    if ($cor === $cor2) erro('As duas cores precisam ser diferentes.');
    $forma = (string) ($d['emblema']['forma'] ?? '');
    $simbolo = (string) ($d['emblema']['simbolo'] ?? '');
    if (!in_array($forma, FORMAS_EMBLEMA, true) || !in_array($simbolo, SIMBOLOS_EMBLEMA, true)) erro('Monte o emblema.');
    $camisa = (string) ($d['camisa'] ?? '');
    if (!in_array($camisa, MODELOS_CAMISA, true)) erro('Escolha o modelo da camisa.');
    $pais = (string) ($d['pais'] ?? '');
    $divisao = (string) ($d['divisao'] ?? '');
    if (ligaDaDivisao($divisao, $pais) === null) erro('Escolha a divisão.');
    return ['nome' => $nome, 'sigla' => $sigla, 'pais' => $pais, 'divisao' => $divisao, 'cidade' => $cidade, 'estadio' => $estadio,
        'nomeEstadio' => $nomeEstadio, 'cor' => $cor, 'corSecundaria' => $cor2,
        'emblema' => ['forma' => $forma, 'simbolo' => $simbolo], 'camisa' => $camisa];
}

/** Chave da liga (campo liga de clubes) de uma divisão do país, ou null. */
function ligaDaDivisao(string $divisao, string $pais): ?string
{
    foreach (DIVISAO_DA_LIGA as $liga => [$id, $p]) if ($id === $divisao && $p === $pais) return $liga;
    return null;
}

/** Clube que dá lugar ao time próprio: o de menor nível da divisão escolhida. */
function vagaDoTimeProprio(string $divisao, string $pais): ?string
{
    $chave = ligaDaDivisao($divisao, $pais);
    if ($chave === null) return null;
    $s = db()->prepare('SELECT id FROM clubes WHERE liga = ? ORDER BY nivel, id LIMIT 1');
    $s->execute([$chave]);
    $id = $s->fetchColumn();
    return $id === false ? null : (string) $id;
}

/** Linha do time próprio da conta, já com JSON decodificado, ou null. */
function timeProprio(int $uid, bool $travar = false): ?array
{
    $s = db()->prepare('SELECT * FROM times_proprios WHERE usuario_id = ?' . ($travar ? ' FOR UPDATE' : ''));
    $s->execute([$uid]);
    $t = $s->fetch();
    if (!$t) return null;
    return [
        'identidade' => json_decode($t['identidade'], true),
        'vaga' => $t['vaga'],
        'escolhas' => json_decode($t['escolhas'], true) ?: [],
        'opcoes' => $t['opcoes'] !== null ? json_decode($t['opcoes'], true) : null,
    ];
}

/** Identidade com a vaga, como vai para o cliente e para os dados da carreira. */
function clubeProprioPublico(?array $t): ?array
{
    return $t ? $t['identidade'] + ['vaga' => $t['vaga'], 'draftCompleto' => count($t['escolhas']) >= TOTAL_DRAFT] : null;
}

function idsEscolhidos(array $t): array
{
    return array_map(fn($e) => (string) $e['jogadorId'], $t['escolhas']);
}

/** Sorteia as opções de uma escolha (ids), sem repetir e sem quem já foi escolhido. */
function sortearOpcoesDraft(string $funcao, string $nac, array $excluir): array
{
    $pos = POSICAO_DA_FUNCAO[$funcao];
    $s = db()->prepare('SELECT id, tipo, geral FROM jogadores WHERE posicao = ? AND nacionalidade = ?');
    $s->execute([$pos, $nac]);
    $por = array_fill_keys(ORDEM_RARIDADE, []);
    $fora = array_flip($excluir);
    foreach ($s->fetchAll() as $j) if (!isset($fora[$j['id']])) $por[raridadeDraft($j)][] = $j['id'];
    $saida = [];
    for ($i = 0; $i < OPCOES_POR_ESCOLHA; $i++) {
        $r = random_int(0, 999999) / 1000000;
        $alvo = 'bronze';
        $acc = 0.0;
        foreach (CHANCES_DRAFT as $rar => $p) {
            $acc += $p;
            if ($r < $acc) {
                $alvo = $rar;
                break;
            }
        }
        $k = array_search($alvo, ORDEM_RARIDADE, true);
        $ordem = array_merge(array_reverse(array_slice(ORDEM_RARIDADE, 0, $k + 1)), array_slice(ORDEM_RARIDADE, $k + 1));
        $achou = null;
        foreach ($ordem as $rar) if ($por[$rar]) {
            $achou = $rar;
            break;
        }
        if ($achou === null) break;
        $idx = random_int(0, count($por[$achou]) - 1);
        $saida[] = $por[$achou][$idx];
        array_splice($por[$achou], $idx, 1);
    }
    return $saida;
}
