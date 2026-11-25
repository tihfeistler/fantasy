<?php
// Carreira salva na conta e caixa único (carreira, desafios e online).
// Exige login (api/auth.php).
//
// GET  api/carreira.php                         -> {dados|null, caixa, seq}
// POST api/carreira.php {acao:"criar", dados}   cria a carreira do clube de dados.manager.clubeId.
//      Cada conta tem UMA carreira: o clube é o escolhido no cadastro (usuarios.clube_carreira) e uma
//      conta que já tem carreira recebe 409. Para outro clube, só criando outra conta.
//      O caixa ganha o caixa inicial do clube (10% do valor do elenco).
// POST api/carreira.php {acao:"salvar", dados, lancamentos:[...]}
//      Guarda o estado e aplica no caixa os lançamentos novos (seq maior que o último aceito),
//      um por um, conferindo cada um pelas regras abaixo. Responde {caixa, seq, recusados}.
// Não existe apagar: a carreira dura enquanto durar a conta.
//
// O jogo roda no navegador, então o servidor não refaz as partidas. Ele confere o que dá para
// conferir: TV e bilheteria têm valor fixo e saem uma vez por rodada; o salário não pode ser
// menor que a folha do elenco que o servidor sabe que é seu; compra e venda respeitam o valor
// de mercado e quem é dono do jogador; premiação uma vez por temporada; prêmio de desafio só
// depois de pagar a partida, com limite diário no treino (que é de graça); prêmio de copa uma vez
// por fase de cada copa na temporada, com o teto da fase (src/engine/copas.ts).
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/online_lib.php';
iniciarApi();
$eu = exigirUsuario();
$pdo = db();

/** Prêmio máximo (vitória) de cada desafio em R$ mil; igual a src/engine/desafios.ts. */
const PREMIO_DESAFIO = [
    'treino' => 150, 'nordeste' => 400, 'flamengo' => 800, 'brasileirao' => 1500,
    'brasil-1970' => 1500, 'holanda' => 2500, 'milan' => 2500, 'superclassico' => 800, 'europa' => 2500,
];
/** Moedas máximas (vitória) de cada desafio; igual a src/engine/desafios.ts. */
const MOEDAS_DESAFIO = [
    'treino' => 20, 'nordeste' => 60, 'flamengo' => 120, 'brasileirao' => 200,
    'brasil-1970' => 200, 'holanda' => 300, 'milan' => 300, 'superclassico' => 120, 'europa' => 300,
];
/** src/engine/pacotes.ts: PREMIO.vitoria; src/engine/campeonato.ts: premioFinal do campeão da liga que paga mais (Premier League, 1,5 x 3.000). */
const MOEDAS_PARTIDA = 300;
const MOEDAS_TEMPORADA = 4500;
/**
 * Divisão (src/engine/ligas.ts) pelo campo liga de data/clubes.json: [id, país, nível].
 * A divisão só muda para a de cima ou a de baixo do mesmo país (acesso e rebaixamento).
 */
