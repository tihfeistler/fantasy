# Fantasy: documento de design (v0.1)

Gerenciador de futebol para navegador, focado em PC, no espírito dos
gerenciadores clássicos, mas com um diferencial: os elencos são formados por
**jogadores clássicos**, cada um na versão do seu auge (ex.: Pelé 1970,
Cruyff 1974). O jogo é original: não reaproveita nome, arte, telas ou dados
de outros jogos do gênero.

Itens marcados com **[suposição]** são decisões minhas que ainda precisam
de confirmação.

## 1. Loop de jogo

1. O jogador assume um clube numa liga (temporada com turno e returno).
2. Entre rodadas: ajusta elenco, formação e titulares; negocia no mercado.
3. Rodada: as partidas são simuladas; a do usuário é narrada minuto a minuto.
4. Fim de temporada: premiação, receitas, envelhecimento/aposentadoria,
   novos jogadores entram no mercado.

Ritmo: uma rodada leva poucos minutos, como nos gerenciadores rápidos, e não
horas como num simulador detalhado. **[suposição]**

## 2. Elenco e jogadores

- Elenco de 18 a 30 jogadores; 11 titulares + formação.
- Posições simples: GOL, ZAG, LAT, VOL, MEI, ATA.
- Seis atributos de 1 a 100: ataque, defesa, passe, velocidade, físico,
  goleiro. O **geral** é uma média ponderada pelos pesos da posição
  (`src/engine/ratings.ts`).
- Jogador fora de posição rende menos (90% da força na posição nova; 50%
  quando envolve o gol).
- Formato completo dos dados: [`FORMATO-JOGADOR.md`](FORMATO-JOGADOR.md).

Próximos passos do elenco: moral, condição física, lesões, suspensões por
cartões, evolução/declínio ao longo das temporadas. **[suposição]** Como os
jogadores são lendas, o auge é fixo e a "idade" no jogo serve só para
contrato e declínio.

## 3. Simulação de partidas

Motor em TypeScript puro, sem dependência de interface
(`src/engine/match.ts`), para rodar igual no navegador e no servidor.

- Força por setor (goleiro, defesa, meio, ataque) calculada da escalação.
- A cada minuto: o meio-campo decide quem tem o lance; ataque x defesa
  decide se vira chance; finalizador x goleiro decide se vira gol.
- Vantagem de mando: +6% nas forças do mandante.
- **Determinístico por seed**: mesma seed, mesma partida. Isso permite que o
  servidor do modo online seja a fonte da verdade e que o cliente só "replaye".
- Calibragem atual (2 times de exemplo, 5.000 jogos): ~2,9 gols por jogo,
  39% vitória do mandante, 24% empates. Os testes travam a média entre 2 e 3,5.

Evoluções previstas: táticas (pressão, contra-ataque), substituições,
expulsões, pênaltis, lesões em jogo, cansaço.

## 4. Mercado

- Cada jogador tem valor de mercado derivado do geral e da raridade.
- Compra, venda, empréstimo; propostas da IA para os seus jogadores.
- **Cada lenda existe uma única vez por liga** (não pode haver dois Pelés no
  mesmo universo). No online, isso vira disputa entre os técnicos. **[suposição]**
- Orçamento: bilheteria, patrocínio e premiação. Folha salarial limita o elenco.

## 5. Modo online

Fase posterior. Proposta:

- Ligas privadas com amigos (8 a 20 técnicos), completadas por IA.
- Rodadas em horário fixo (ex.: uma por dia) ou quando todos confirmam.
- Servidor autoritativo: guarda o estado da liga, roda as partidas com o
  mesmo motor e envia o resultado com a seed.
- Mercado com leilão/propostas entre técnicos.
- Stack sugerida: Node + PostgreSQL (ou Supabase para acelerar login e
  banco). **[suposição]** A decidir quando chegarmos lá.

## 6. Plataforma e stack

- **Vite + React + TypeScript**: rápido para desenvolver, roda em qualquer
  navegador de PC e vira PWA com pouco esforço.
- **Vitest** para testar o motor.
- PWA: já há `manifest.webmanifest`; falta service worker e ícones para
  instalar e jogar offline o modo carreira. **[suposição]** Um empacotamento
  desktop (Tauri/Electron) pode vir depois, se fizer falta.
- Save local do modo carreira em IndexedDB.

## 7. Roteiro

| Fase | Entrega |
| --- | --- |
| 0 (este PR) | Esqueleto: tela de elenco, partida simulada narrada, formato de jogador |
| 1 | Integrar `data/jogadores.json`; criar clubes; liga com tabela e calendário |
| 2 | Modo carreira completo: mercado, finanças, temporadas, save local |
| 3 | PWA instalável e offline; polimento visual |
| 4 | Modo online: contas, ligas privadas, servidor de partidas |

## 8. Riscos

- **Nomes de jogadores reais**: usar nome de pessoas reais em jogo comercial
  pode exigir licença (direito de imagem). Para um projeto pessoal/gratuito
  o risco é menor; se for monetizar, avaliar apelidos ou licenciamento.
- **Atributos de lendas** são subjetivos; vale ter um arquivo de dados fácil
  de ajustar e um processo de revisão.
