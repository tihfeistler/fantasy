<?php
// Estádios: bilheteria e fator casa. Mesmas contas de src/engine/estadios.ts; se mudar uma, mude a outra.
declare(strict_types=1);

/** Torcedores num jogo comum: lotação de 45% a 95%, conforme a atmosfera. */
function publicoMedio(int $capacidade, int $atmosfera): int
{
    return (int) round($capacidade * (0.45 + 0.5 * ($atmosfera / 100)));
}

/** Multiplica a bilheteria base: 0,8 (estádio pequeno e vazio) a 1,3 (gigante e lotado). */
function fatorBilheteria(int $capacidade, int $atmosfera, int $qualidade): float
{
    $renda = publicoMedio($capacidade, $atmosfera) * (0.6 + 0.8 * ($qualidade / 100));
    $t = min(1, max(0, log($renda / 3000) / log(50000 / 3000)));
    return round(0.8 + 0.5 * $t, 3);
}
