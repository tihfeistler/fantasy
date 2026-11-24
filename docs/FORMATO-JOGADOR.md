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
    "finalizacao": 98, "passe": 94, "drible": 95, "velocidade": 89,
    "defesa": 45, "fisico": 84, "mentalidade": 98, "goleiro": 15
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
| `atributos` | objeto | oito inteiros de 1 a 100 (tabela abaixo) |
| `geral` | inteiro | 1 a 100, média ponderada pela posição |

### Atributos e geral

| Atributo | O que mede |
| --- | --- |
| `finalizacao` | chute, cabeceio, frieza na área |
| `passe` | passe curto e longo, cruzamento, visão |
| `drible` | condução, controle, um contra um |
| `velocidade` | arranque e velocidade final |
| `defesa` | marcação, desarme, posicionamento |
| `fisico` | força, resistência, jogo aéreo |
| `mentalidade` | liderança, decisão, frieza em jogo grande |
| `goleiro` | reflexo, colocação, saída do gol |

O `geral` é a média ponderada dos atributos com os pesos da posição
(`src/engine/ratings.ts` e `scripts/atributos.py`, mesma tabela):

| Pos | Pesos |
| --- | --- |
| GOL | goleiro 75%, mentalidade 10%, físico 5%, passe 5%, velocidade 5% |
| ZAG | defesa 50%, físico 20%, mentalidade 10%, velocidade 10%, passe 10% |
| LAT | defesa 30%, velocidade 25%, passe 15%, drible 10%, físico 10%, mentalidade 5%, finalização 5% |
| VOL | defesa 35%, passe 25%, físico 15%, mentalidade 15%, drible 5%, velocidade 5% |
| MEI | passe 35%, drible 25%, finalização 15%, mentalidade 15%, velocidade 5%, físico 5% |
| ATA | finalização 45%, drible 15%, velocidade 15%, físico 10%, mentalidade 10%, passe 5% |

Arquivos no formato antigo (6 atributos com `ataque`) podem ser convertidos
com `python3 scripts/converter_atributos.py data/jogadores.json`.

Enquanto a base não chega, `src/data/exemplo.ts` tem 34 jogadores de exemplo
nesse mesmo formato, com atributos estimados à mão.

## Extensão para jogadores atuais (proposta)

Jogadores atuais usam o mesmo formato, com estes campos a mais (todos
opcionais, então a base de clássicos continua válida sem mudança):

| Campo | Tipo | Regra |
| --- | --- | --- |
| `tipo` | enum | `"classico"` (padrão se ausente) ou `"atual"` |
| `nascimento` | string | data `AAAA-MM-DD`, só para atuais (idade e declínio) |
| `clubeId` | string | id do clube na temporada, só para atuais |
| `potencial` | inteiro | 1-100, teto de evolução, só para atuais |

Para atuais, `auge` e `epoca` podem ficar ausentes. A raridade da carta dos
clássicos é derivada do `geral` (ex.: ícone 90+, ouro 80+, prata 70+,
bronze abaixo), então não precisa de campo.

Clubes ficarão em `data/clubes.json`:

```json
{ "id": "flamengo", "nome": "Flamengo", "sigla": "FLA", "cor": "#c8102e",
  "corSecundaria": "#000000", "liga": "brasileirao-a", "nivel": 85 }
```

## Elencos atuais da Série A 2026 (rascunho)

- `data/elencos-2026.txt`: elencos dos 20 clubes, lidos das seções de elenco
  da Wikipédia em 24/11/2026. As datas dos elencos vão de julho a outubro de
  2026 (anotadas no arquivo por clube), então transferências recentes podem
  faltar. As fontes só dão posição genérica (goleiro, defensor, meia,
  atacante); a posição fina vem da numeração ou da 6ª coluna.
- `data/destaques-2026.txt`: geral alvo dos jogadores mais conhecidos.
- `scripts/gerar_atuais.py` gera `data/atuais.json`. Os demais atributos
  vêm do nível do clube, do papel no elenco e de uma variação fixa.
- O `id` de um jogador atual é `nome-clube` (ex.: `neymar-santos`): fica
  fixo mesmo se ele mudar de clube e nunca colide com os ids dos clássicos.

Para corrigir um jogador: edite o `.txt` (posição na 6ª coluna, geral na
7ª) ou o arquivo de destaques e rode
`python3 scripts/gerar_atuais.py && php scripts/importar.php`.
