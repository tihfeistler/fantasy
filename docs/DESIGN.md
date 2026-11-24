# Fantasy: documento de design (v0.2)

Gerenciador de futebol para navegador, focado em PC, que mistura duas ideias:

- **Carreira estilo gerenciador rápido**: você assume um clube real da
  temporada atual, com o **elenco atual**, e disputa ligas e copas com todos
  os outros clubes, também com seus elencos atuais.
- **Coleção de lendas estilo "ultimate team"**: ao longo da carreira você
  conquista **cartas de jogadores clássicos** (Pelé 1970, Cruyff 1974...) e
  pode escalá-los no seu time ao lado dos jogadores atuais.

O jogo é original: não reaproveita nome, arte, telas ou dados de outros
jogos do gênero.

Itens marcados com **[suposição]** são decisões minhas que ainda precisam
de confirmação. As perguntas em aberto estão na seção 9.

## 1. Loop de jogo

1. Criar o manager: nome do técnico e um clube real da Série A, escolhido uma
   única vez por carreira (feito na prévia). Para trocar de clube, só começando
   uma nova carreira.
2. Entre rodadas: ajustar formação e titulares, negociar no mercado de
   jogadores atuais, abrir pacotes e montar a coleção de lendas.
3. Rodada: todas as partidas são simuladas; a sua é narrada minuto a minuto.
4. Resultados rendem **dinheiro do clube** (bilheteria, premiação) e
   **moedas de coleção** (vitórias, gols, objetivos, títulos).
5. Fim de temporada: premiação, renovação de contratos, jogadores atuais
   envelhecem, novos objetivos de coleção.

As duas economias são separadas de propósito **[suposição]**: dinheiro do
clube compra jogadores atuais; moedas de coleção compram pacotes de lendas.
Assim um clube pequeno não compra o Pelé com a renda da bilheteria, mas
pode conquistá-lo jogando bem.

## 2. Jogadores atuais e jogadores clássicos

Os dois tipos usam o **mesmo formato** e o mesmo motor de partida
(ver [`FORMATO-JOGADOR.md`](FORMATO-JOGADOR.md)). A diferença:

| | Atual | Clássico (carta) |
| --- | --- | --- |
| Origem | base da temporada, já num clube | pacotes, objetivos, mercado de cartas |
| Idade | real, envelhece e evolui/declina | fixa no auge, não envelhece |
| Contrato e salário | sim | sem salário; a carta é sua |
| Atributos | da base da temporada | do auge, fixos |
| Raridade | não tem | bronze, prata, ouro, ícone (pelo geral) |

Limite de lendas em campo: no máximo 3 clássicos entre os titulares, para
o elenco atual continuar importando. No elenco e no estoque não há limite
de lendas, mas há um **espaço total de cartas** (estoque + lendas no
elenco): começa em 300 e pode ser ampliado de 10 em 10 por 1.000 moedas, até
500. Sem espaço para um pacote, é preciso vender cartas ou ampliar.

Posições simples (GOL, ZAG, LAT, VOL, MEI, ATA), oito atributos de 1 a 100
(finalização, passe, drible, velocidade, defesa, físico, mentalidade,
goleiro) e um **geral** ponderado pela posição (`src/engine/ratings.ts`). Jogador fora
de posição rende 90% (50% quando envolve o gol).

## 3. De onde vêm os elencos atuais

Este é o ponto mais delicado do projeto. Opções:

| Opção | Como funciona | Prós | Contras |
| --- | --- | --- | --- |
| **A. Base própria editável** | o jogo lê um arquivo de dados (clubes, elencos, atributos) no nosso formato; montamos a primeira versão a partir de informações públicas e qualquer um pode editar/importar uma base atualizada | gratuito, controle total, é o modelo dos gerenciadores rápidos com "atualizações de elenco" | dá trabalho manter atualizado a cada janela de transferência |
| B. API de dados esportivos paga | serviços de dados de futebol fornecem elencos por API | sempre atualizado, automático | custo mensal; normalmente traz elenco e estatísticas, **não** atributos de jogo, que teríamos de calcular |
| C. Nomes fictícios parecidos | jogadores com nomes alterados | zero risco de licença | perde muito da graça |

**Recomendação: A**, com um importador que aceite bases novas. Atributos
(ataque, defesa...) são sempre nossos: nenhuma fonte entrega isso pronto,
então vamos derivá-los de dados públicos (posição, idade, nível do clube)
mais ajuste manual.

