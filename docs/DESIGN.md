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

1. Criar o manager: nome do técnico e um clube real da Série A ou B, escolhido uma
   única vez por carreira (feito na prévia). Para trocar de clube, só começando
   uma nova carreira.
2. Entre rodadas: ajustar formação e titulares, negociar no mercado de
   jogadores atuais, abrir pacotes e montar a coleção de lendas.
3. Rodada: todas as partidas são simuladas; a sua é narrada minuto a minuto.
4. Resultados rendem **dinheiro do clube** (bilheteria, premiação) e
   **moedas de coleção** (vitórias, gols, objetivos, títulos).
5. Fim de temporada: premiação, acesso e rebaixamento, saída de quem não
   renovou o contrato, novos objetivos de coleção. (Idade dos jogadores:
   decidido em 25/11/2026 que não entra por enquanto.)

As duas economias são separadas de propósito **[suposição]**: dinheiro do
clube compra jogadores atuais; moedas de coleção compram pacotes de lendas.
Assim um clube pequeno não compra o Pelé com a renda da bilheteria, mas
pode conquistá-lo jogando bem.

### Navegação (prévia feita em 25/11/2026)

O jogo abre num **lobby** com o escudo do clube e o menu principal:
Carreira (com rodada, posição e próximo jogo), Desafios, Online e Coleção.
Cada modo tem uma barra no topo com o botão Menu, o clube e os saldos. A
carreira tem navegação lateral: **Escritório** (próximo jogo, trecho da
tabela, finanças, caixa de entrada com avisos e notícias, destaques do
elenco), Elenco e tática, Partida, Campeonato, Mercado e Finanças. A
Coleção junta estoque e pacotes, mercado de lendas e álbum. No celular a
navegação lateral vira uma faixa rolável.

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

### Partida interativa (prévia feita)

Na carreira e nos desafios o jogo roda minuto a minuto (`PartidaAoVivo`) e o
técnico mexe durante a partida:

- **Tática**: defensiva (defesa +12%, ataque −12%), equilibrada ou ofensiva
  (o contrário). Vale a partir do minuto seguinte.
- **Substituições**: até 5, só com jogadores do banco (12 vagas). Quem sai
  não volta.
- **Cansaço**: a energia cai a partir dos 30 minutos em campo, até 60%;
  quem tem mais físico cansa menos. Quem entra chega descansado.
- O jogo pausa sozinho no intervalo; há pausa manual e "Ir para o fim".
- A partida abre numa **tela única**, em todos os modos (carreira, desafios,
  ranqueado e Amistoso): só placar, narração e painel do técnico, sem o menu
  e os saldos. Depois do apito final, o botão da barra volta para o jogo.
- **Técnico da IA**: fica ofensivo se perde a partir dos 65', defensivo se
  ganha a partir dos 75', e troca o mais cansado aos 60', 70' e 80'.
- Cada decisão é guardada com o minuto. Seed + decisões reproduzem a
  partida exata, o que serve para o servidor do online validar o jogo.

