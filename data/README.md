# Base de jogadores clássicos

`jogadores.json` tem 301 jogadores aposentados (104 brasileiros, 42 seleções), no formato de `jogador.schema.json` e do tipo `Jogador` em `src/engine/types.ts`.

## Como editar

Não edite o JSON à mão. Edite `jogadores.txt` (uma linha por jogador) e rode:

```
python3 scripts/gerar_jogadores.py
```

O script calcula `id` e `geral`, e falha se houver id repetido, nota fora de 1 a 100, posição ou pé inválido, ou auge fora da época.

Formato da linha:

```
nome|nacionalidade|posicao|pe|inicio|fim|auge|clube|finalizacao passe drible velocidade defesa fisico mentalidade goleiro
```

O `id` é o slug do nome (`Pelé` vira `pele`). Saves e o modo online referenciam por ele, então **não renomeie um jogador existente** sem migrar o id.

## Critérios das notas

As notas representam o jogador **no auge** (campo `auge`), comparado com todos os jogadores de todas as épocas, não só com os da época dele.

| Faixa | Significado |
|---|---|
| 95 a 99 | Entre os melhores da história naquele quesito (ex.: drible do Garrincha, goleiro do Yashin) |
| 90 a 94 | Nível mundial, referência na posição |
| 85 a 89 | Titular de seleção forte, craque de clube grande |
| 75 a 84 | Bom nesse quesito, sem ser o ponto forte |
| 50 a 74 | Ponto fraco ou secundário para a posição |
| 1 a 49 | Quase não usa no jogo (ex.: defesa de centroavante) |

O que cada atributo mede (oito, na ordem do formato):

- **finalizacao**: chute, cabeceio e presença na área.
- **passe**: visão de jogo, lançamento e cruzamento.
- **drible**: condução, controle de bola e um contra um.
- **velocidade**: arranque e velocidade com bola.
- **defesa**: desarme, marcação e posicionamento. Goleiros ficam com 20.
- **fisico**: força, jogo aéreo e resistência.
- **mentalidade**: liderança, frieza e decisão em jogo grande (ex.: Obdulio Varela 99, Beckenbauer 98).
- **goleiro**: só faz sentido para goleiros; jogadores de linha ficam com 10.

Drible e mentalidade foram definidos à mão para cada jogador, não derivados dos outros atributos.

O `geral` é a média ponderada pelos pesos da posição (mesma tabela `PESOS` de `src/engine/ratings.ts` e `scripts/atributos.py`):

| Posição | finalização | passe | drible | velocidade | defesa | físico | mentalidade | goleiro |
|---|---|---|---|---|---|---|---|---|
| GOL | 0 | 0,05 | 0 | 0,05 | 0 | 0,05 | 0,10 | 0,75 |
| ZAG | 0 | 0,10 | 0 | 0,10 | 0,50 | 0,20 | 0,10 | 0 |
| LAT | 0,05 | 0,15 | 0,10 | 0,25 | 0,30 | 0,10 | 0,05 | 0 |
| VOL | 0 | 0,25 | 0,05 | 0,05 | 0,35 | 0,15 | 0,15 | 0 |
| MEI | 0,15 | 0,35 | 0,25 | 0,05 | 0 | 0,05 | 0,15 | 0 |
| ATA | 0,45 | 0,05 | 0,15 | 0,15 | 0 | 0,10 | 0,10 | 0 |

Se mudar os pesos em `ratings.ts`, mude também em `scripts/gerar_jogadores.py`. O arredondamento segue o `Math.round` do JavaScript (0,5 sobe) e gere de novo.

## Suposições e limites

- As notas são **estimativas** feitas a partir da reputação dos jogadores (títulos, prêmios, relatos da época). Não há fonte estatística única para jogadores de antes dos anos 2000, então espere discordância e ajuste à vontade.
- Cada jogador tem **uma posição só**. Jogadores que mudaram de função (Beckenbauer, Falcão, Matthäus, Júnior) ficaram na posição mais marcante.
- **Nacionalidade** usa a seleção da época do auge: `FRG` (Alemanha Ocidental), `URS`, `TCH`, `YUG`. Di Stéfano está como `ARG` e Luis Monti como `ARG`, embora tenham jogado por outras seleções.
- **Datas de carreira** (`epoca`) são aproximadas, ano a ano.
- Ficaram de fora jogadores ainda em atividade em novembro de 2026.
- Os gerais por posição não são perfeitamente equilibrados: atacantes e meias chegam a 95, laterais param em torno de 85. Isso reflete os pesos, e pode ser corrigido nos pesos se o jogo pedir.

## Direitos de nome e imagem

Nomes reais de jogadores são protegidos por direito de imagem, inclusive de jogadores falecidos (os herdeiros têm o direito). Jogos como o Brasfoot contornam isso de formas diferentes. Para uso pessoal ou um protótipo não há problema prático, mas antes de publicar ou monetizar o jogo é preciso escolher entre:

1. Licenciar os nomes (caro; normalmente via sindicatos de atletas ou FIFPro).
2. Usar nomes alterados (ex.: "Pelé" vira "Pelê") e deixar o jogador editar.
3. Publicar só com jogadores fictícios e permitir que o usuário importe um arquivo de base próprio (é o caminho mais usado por jogos independentes).

Escudos, nomes de clubes e fotos têm o mesmo problema. Este arquivo não traz nenhuma imagem.