**Risco de licença**: nomes e imagem de jogadores e escudos/nomes de clubes
são protegidos (direito de imagem, marcas). Para um projeto pessoal e
gratuito o risco é baixo. **Se o jogo for monetizado** (venda, anúncios,
pacotes pagos), é preciso licenciar ou trocar por nomes fictícios. Por isso:
sem escudos oficiais (usamos cores e siglas), e a base de dados fica num
arquivo separado do código, fácil de trocar.

## 4. Como os clássicos entram

- **Pacotes** comprados com moedas de coleção (ganhas jogando). Cada pacote
  mostra as chances de cada raridade. **Sem dinheiro real [suposição]**:
  pacotes pagos com dinheiro real são caixa de recompensa, regulada ou
  proibida em alguns países, e complicam muito o projeto.
- **Objetivos**: "vença o clássico estadual", "marque 50 gols na temporada",
  "seja campeão" rendem pacotes ou uma lenda específica.
- **Desafios de montagem**: troque várias cartas repetidas ou fracas por uma
  carta melhor.
- **Mercado de cartas entre técnicos**: a outra forma de conseguir lendas
  (ver abaixo).
- Cartas repetidas viram moedas.

### Regras do mercado (decididas)

| Carta | Do sistema | Entre técnicos | Vender ao sistema |
| --- | --- | --- | --- |
| **Base** (jogador atual) | compra direto do clube dono, preço por oferta e procura (seção 6) | não, por enquanto | proposta da IA de um clube (seção 6) |
| **Especial** (lenda) | **não**: só pacotes ou outros técnicos | sim: anúncio com preço fixo ou proposta | sim, pelo **preço básico** (comum 100, rara 200, ícone 400; -15% por cópia repetida, até a metade) |

Mercado entre técnicos (moedas de coleção):

- **Quem quer vender anuncia** a carta com o preço que quiser (10 a
  1.000.000). A carta fica fora do estoque enquanto anunciada e pode ser
  retirada a qualquer momento.
- **Quem quer comprar** paga o preço anunciado ou **manda uma proposta** por
  qualquer carta de outro técnico (anunciada ou não). O dono aceita ou
  recusa, ou **faz uma contraproposta** com um valor maior; aí quem decide
  é o comprador (aceita ou recusa). Proposta não reserva moedas; se o comprador não tiver saldo na
  hora do aceite, a venda falha. Uma proposta nova do mesmo técnico pela
  mesma carta substitui a anterior; quando a carta muda de dono, as outras
  propostas expiram.
- **Taxa de 5%** sobre a venda, paga pelo vendedor: tira moedas de
  circulação e desestimula revenda em ciclo.
- Preço de referência mostrado como guia (comum 150 a 300, rara 450 a 800,
  ícone a partir de 1.800, subindo com o geral). Futuro: usar a média das
  últimas vendas reais (tabela `vendas`).

Implementação:

- **Online**: `api/auth.php` (conta com nome e senha, login por sessão PHP)
  e `api/mercado.php` (anúncios, compra, propostas, aceitar/recusar, venda
  ao sistema), com transações e `SELECT ... FOR UPDATE` para não vender a
  mesma carta duas vezes. Tabelas `anuncios`, `propostas` e `vendas` em
  `sql/schema.sql`.
- **Prévia (sem servidor)**: os outros técnicos são **simulados** e a tela
  avisa isso. A cada rodada eles anunciam cartas, compram as suas (quanto
  mais barato em relação à referência, mais rápido) e mandam propostas.
  Às suas propostas respondem na hora: aceitam a partir de 90% do preço,
  fazem contraproposta de 60% a 90% (meio caminho até o preço, no mínimo
  90% dele) e recusam abaixo de 60%. Cada proposta que eles mandam tem um
  teto escondido (8% a 30% acima): sua contraproposta até o teto fecha o
  negócio; acima, eles desistem.

## 5. Simulação de partidas

Motor em TypeScript puro, sem dependência de interface
(`src/engine/match.ts`), para rodar igual no navegador e no servidor.

- Força por setor (goleiro, defesa, meio, ataque) calculada da escalação.
- A cada minuto: o meio-campo decide quem tem o lance; ataque x defesa
  decide se vira chance; finalizador x goleiro decide se vira gol.
- Vantagem de mando: +6% nas forças do mandante.
- **Determinístico por seed**: mesma seed, mesma partida. O servidor do modo
  online pode ser a fonte da verdade e o cliente só "replaya".
- Calibragem atual (2 times de exemplo, 5.000 jogos): ~2,9 gols por jogo,
  39% vitória do mandante, 24% empates.

Evoluções previstas: táticas, substituições, expulsões, pênaltis, lesões,
cansaço, entrosamento (lendas da mesma época/seleção jogando juntas rendem
um pouco mais **[suposição]**).

## 6. Mercado de jogadores atuais