Evoluções previstas: expulsões, pênaltis, lesões, entrosamento (lendas da mesma época/seleção jogando juntas rendem
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
- **Contratos** (prévia feita): cada jogador do seu clube tem salário mensal
  e último ano de contrato. Quem nunca negociou tem salário de tabela e
  contrato até 2026 a 2029 (fixo por jogador). Para **comprar** ou
  **renovar**, você propõe salário e duração (1 a 5 anos). O jogador pede o
  salário de tabela, +4% por ano a mais de contrato, vezes um humor de 0,95
  a 1,20 que muda a cada rodada. Abaixo do pedido ele faz contraproposta;
  abaixo de 80% recusa. No fim da temporada, quem tem contrato terminando
  naquele ano sai de graça para outro clube (a tela do campeonato avisa
  antes de começar a temporada seguinte). A folha usa os salários de
  contrato.
- **Caixa negativo** (prévia feita): juros de 2% da dívida por rodada
  (mínimo R$ 10 mil). Depois de 4 rodadas seguidas no vermelho, o clube
  perde 3 pontos na tabela e a contagem recomeça.
- Depois: empréstimos, IA comprando e vendendo entre si.

## 6b. Séries A e B (prévia feita)

- 40 clubes: os 20 da Série A e os 20 da Série B de 2026, com elencos da
  Wikipédia (`data/elencos-serie-b-2026.txt`, rascunho; São Bernardo veio
  da VAVEL, sem números de camisa). Nível dos clubes da B: 58 a 67.
- As duas divisões jogam juntas, rodada a rodada; a tela do campeonato
  mostra as duas tabelas. Os 4 últimos da A caem e os 4 primeiros da B
  sobem. Não há Série C: quem termina embaixo na B fica na B.
- Na B, TV e patrocínio valem metade e a bilheteria cai 25%; ao subir, as
  receitas voltam a subir na mesma proporção. Premiação em moedas pela
  metade.
- Jogadores da B podem ser comprados no mercado como os da A.

## 6c. Copas nacionais e continentais (feito em 25/11/2026)

- Rodam junto com o campeonato da carreira (`src/engine/copas.ts`, aba
  **Copas**). Mata-mata de jogo único; empate vai para os pênaltis.
- **Copa nacional** do país do técnico (Copa do Brasil, FA Cup, Copa del Rey,
  Coppa Italia, DFB-Pokal...): todos os clubes do país, de todas as
  divisões. Quando o número de clubes não é potência de 2, os mais fracos
  fazem uma fase preliminar e a primeira divisão entra direto. O clube pior
  ranqueado joga em casa.
- **Continental**: Libertadores (Brasil 1º ao 6º e Argentina 1º ao 3º, com
  preliminar) e Champions League (32 clubes de 13 países, pelas zonas de
  `ligas.ts`). O país do técnico classifica pela tabela final da temporada
  anterior; os outros países, que não são simulados, pela força dos clubes.
  Na primeira temporada, todos pela força. Arábia Saudita só tem a nacional.
- As fases ficam espalhadas pela temporada (a data é a rodada da liga depois
  da qual a fase é jogada). O técnico joga o jogo dele antes da rodada
  seguinte; as copas sem ele são simuladas. A temporada só vira depois que
  as copas acabam.
- Prêmios no caixa único: a primeira fase vencida paga R$ 300 mil x fator da
  liga na nacional (R$ 1 mi na Libertadores, R$ 2 mi na Champions), cada fase
  seguinte paga o dobro e a final vencida paga o título junto. Moedas: 50 por
  fase e 1.000 (nacional) ou 2.000 (continental) pelo título.
- Servidor: lançamento `copa` com ref `copa:fase`, pago uma vez por fase em
  cada temporada (`carreiras.copas_pagas`) e com teto pela fase. Como nas
  partidas da liga, o servidor não refaz os jogos.

## 7. Modos de jogo (decidido em 24/11/2026)

**Atualizado em 25/11/2026: o jogo todo é online, sempre com login.** Não
há modo offline. "Online" queria dizer o PvP/ranqueado. Carreira, desafios,
coleção, caixa e moedas ficam na conta, no servidor.

### Conta e caixa único (feito em 25/11/2026)

- Um **caixa só** por conta (`times_online.caixa`) para contratar, pagar
  salários da carreira, jogar desafios e o ranqueado. As **moedas**
  (`usuarios.moedas`) e as **cartas** (`cartas`) também são da conta:
  pacotes, cartas base, mercado de lendas e as lendas levadas ao elenco da
  carreira.
- A carreira fica em `carreiras.dados` (JSON). O motor roda no navegador;
  cada movimento de dinheiro ou moedas vai ao servidor como um lançamento
  numerado (`api/carreira.php`), e o servidor confere antes de aplicar:
  TV e bilheteria com valor fixo e uma vez por rodada; salário não menor
  que a folha do elenco que o servidor sabe que é seu; compra e venda
  dentro do valor de mercado e só de quem é dono do jogador; premiação e
  moedas da temporada uma vez por ano; moedas por partida até 300 por
  rodada; prêmio de desafio só depois de pagar a partida, com no máximo 10
  treinos premiados por dia; lenda de desafio uma vez por desafio. O que
  não passa é recusado e o caixa volta ao valor do servidor.
- Primeira carreira da conta: o caixa ganha o caixa inicial do clube (10%
  do valor do elenco), uma vez só. Nova carreira apaga campeonato e
  elenco, mas não o caixa, as moedas e as cartas.
- Limite da coleção no servidor: 300 lendas, +10 por 1.000 moedas, até 500.
- Limite que continua: o servidor não refaz as partidas, então não sabe se
  o placar é verdadeiro. Os tetos acima limitam o que dá para ganhar.
- A prévia publicada não tem servidor: abre como **demonstração**, com o
  estado só no navegador e o ranqueado desligado.

| Modo | Contra quem | Time usado | Salário e caixa | Recompensa |
| --- | --- | --- | --- | --- |
| **Carreira** (PvE contra a IA) | IA, campeonato completo com tabela | elenco do seu clube + até 3 lendas | sim, por rodada | moedas por partida e por posição |
| **Desafios PvE** | times montados pela IA (ex.: "Seleção de 1970", "só jogadores do Nordeste") | seu time de cartas | sim, por partida | caixa, moedas, pacotes, carta específica |
| **Desafios PvP** | outro técnico, sem ranking (inclui desafio de amigo por convite) | seu time de cartas | sim, por partida | caixa e moedas (menos que no ranqueado) |
| **Ranqueado** (PvP online) | técnico real, por pareamento | seu time de cartas | sim, por partida | caixa, pontos de liga, prêmios de fim de temporada |
| Liga privada (depois) | amigos + IA, temporada completa | clube real, como na carreira | sim | como na carreira |

**Time de cartas** (ranqueado e desafios): o técnico monta um time só com
cartas que tem. **Cartas base** (jogadores atuais) são compradas do sistema
com moedas; **lendas** vêm de pacotes ou do mercado entre técnicos. Vale o
mesmo limite de 3 lendas em campo. **[suposição]** Na carreira, o elenco é
o do clube; as cartas base não entram lá.

### Desafios PvE e time de cartas (prévia feita)

- Ao começar, o técnico ganha um **kit de 16 cartas base** fracas (geral
  58 a 68, todas as posições) e **R$ 2 mi** de caixa no time de cartas.
- **Cartas base** se compram do sistema com moedas (geral 60 = 20, 75 =
  110, 84 = 300) e se vendem de volta por 40% do preço. As lendas do time
  de cartas são as que você tem (estoque e elenco do clube), até 3 em campo.
- **Banco de reservas** com 12 vagas (como no Brasileirão e na Libertadores), no clube e no time de cartas; o resto fica no depósito, fora da tela de formação. Clicar numa carta do campo ou do banco abre a troca por outra do banco ou do depósito.
- **Custo por partida**: um quarto do salário mensal de cada titular;
  lendas cobram o dobro. Sem caixa, o botão mostra quanto falta.
- **7 desafios**, em ordem de força: treino contra os reservas da
  Chapecoense (grátis), Seleção do Nordeste, Flamengo, Seleção do
  Brasileirão, Brasil de 1970, Holanda e Lendas do Milan. Prêmio em caixa
  e moedas pela dificuldade (vitória de R$ 150 mil a R$ 2,5 mi); os três de
  lendas dão uma lenda do adversário na primeira vitória.

### Caixa e salário no online (decidido em 24/11/2026)

O time de cartas também tem **caixa** (em R$, separado das moedas de
pacote) e **salário por partida**:

- **Custo da partida** = salário dos 11 titulares e de quem entrar no
  jogo, um quarto do salário mensal de cada (o mesmo que uma rodada da
  carreira). Cartas base de geral alto custam mais.
- **Lendas cobram cachê por partida** (aprovado): mais caro que um atual
  do mesmo geral (ex.: o dobro), para que escalar 3 lendas seja uma
  escolha de custo, não automática.
- **Sem caixa para o custo, não joga**: o botão de jogar fica bloqueado e o
  jogo mostra quanto falta. Para sair do aperto: escalar cartas mais
  baratas, vender cartas ao sistema ou a outros técnicos, ou jogar os
  desafios PvE de treino, que têm custo zero e pagam pouco.
- **Receitas**: prêmio por partida (vitória paga mais que o custo de um
  time típico da sua divisão; derrota cobre parte), prêmio maior quanto
  mais alta a divisão, e patrocínio diário pequeno ao entrar no jogo.
  Assim um time caro demais para a sua divisão dá prejuízo, e montar o
  time vira gestão de orçamento, como na carreira.
- Os valores exatos se calibram com simulação, como foi feito na carreira
  (receita cobrindo a folha com pequena sobra).

### Ranqueado

Inspirado no sistema de ligas dos jogos competitivos online:

- **Divisões**: Bronze, Prata, Ouro, Platina, Diamante, cada uma com 4
  níveis (IV a I), e acima delas **Elite** (sem níveis, pontos livres) e
  um **Top 100** por pontos. **[suposição: nomes]**
- **Pontos de liga (PDL)**: vitória dá de 12 a 30 e derrota tira de 12 a
  28, conforme o MMR escondido (Elo, K = 32) comparado ao MMR esperado da
  divisão (Bronze IV = 800, +40 por divisão): quem joga acima da divisão
  sobe rápido. Empate não mexe nos pontos (só no MMR). Com 100 PDL sobe;
  abaixo de 0 cai para a divisão de baixo com 75. Bronze IV não cai.
- **Pareamento** pelo MMR, com janela de 100 pontos que abre 20 por
  segundo de espera.
- **Temporada** trimestral (2026 T4, 2027 T1...). Na virada, cada técnico
  desce 4 divisões e o MMR volta metade do caminho até 1000.
- **Prêmio de fim de temporada (feito)**: moedas pela maior divisão
  alcançada na temporada (Bronze 300, Prata 600, Ouro 1.000, Platina
  1.500, Diamante 2.500, Elite 4.000), pago automaticamente no primeiro
  acesso da temporada nova. Ainda falta: classificatórias e carta exclusiva
  de temporada.
- **Custo e prêmio**: ao parear, cada técnico paga o salário dos titulares
  (um quarto do mensal, lendas em dobro) do caixa do time online. Prêmio:
  vitória R$ 800 mil e 60 moedas, empate R$ 400 mil e 25, derrota R$ 200
  mil e 10.
- **Partida em tempo real (feita)**: 90 minutos em 3 minutos de relógio
  (2 s por minuto), começando 8 s depois do pareamento. Cada técnico muda
  a tática e faz até 5 substituições.

### Online: como a partida é sincronizada (feito)

O motor não foi portado para PHP. O servidor é o **juiz do relógio e das
decisões**, e os dois navegadores rodam o mesmo motor determinístico:

1. Ao parear, o servidor guarda a seed, os dois times (cartas, escalação
   e banco) e o horário de início.
2. Cada decisão (tática ou substituição) é gravada com o minuto do
   servidor + 1. Os clientes consultam o servidor a cada segundo e só
   mostram minutos que o servidor já liberou, então uma decisão nunca
   chega "atrasada": os dois veem a mesma partida.
3. No apito final cada cliente relata o placar. Placares iguais encerram a
   partida e mexem nos pontos. Diferentes anulam o jogo e devolvem o
   salário (sinal de trapaça ou de diferença entre navegadores). Se só um
   relatar (o outro fechou a página), vale o relato dele depois de 20 s.
   Sem relato em 2 minutos, a partida é anulada.
4. Quem abandona não perde automaticamente: o time segue em campo sem
   mexidas e o resultado do motor vale. **[mudou do plano: "abandono
   conta como derrota"]**

Limite conhecido: um cliente adulterado que relata sozinho (o outro
abandonou) pode inventar o placar. A proteção completa é portar o motor
para PHP ou rodar um verificador em Node no servidor; fica para a fase do
servidor dedicado.

### Online: o que já existe

- Contas e login (`api/auth.php`), mercado de cartas entre técnicos
  (`api/mercado.php`, ainda sem tela).
- Time de cartas online (`api/online.php`): kit inicial de 16 cartas base,
  R$ 2 mi de caixa, compra e venda de cartas base, pacotes de lendas e
  escalação salva no servidor. Separado da carreira e dos desafios, que
  continuam no navegador.
- Ranqueado (`api/ranqueado.php`): fila, pareamento, partida ao vivo,
  divisões, ranking top 100 e histórico. Tela na aba **Online**.
- **Amistoso entre amigos**: convite pelo nome de técnico, vale 5 minutos.
  Mesma partida ao vivo, só pela diversão: **não cobra salário, não dá
  prêmio e não mexe nos pontos de liga** (decidido em 25/11/2026). Sem
  prêmio, não há o que "farmar" jogando entre duas contas.
- **Contas ligadas**: o navegador guarda um id de aparelho e o servidor
  registra os aparelhos de cada conta. Contas que usaram o mesmo aparelho
  nos últimos 30 dias não são pareadas no ranqueado (evita subir de
  divisão jogando contra a própria conta).
- **Mercado online** (aba Online > Mercado): lendas à venda entre técnicos
  reais, compra pelo preço, proposta, contraproposta, venda ao sistema.
  Cartas base não circulam entre técnicos (o servidor recusa). Carta
  vendida sai da escalação online.
- Falta: as moedas/cartas da carreira contando no online e limite de
  cartas online.

## 8. Plataforma, stack e roteiro

- **Front**: Vite + React + TypeScript, Vitest para o motor, PWA (manifest
  já incluso; falta service worker).
- **Backend**: **PHP 8 + MySQL/MariaDB**, para rodar e testar fácil no
  XAMPP (ver [`XAMPP.md`](XAMPP.md)). API simples em `api/*.php` com PDO;
  schema em `sql/schema.sql` (clubes, jogadores, usuários, cartas, saves);
  importador `scripts/importar.php` carrega os JSON de `data/` no banco.
- **Onde roda a partida**: no modo solo, o motor TypeScript roda no
  navegador (rápido, funciona offline). No modo online, o servidor precisa
  decidir o resultado. Por enquanto os dois navegadores rodam o motor e o
  servidor confere se os placares batem (seção 7). Portar o motor para PHP,
  ou ter um verificador em Node, fecha a brecha do relato solitário.

| Fase | Entrega |
| --- | --- |
| 0 (feito) | Esqueleto: elenco, partida narrada, formato de jogador, base de clássicos |
| 1 | Base de **clubes e elencos atuais** da Série A (rascunho feito: 20 clubes, 720 jogadores); escolher clube (feito); liga com tabela e calendário (prévia feita: 38 rodadas em turno e returno, sua partida narrada e as outras simuladas, classificação com zonas, premiação de fim de temporada e temporada seguinte) |
| 2 | **Coleção de lendas**: moedas, pacotes, cartas, escalar clássicos (prévia feita: estoque, pacote de 5 cartas por 500 moedas, prêmio por partida, até 3 lendas entre os titulares, espaço de 300 cartas ampliável, progresso salvo no navegador) |
| 3 | Carreira completa: mercado de atuais e finanças (prévia feita: compra, venda com propostas da IA, caixa, folha, extrato), temporadas, objetivos, save local |
| 4 | Mais ligas (Série B, Europa), copas (feitas); PWA offline; polimento visual |
| 5 | Modo online: contas (API feita), mercado de cartas entre técnicos (API feita; na prévia, simulado), time de cartas, desafios PvE/PvP, ranqueado com divisões, ligas privadas |

## 9. Perguntas em aberto

1. Elencos atuais: base própria editável com nomes reais (recomendado para
   uso pessoal/gratuito), ou nomes fictícios desde já?
2. Pretende monetizar o jogo um dia? Isso muda a decisão acima e a de
   pacotes.
3. Quais ligas primeiro? Feito: Séries A e B do Brasileirão.
4. Limite de lendas em campo (proposta: 3) e economia separada de moedas.
