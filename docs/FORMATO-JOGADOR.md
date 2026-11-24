# Formato de jogador

Combinado com a frente que monta a base de jogadores clássicos. A base vai
em `data/jogadores.json` (array de jogadores), com schema em
`data/jogador.schema.json` e a fórmula do geral em `data/README.md`.
O tipo TypeScript correspondente é `Jogador` em `src/engine/types.ts`.

```json
{
  "id": "pele",
  "nome": "Pelé",
  "nomeCompleto": "Edson Arantes do Nascimento",
  "nacionalidade": "BRA",
  "posicao": "ATA",
  "pe": "A",
  "epoca": { "inicio": 1956, "fim": 1977 },
  "auge": 1970,
  "clubeMarcante": "Santos",
  "atributos": {
    "ataque": 98, "defesa": 45, "passe": 92,
    "velocidade": 90, "fisico": 84, "goleiro": 10
  },
  "geral": 94
}
```

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | string | slug único e **estável** (saves e online referenciam por ele) |
| `nome` | string | nome de exibição |
| `nomeCompleto` | string? | opcional |
| `nacionalidade` | string | código FIFA de 3 letras |
| `posicao` | enum | `GOL`, `ZAG`, `LAT`, `VOL`, `MEI`, `ATA` |
| `pe` | enum | `D` direito, `E` esquerdo, `A` ambidestro |
| `epoca` | objeto | anos de início e fim da carreira |
| `auge` | inteiro | ano da versão usada no jogo |
| `clubeMarcante` | string? | clube mais associado |
| `atributos` | objeto | seis inteiros de 1 a 100 |
| `geral` | inteiro | 1 a 100, média ponderada pela posição |

Enquanto a base não chega, `src/data/exemplo.ts` tem 34 jogadores de exemplo
nesse mesmo formato, com atributos estimados à mão.