const DIVISAO_DA_LIGA = [
    'brasileirao-a' => ['A', 'BRA', 1], 'brasileirao-b' => ['B', 'BRA', 2],
    'brasileirao-c' => ['C', 'BRA', 3], 'brasileirao-d' => ['D', 'BRA', 4],
    'premier-league' => ['ING', 'ENG', 1], 'championship' => ['ING2', 'ENG', 2],
    'league-one' => ['ING3', 'ENG', 3], 'league-two' => ['ING4', 'ENG', 4],
    'la-liga' => ['ESP', 'ESP', 1], 'segunda-division' => ['ESP2', 'ESP', 2],
    'serie-a-italia' => ['ITA', 'ITA', 1], 'serie-b-italia' => ['ITA2', 'ITA', 2],
    'bundesliga' => ['ALE', 'GER', 1], '2-bundesliga' => ['ALE2', 'GER', 2],
    'ligue-1' => ['FRA', 'FRA', 1], 'ligue-2' => ['FRA2', 'FRA', 2],
    'liga-portugal' => ['POR', 'POR', 1], 'liga-portugal-2' => ['POR2', 'POR', 2],
    'eredivisie' => ['NED', 'NED', 1], 'eerste-divisie' => ['NED2', 'NED', 2],
    'pro-league' => ['BEL', 'BEL', 1], 'challenger-pro-league' => ['BEL2', 'BEL', 2],
    'liga-argentina' => ['ARG', 'ARG', 1], 'primera-nacional' => ['ARG2', 'ARG', 2],
    'saudi-pro-league' => ['KSA', 'KSA', 1], 'saudi-first-division' => ['KSA2', 'KSA', 2],
    'eliteserien' => ['NOR', 'NOR', 1], 'obos-ligaen' => ['NOR2', 'NOR', 2],
    'superliga-dinamarca' => ['DEN', 'DEN', 1], '1-division-dinamarca' => ['DEN2', 'DEN', 2],
    'scottish-premiership' => ['SCO', 'SCO', 1], 'scottish-championship' => ['SCO2', 'SCO', 2],
    'bundesliga-austria' => ['AUT', 'AUT', 1], '2-liga-austria' => ['AUT2', 'AUT', 2],
    'superliga-servia' => ['SRB', 'SRB', 1], 'prva-liga-servia' => ['SRB2', 'SRB', 2],
];

/** [país, nível] de uma divisão, ou null se não existir. */
function infoDivisao(string $div): ?array
{
    foreach (DIVISAO_DA_LIGA as [$id, $pais, $nivel]) if ($id === $div) return [$pais, $nivel];
    return null;
}
/**
 * Copas (src/engine/copas.ts): prêmio da primeira fase vencida em R$ mil. Cada fase paga o dobro da
 * anterior e a final vencida paga o título junto, então a fase k paga no máximo base * 2^(k+1).
 * Copa nacional: 300 x fator de premiação da primeira divisão do país.
 */
const PREMIO_COPA = [
    'copa-BRA' => 300, 'copa-ENG' => 450, 'copa-ESP' => 420, 'copa-ITA' => 390, 'copa-GER' => 390,
    'copa-FRA' => 360, 'copa-POR' => 300, 'copa-NED' => 300, 'copa-BEL' => 270, 'copa-ARG' => 240,
    'copa-KSA' => 300, 'copa-NOR' => 210, 'copa-DEN' => 210, 'copa-SCO' => 210, 'copa-AUT' => 210,
    'copa-SRB' => 180, 'libertadores' => 1000, 'champions' => 2000,
];
/** MOEDAS_POR_FASE + MOEDAS_TITULO da continental. */
const MOEDAS_COPA = 2050;
const MAX_FASES_COPA = 8;

/** [copa, fase] de um ref "copa-BRA:3", ou null. */
function refCopa(string $ref): ?array
{
    if (!preg_match('/^([a-z]+(?:-[A-Z]{3})?):(\d)$/', $ref, $m) || !isset(PREMIO_COPA[$m[1]])) return null;
    $fase = (int) $m[2];
    return $fase < MAX_FASES_COPA ? [$m[1], $fase] : null;
}
const TREINOS_PREMIADOS_POR_DIA = 10;
/** Desafios que dão uma lenda do adversário na primeira vitória (src/engine/desafios.ts). */
const DESAFIOS_COM_CARTA = ['brasil-1970', 'holanda', 'milan'];
/** Igual a src/engine/mercado.ts: FATOR_TV_SERIE_B e FATOR_BILHETERIA_SERIE_B. */
const FATOR_TV_B = 0.5;
const FATOR_BILHETERIA_B = 0.75;

function linhaCarreira(int $uid, bool $travar = false): ?array
{
    $s = db()->prepare('SELECT * FROM carreiras WHERE usuario_id = ?' . ($travar ? ' FOR UPDATE' : ''));
    $s->execute([$uid]);
    return $s->fetch() ?: null;
}