- **Oferta e procura** (prévia feita): o preço pedido e as propostas
  variam entre 0,85x e 1,2x conforme quantos jogadores da mesma posição e
  nível (geral ±2) existem na liga: muitos parecidos barateiam, raros
  encarecem. Clube com sobra na posição vende 15% mais barato; com
  carência, cobra 20% a mais (e paga 10% a mais nas propostas).
- Cartas de lenda repetidas valem menos na venda: cada cópia a mais tira
  15%, até a metade do valor.
- Valor de mercado derivado do geral (dobra a cada 5 pontos: geral 60 vale
  R$ 2 mi, 80 vale R$ 32 mi). Idade e potencial entram quando a base tiver
  datas de nascimento. Salário mensal de 1% do valor.
- **Compra** (prévia feita): qualquer jogador de outro clube, por 20% acima
  do valor (60% acima se for um dos 3 melhores do clube). O clube não vende
  se ficar com menos de 18; seu elenco vai até 45 jogadores atuais.
- **Venda** (prévia feita): cada jogador seu recebe uma proposta da IA por
  rodada, de 75% a 105% do valor, de um clube do nível dele.
  Dá para **negociar** uma vez por rodada: o clube aceita até um teto
  escondido (5% a 25% acima da proposta); se recusar, a proposta original
  continua até o fim da rodada.
- **Finanças** (prévia feita): caixa inicial de 10% do valor do elenco; por
  rodada entram TV/patrocínio (75% de um quarto da folha) e bilheteria nos
  jogos em casa, e saem os salários. Premiação em dinheiro pela posição.
- Depois: empréstimos, contratos com duração, negociação de valor, IA
  comprando e vendendo entre si.

## 7. Modo online

Fase posterior:

- Ligas privadas com amigos, completadas pela IA.
- Rodadas em horário fixo ou quando todos confirmam.
- Servidor autoritativo roda as partidas (ver seção 8 sobre o motor em PHP).
- Mercado de cartas entre técnicos (backend feito: contas, anúncios, propostas; falta ligar o front ao servidor).
- Mercado de jogadores atuais entre técnicos da mesma liga.

## 8. Plataforma, stack e roteiro

- **Front**: Vite + React + TypeScript, Vitest para o motor, PWA (manifest
  já incluso; falta service worker).
- **Backend**: **PHP 8 + MySQL/MariaDB**, para rodar e testar fácil no
  XAMPP (ver [`XAMPP.md`](XAMPP.md)). API simples em `api/*.php` com PDO;
  schema em `sql/schema.sql` (clubes, jogadores, usuários, cartas, saves);
  importador `scripts/importar.php` carrega os JSON de `data/` no banco.
- **Onde roda a partida**: no modo solo, o motor TypeScript roda no
  navegador (rápido, funciona offline). No modo online, o servidor precisa
  decidir o resultado para ninguém trapacear, então o motor será **portado
  para PHP**, com testes que garantem que a mesma seed dá o mesmo placar nas
  duas versões. **[suposição]** A alternativa seria trocar o backend para
  Node e reaproveitar o motor sem portar, mas isso tira a facilidade do XAMPP.

| Fase | Entrega |
| --- | --- |
| 0 (feito) | Esqueleto: elenco, partida narrada, formato de jogador, base de clássicos |
| 1 | Base de **clubes e elencos atuais** da Série A (rascunho feito: 20 clubes, 720 jogadores); escolher clube (feito); liga com tabela e calendário (prévia feita: 38 rodadas em turno e returno, sua partida narrada e as outras simuladas, classificação com zonas, premiação de fim de temporada e temporada seguinte) |
| 2 | **Coleção de lendas**: moedas, pacotes, cartas, escalar clássicos (prévia feita: estoque, pacote de 5 cartas por 500 moedas, prêmio por partida, até 3 lendas entre os titulares, espaço de 300 cartas ampliável, progresso salvo no navegador) |
| 3 | Carreira completa: mercado de atuais e finanças (prévia feita: compra, venda com propostas da IA, caixa, folha, extrato), temporadas, objetivos, save local |
| 4 | Mais ligas (Série B, Europa), copas; PWA offline; polimento visual |
| 5 | Modo online: contas (API feita), ligas privadas, mercado de cartas entre técnicos (API feita; na prévia, simulado) |

## 9. Perguntas em aberto

1. Elencos atuais: base própria editável com nomes reais (recomendado para
   uso pessoal/gratuito), ou nomes fictícios desde já?
2. Pretende monetizar o jogo um dia? Isso muda a decisão acima e a de
   pacotes.
3. Quais ligas primeiro? Proposta: Série A do Brasileirão.
4. Limite de lendas em campo (proposta: 3) e economia separada de moedas.