/** Jogadores atuais (id => [geral, clube_id]) de uma lista de ids, ou de um clube. */
function atuais(array $ids = [], ?string $clube = null): array
{
    if ($clube !== null) {
        $s = db()->prepare("SELECT id, geral, clube_id FROM jogadores WHERE tipo = 'atual' AND clube_id = ?");
        $s->execute([$clube]);
    } else {
        if (!$ids) return [];
        $s = db()->prepare("SELECT id, geral, clube_id FROM jogadores WHERE tipo = 'atual' AND id IN ("
            . implode(',', array_fill(0, count($ids), '?')) . ')');
        $s->execute(array_values($ids));
    }
    $r = [];
    foreach ($s->fetchAll() as $l) $r[$l['id']] = ['geral' => (int) $l['geral'], 'clube' => $l['clube_id']];
    return $r;
}

/** Elenco atual do técnico pelo que o servidor sabe: base do clube, mais comprados, menos quem saiu. */
function meuElenco(string $clube, array $posse): array
{
    $base = atuais([], $clube);
    $comprados = array_keys(array_filter($posse, fn($v) => $v === 1));
    $todos = $base + atuais(array_diff($comprados, array_keys($base)));
    return array_filter($todos, fn($j, $id) => ($posse[$id] ?? ($j['clube'] === $clube ? 1 : 0)) === 1,
        ARRAY_FILTER_USE_BOTH);
}

/** Folha mensal: salário de contrato ou de tabela (src/engine/contratos.ts). */
function folha(array $elenco, array $contratos): int
{
    $f = 0;
    foreach ($elenco as $id => $j) $f += (int) ($contratos[$id]['salario'] ?? salarioMensal($j['geral']));
    return $f;
}

/** Menor salário que um jogador aceita: 95% do de tabela (src/engine/contratos.ts, pedidaSalarial). */
function salarioMinimo(int $geral): int
{
    return (int) max(5, round(salarioMensal($geral) * 0.95 / 5) * 5) - 5;
}

function caixaDe(int $uid, bool $travar = false): int
{
    return timeOnline($uid, $travar)['caixa'];
}

function moedasDe(int $uid): int
{
    $s = db()->prepare('SELECT moedas FROM usuarios WHERE id = ?');
    $s->execute([$uid]);
    return (int) $s->fetchColumn();
}

function responderEstado(int $uid, array $extra = []): never
{
    $c = linhaCarreira($uid);
    responder([
        'dados' => $c && $c['dados'] !== null ? json_decode($c['dados'], true) : null,
        'caixa' => caixaDe($uid),
        'moedas' => moedasDe($uid),
        'seq' => $c ? (int) $c['seq'] : 0,
    ] + $extra);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') responderEstado($eu);

$d = corpoJson();
switch ((string) ($d['acao'] ?? '')) {
    case 'criar': {
        $dados = $d['dados'] ?? null;
        $clube = (string) ($dados['manager']['clubeId'] ?? '');
        $q = $pdo->prepare('SELECT clube_carreira, tecnico FROM usuarios WHERE id = ?');
        $q->execute([$eu]);
        $perfil = $q->fetch();
        if ($perfil['clube_carreira'] !== null && $perfil['clube_carreira'] !== $clube) {
            erro('O clube desta conta já foi escolhido. Para comandar outro clube, crie outra conta.', 409);
        }
        $tecnico = $perfil['tecnico'] ?? preg_replace('/\s+/u', ' ', trim((string) ($dados['manager']['nome'] ?? '')));
        if (!preg_match("/^[\\p{L}\\p{N}][\\p{L}\\p{N} .'-]{1,39}$/u", $tecnico)) erro('Nome do técnico inválido.');
        $dados['manager']['nome'] = $tecnico;
        $q = $pdo->prepare('SELECT liga FROM clubes WHERE id = ?');
        $q->execute([$clube]);
        $liga = $q->fetchColumn();
        if ($liga === false) erro('Clube desconhecido.');
        $elenco = atuais([], $clube);
        if (count($elenco) < 11) erro('Elenco do clube não encontrado. Rode scripts/importar.php.');
        $folha = folha($elenco, []);
        $valor = array_sum(array_map(fn($j) => valorDeMercado($j['geral']), $elenco));
        // src/engine/mercado.ts, financasIniciais.
        $receita = (int) round($folha / 4 * 0.75);
        $bilheteria = (int) round($folha / 4 * 0.6);
        $pdo->beginTransaction();
        caixaDe($eu, true);
        $c = linhaCarreira($eu, true);
        if ($c && $c['dados'] !== null) {
            erro('Esta conta já tem uma carreira. Para começar outra, crie uma conta nova.', 409);
        }
        $bonus = $c && $c['bonus_inicial'] ? 0 : (int) round($valor * 0.1);
        $pdo->prepare('INSERT INTO carreiras (usuario_id, clube_id, divisao, ano, receita, bilheteria, posse, ultima_rodada,
                ultima_bilheteria, ultimo_salario, ultima_premiacao, seq, desafio_pendente, bonus_inicial, dados)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, NULL, 1, NULL)
            ON DUPLICATE KEY UPDATE clube_id = VALUES(clube_id), divisao = VALUES(divisao), ano = VALUES(ano),
                receita = VALUES(receita), bilheteria = VALUES(bilheteria), posse = VALUES(posse), ultima_rodada = 0,
                ultima_bilheteria = 0, ultimo_salario = 0, ultima_premiacao = 0, ultima_partida = 0, seq = 0,
                desafio_pendente = NULL, bonus_inicial = 1, copas_pagas = NULL')
            ->execute([$eu, $clube, DIVISAO_DA_LIGA[$liga][0] ?? 'A', (int) ($dados['temporada']['ano'] ?? 0),
                $receita, $bilheteria, '{}']);
        if ($bonus) {
            $pdo->prepare('UPDATE times_online SET caixa = caixa + ? WHERE usuario_id = ?')->execute([$bonus, $eu]);
            $pdo->prepare('INSERT INTO lancamentos (usuario_id, tipo, descricao, valor) VALUES (?, ?, ?, ?)')
                ->execute([$eu, 'inicial', "Caixa inicial do clube ($clube)", $bonus]);
        }
        $caixa = caixaDe($eu);
        // O estado guardado leva as finanças do servidor.
        $dados['financas'] = ['caixa' => $caixa, 'receitaPorRodada' => $receita, 'bilheteria' => $bilheteria,
            'extrato' => [], 'seq' => 0];
        $pdo->prepare('UPDATE carreiras SET dados = ? WHERE usuario_id = ?')
            ->execute([json_encode($dados, JSON_UNESCAPED_UNICODE), $eu]);
        $pdo->prepare('UPDATE usuarios SET clube_carreira = ?, tecnico = ? WHERE id = ?')->execute([$clube, $tecnico, $eu]);
        $pdo->commit();
        responderEstado($eu, ['bonus' => $bonus]);
    }

    case 'salvar': {
        $dados = $d['dados'] ?? null;
        if (!is_array($dados) || !isset($dados['manager']['clubeId'])) erro('Carreira inválida.');
        $novos = is_array($d['lancamentos'] ?? null) ? $d['lancamentos'] : [];
        $pdo->beginTransaction();
        $caixa = caixaDe($eu, true);
        $c = linhaCarreira($eu, true);
        if (!$c || $c['dados'] === null) erro('Esta conta não tem carreira. Crie uma.', 409);
        $clube = $c['clube_id'];
        if ($dados['manager']['clubeId'] !== $clube) erro('A carreira da conta é de outro clube. Recarregue o jogo.', 409);
        $antes = json_decode($c['dados'], true) ?: [];
        $posse = json_decode($c['posse'], true) ?: [];

        // Nova temporada: a divisão pode mudar (acesso ou rebaixamento) e as receitas mudam junto.
        $ano = (int) ($dados['temporada']['ano'] ?? 0);
        if ($ano > (int) $c['ano']) {
            // A divisão só pode ir para a de cima ou a de baixo do mesmo país.
            $div = (string) ($dados['temporada']['divisao'] ?? 'A');
            $nova = infoDivisao($div);
            $atual = infoDivisao((string) $c['divisao']);
            if (!$nova || !$atual || $nova[0] !== $atual[0] || abs($nova[1] - $atual[1]) !== 1) $div = $c['divisao'];
            if ($div !== $c['divisao']) {
                $sobe = $nova[1] < $atual[1];
                $c['receita'] = (int) round($c['receita'] * ($sobe ? 1 / FATOR_TV_B : FATOR_TV_B));
                $c['bilheteria'] = (int) round($c['bilheteria'] * ($sobe ? 1 / FATOR_BILHETERIA_B : FATOR_BILHETERIA_B));
                $c['divisao'] = $div;
            }
            $c['ano'] = $ano;
        }

        $recusados = [];
        $aceitos = [];
        $moedasGanhas = 0;
        $copasPagas = json_decode((string) ($c['copas_pagas'] ?? ''), true) ?: [];
        $contratosAntes = $antes['contratos'] ?? [];
        $contratosDepois = is_array($dados['contratos'] ?? null) ? $dados['contratos'] : [];
        usort($novos, fn($a, $b) => ($a['n'] ?? 0) <=> ($b['n'] ?? 0));
        foreach ($novos as $l) {
            $n = (int) ($l['n'] ?? 0);
            if ($n <= (int) $c['seq']) continue; // já aplicado
            $c['seq'] = $n;
            $tipo = (string) ($l['tipo'] ?? '');
            $valor = (int) ($l['valor'] ?? 0);
            $rodada = (int) ($l['ano'] ?? $c['ano']) * 100 + (int) ($l['rodada'] ?? 0);
            $ref = (string) ($l['ref'] ?? '');
            $moedas = max(0, (int) ($l['moedas'] ?? 0));
            $okMoedas = match ($tipo) {
                'partida' => $moedas <= MOEDAS_PARTIDA && $rodada > (int) $c['ultima_partida'],
                'premiacao' => $moedas <= MOEDAS_TEMPORADA,
                'desafio-premio' => $moedas <= (MOEDAS_DESAFIO[$ref] ?? 0),
                'copa' => $moedas <= MOEDAS_COPA,
                default => $moedas === 0,
            };
            $ok = $okMoedas && match ($tipo) {
                'partida' => $valor === 0,
                'tv' => $valor === (int) $c['receita'] && $rodada > (int) $c['ultima_rodada'],
                'bilheteria' => $valor === (int) $c['bilheteria'] && $rodada > (int) $c['ultima_bilheteria'],
                'salarios' => $valor <= 0 && $rodada > (int) $c['ultimo_salario']
                    && -$valor >= 0.95 * min(folha(meuElenco($clube, $posse), $contratosAntes),
                        folha(meuElenco($clube, $posse), $contratosDepois)) / 4 - 5,
                'juros' => $valor <= 0,
                'compra' => (function () use ($ref, $valor, $posse, $clube) {
                    $j = atuais([$ref])[$ref] ?? null;
                    return $j && $valor < 0 && -$valor >= round(valorDeMercado($j['geral']) * 0.85)
                        && ($posse[$ref] ?? ($j['clube'] === $clube ? 1 : 0)) !== 1;
                })(),
                'venda' => (function () use ($ref, $valor, $posse, $clube) {
                    $j = atuais([$ref])[$ref] ?? null;
                    return $j && $valor > 0 && $valor <= valorDeMercado($j['geral']) * 1.45
                        && ($posse[$ref] ?? ($j['clube'] === $clube ? 1 : 0)) === 1;
                })(),
                'premiacao' => $valor >= 0 && $valor <= (int) $c['receita'] * 10 + 1
                    && (int) ($l['ano'] ?? 0) > (int) $c['ultima_premiacao'],
                'desafio-custo' => $valor <= 0 && isset(PREMIO_DESAFIO[$ref]),
                // Prêmio de copa: uma vez por fase de cada copa na temporada, até o teto da fase.
                'copa' => (function () use ($ref, $valor, $l, $c, $copasPagas) {
                    $rc = refCopa($ref);
                    $chave = (int) ($l['ano'] ?? $c['ano']) . ':' . $ref;
                    return $rc && $valor >= 0 && $valor <= PREMIO_COPA[$rc[0]] * 2 ** ($rc[1] + 1)
                        && !in_array($chave, $copasPagas, true);
                })(),
                'desafio-premio' => $valor >= 0 && $c['desafio_pendente'] === $ref
                    && $valor <= (PREMIO_DESAFIO[$ref] ?? 0)
                    && ($ref !== 'treino' || $valor === 0 || ($c['treinos_dia'] === date('Y-m-d') ? (int) $c['treinos_hoje'] : 0)
                        < TREINOS_PREMIADOS_POR_DIA),
                default => $valor === 0, // avisos sem dinheiro (ex.: punição em pontos)
            };
            if (!$ok) {
                $recusados[] = $n;
                continue;
            }
            match ($tipo) {
                'partida' => $c['ultima_partida'] = $rodada,
                'tv' => $c['ultima_rodada'] = $rodada,
                'bilheteria' => $c['ultima_bilheteria'] = $rodada,
                'salarios' => $c['ultimo_salario'] = $rodada,
                'compra' => $posse[$ref] = 1,
                'venda' => $posse[$ref] = 0,
                'premiacao' => $c['ultima_premiacao'] = (int) $l['ano'],
                'desafio-custo' => $c['desafio_pendente'] = $ref,
                'copa' => $copasPagas[] = (int) ($l['ano'] ?? $c['ano']) . ':' . $ref,
                default => null,
            };
            if ($tipo === 'desafio-premio') {
                $c['desafio_pendente'] = null;
                // Primeira vitória num desafio com carta: a lenda escolhida vai para a coleção (uma vez por desafio).
                $carta = (string) ($l['carta'] ?? '');
                if ($carta !== '' && in_array($ref, DESAFIOS_COM_CARTA, true) && $valor === PREMIO_DESAFIO[$ref]) {
                    $q = $pdo->prepare("SELECT 1 FROM lancamentos WHERE usuario_id = ? AND tipo = 'carta-desafio' AND descricao = ?");
                    $q->execute([$eu, $ref]);
                    $existe = $pdo->prepare("SELECT 1 FROM jogadores WHERE id = ? AND tipo = 'classico'");
                    $existe->execute([$carta]);
                    if (!$q->fetch() && $existe->fetch()) {
                        $pdo->prepare("INSERT INTO cartas (usuario_id, jogador_id, origem) VALUES (?, ?, 'objetivo')")
                            ->execute([$eu, $carta]);
                        $pdo->prepare("INSERT INTO lancamentos (usuario_id, tipo, descricao, valor) VALUES (?, 'carta-desafio', ?, 0)")
                            ->execute([$eu, $ref]);
                    }
                }
                if ($ref === 'treino' && $valor > 0) {
                    if ($c['treinos_dia'] !== date('Y-m-d')) [$c['treinos_dia'], $c['treinos_hoje']] = [date('Y-m-d'), 0];
                    $c['treinos_hoje'] = (int) $c['treinos_hoje'] + 1;
                }
            }
            if ($valor !== 0) $aceitos[] = [$tipo, mb_substr((string) ($l['descricao'] ?? $tipo), 0, 120), $valor];
            $caixa += $valor;
            $moedasGanhas += $moedas;
        }

        // Quem o jogo diz que saiu do clube (venda ou fim de contrato) sai também para o servidor.
        $transf = is_array($dados['transferencias'] ?? null) ? $dados['transferencias'] : [];
        foreach (meuElenco($clube, $posse) as $id => $_) {
            if (isset($transf[$id]) && $transf[$id] !== $clube) $posse[$id] = 0;
        }
        // Quem o jogo diz que é do clube precisa ser do clube para o servidor (compra aceita).
        $meus = meuElenco($clube, $posse);
        foreach ($transf as $id => $para) {
            if ($para === $clube && !isset($meus[$id])) unset($dados['transferencias'][$id]);
        }
        // Lendas no elenco da carreira: só as que a conta tem (cada cópia uma vez).
        $tenho = array_map(fn($j) => $j['copias'], array_filter(cartasDoUsuario($eu), fn($j) => $j['tipo'] === 'classico'));
        $usadas = [];
        $noElenco = [];
        foreach ((array) ($dados['noElenco'][$clube] ?? []) as $id) {
            $id = (string) $id;
            if (($usadas[$id] ?? 0) < ($tenho[$id] ?? 0)) {
                $usadas[$id] = ($usadas[$id] ?? 0) + 1;
                $noElenco[] = $id;
            }
        }
        $dados['noElenco'] = [$clube => $noElenco];
        // Contratos abaixo do mínimo voltam ao salário de tabela.
        foreach ($contratosDepois as $id => $k) {
            if (isset($meus[$id]) && (int) ($k['salario'] ?? 0) < salarioMinimo($meus[$id]['geral'])) {
                unset($dados['contratos'][$id]);
            }
        }

        $pdo->prepare('UPDATE times_online SET caixa = ? WHERE usuario_id = ?')->execute([$caixa, $eu]);
        if ($moedasGanhas) $pdo->prepare('UPDATE usuarios SET moedas = moedas + ? WHERE id = ?')->execute([$moedasGanhas, $eu]);
        $ins = $pdo->prepare('INSERT INTO lancamentos (usuario_id, tipo, descricao, valor) VALUES (?, ?, ?, ?)');
        foreach ($aceitos as $a) $ins->execute([$eu, ...$a]);
        $dados['financas']['caixa'] = $caixa;
        $dados['financas']['receitaPorRodada'] = (int) $c['receita'];
        $dados['financas']['bilheteria'] = (int) $c['bilheteria'];
        $pdo->prepare('UPDATE carreiras SET dados = ?, divisao = ?, ano = ?, receita = ?, bilheteria = ?, posse = ?,
                ultima_rodada = ?, ultima_bilheteria = ?, ultimo_salario = ?, ultima_premiacao = ?, ultima_partida = ?, seq = ?,
                desafio_pendente = ?, treinos_dia = ?, treinos_hoje = ?, copas_pagas = ? WHERE usuario_id = ?')
            ->execute([json_encode($dados, JSON_UNESCAPED_UNICODE), $c['divisao'], $c['ano'], $c['receita'],
                $c['bilheteria'], json_encode((object) $posse), $c['ultima_rodada'], $c['ultima_bilheteria'],
                $c['ultimo_salario'], $c['ultima_premiacao'], $c['ultima_partida'], $c['seq'], $c['desafio_pendente'], $c['treinos_dia'],
                $c['treinos_hoje'], json_encode(array_slice($copasPagas, -200)), $eu]);
        $pdo->commit();
        responder(['caixa' => $caixa, 'moedas' => moedasDe($eu), 'seq' => (int) $c['seq'], 'recusados' => $recusados,
            'corrigido' => ($dados['transferencias'] ?? []) !== $transf || ($dados['contratos'] ?? []) !== $contratosDepois]);
    }

    case 'apagar':
        erro('A carreira não pode ser apagada. Para começar outra, crie uma conta nova.', 403);

    default:
        erro('Ação desconhecida.');
}
