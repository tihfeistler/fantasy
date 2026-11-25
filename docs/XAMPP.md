# Rodar o Fantasy no XAMPP

O jogo tem duas partes:

- **Front** (telas e motor de partidas): React + TypeScript, compilado para
  HTML/JS estático.
- **API** (`api/*.php`) + **banco MySQL/MariaDB** (`sql/schema.sql`): guarda
  jogadores, clubes e, mais adiante, contas, cartas e saves.

## 1. Preparar (uma vez)

1. Instale o [XAMPP](https://www.apachefriends.org/) (PHP 8.1 ou mais novo)
   e o [Node.js](https://nodejs.org/) 20 ou mais novo.
2. Clone o repositório **dentro do htdocs**, na pasta `fantasy`:
   ```
   cd C:\xampp\htdocs
   git clone https://github.com/tihfeistler/fantasy
   ```
3. No painel do XAMPP, ligue **Apache** e **MySQL**.
4. Crie o banco: abra http://localhost/phpmyadmin, aba **Importar**, escolha
   `sql/schema.sql` e clique em Executar. (Ou pela linha de comando:
   `C:\xampp\mysql\bin\mysql -u root < sql\schema.sql`.)
5. Importe os jogadores de `data/jogadores.json` (e `data/clubes.json`,
   quando existir):
   ```
   cd C:\xampp\htdocs\fantasy
   C:\xampp\php\php.exe scripts\importar.php
   ```
   Pode rodar de novo sempre que os arquivos de dados mudarem.
6. Instale as dependências do front: `npm install`.

Se o seu MySQL tiver senha ou outra porta, crie `api/config.local.php`:

```php
<?php return ['db_usuario' => 'root', 'db_senha' => 'minhasenha'];
```

Teste a API: http://localhost/fantasy/api/jogadores.php deve mostrar a lista
em JSON.

Já tinha o banco de uma versão anterior? Rode `sql/schema.sql` de novo no
phpMyAdmin: ele só cria as tabelas que faltam (`anuncios`, `propostas`,
`vendas`).

### Testar o mercado de cartas pela API

O mercado entre técnicos exige login. Com o Apache rodando, no terminal
(`curl` já vem no Windows 10+):

```bash
# cria duas contas (o cookie guarda a sessão de cada uma)
curl -c a.txt -b a.txt -H "Content-Type: application/json" -d "{\"acao\":\"registrar\",\"nome\":\"Tiago\",\"senha\":\"segredo1\"}" http://localhost/fantasy/api/auth.php
curl -c b.txt -b b.txt -H "Content-Type: application/json" -d "{\"acao\":\"registrar\",\"nome\":\"Rafa\",\"senha\":\"segredo2\"}" http://localhost/fantasy/api/auth.php
```

Dê uma carta para a primeira conta no phpMyAdmin
(`INSERT INTO cartas (usuario_id, jogador_id, origem) VALUES (1, 'pele', 'pacote')`)
e use as ações de `api/mercado.php` (lista completa no topo do arquivo):
`anunciar`, `comprar`, `propor`, `aceitar`, `recusar`, `vender_sistema`.

## 2. Jogar / desenvolver

**Modo desenvolvimento** (recarrega sozinho ao editar o código):

```
npm run dev
```

Abra http://localhost:5173. As chamadas para `/api` são repassadas ao
Apache em `http://localhost/fantasy` (configurado em `vite.config.ts`; mude
lá se usar outra pasta).

**Modo "publicado" no Apache**:

```
npm run build
```

Abra http://localhost/fantasy/dist/. O build usa caminhos relativos e
chama a API em `../api/`.

## 3. Testar o ranqueado online com duas contas

O ranqueado precisa do Apache e do MySQL ligados e do front servido pelo
Apache ou pelo `npm run dev` (a prévia sem servidor não tem modo online).

1. **Atualize o banco**: no phpMyAdmin, importe `sql/schema.sql` de novo.
   Ele cria as tabelas novas (`times_online`, `ranqueado`, `fila`,
   `partidas_online`, `decisoes_online`, `convites`, `dispositivos`) e não apaga nada.
2. **Importe os jogadores** se ainda não fez (passo 1.5): o kit inicial e a
   loja usam os jogadores atuais do banco, e os pacotes usam as lendas.
3. Rode `npm run build` e abra http://localhost/fantasy/dist/ (ou use
   `npm run dev` e http://localhost:5173).
4. **Abra duas sessões separadas**, porque o login fica num cookie do
   navegador: uma janela normal e uma **janela anônima** (ou Chrome e
   Edge). Em cada uma, comece uma carreira qualquer para entrar no jogo.
5. Nas duas, abra a aba **Online**, clique em *Não tenho conta* e crie
   técnicos diferentes (ex.: "Tiago" e "Teste"). Cada conta ganha R$ 2 mi
   de caixa, 1.500 moedas e 16 cartas base, já escaladas.
6. Clique em **Procurar partida** nas duas. Em poucos segundos o servidor
   pareia as contas e a partida começa (8 s de contagem, depois 3 minutos
   de jogo).
7. Durante o jogo, mude a tática e faça substituições numa janela: a
   mudança aparece na narração das duas janelas no mesmo minuto.
8. No fim, as duas mostram o mesmo placar, os pontos de liga e o prêmio.
   Voltando ao ranqueado, o ranking e *Seus últimos jogos* já mostram a
   partida.

Também dá para testar com as duas contas:

- **Amistoso**: em *Ranqueado*, digite o nome da outra conta em "Amistoso
  com um amigo" e clique em Convidar. Na outra janela o convite aparece em
  até 3 s; ao aceitar, a partida começa nas duas. O amistoso não cobra
  salário, não dá prêmio nem pontos de liga.
- **Contas no mesmo aparelho**: duas contas usadas na mesma janela (sem
  ser anônima) ficam ligadas e não se enfrentam no ranqueado. Para testar o
  ranqueado, use sempre janela normal + anônima, ou dois navegadores.
- **Mercado**: numa conta, abra um pacote (aba *Cartas*), vá em *Mercado >
  Minhas lendas* e anuncie uma lenda. Na outra, em *Mercado > À venda*,
  compre ou faça uma proposta; a primeira conta responde em *Propostas*
  (aceitar, recusar ou contraproposta).
- **Prêmio de fim de temporada**: para simular a virada, no phpMyAdmin
  mude a coluna `temporada` das linhas de `ranqueado` para a anterior (ex.:
  20264 vira 20263). No próximo acesso, a conta recebe as moedas pela maior
  divisão e começa a temporada nova 4 divisões abaixo.

Dicas:

- Para testar mais rápido, acelere o relógio em `api/config.local.php`:
  `'seg_por_minuto' => 0.5` faz o jogo durar 45 s.
- A aba *Cartas* abre pacotes de lendas (500 moedas) e compra cartas base;
  *Meu time* salva a escalação no servidor.
- Se uma janela for fechada no meio do jogo, a outra continua e o placar
  dela vale 20 s depois do apito final.
- Para recomeçar do zero: `DELETE FROM usuarios;` no phpMyAdmin apaga as
  contas e tudo ligado a elas.

## 4. Problemas comuns

- *"Não consegui falar com a API PHP"* na aba Lendas: Apache ou MySQL
  desligado, banco não criado ou importador não rodado.
- Erro 500 na API: veja `C:\xampp\apache\logs\error.log`.
- Porta 80 ocupada (Skype/IIS): mude a porta do Apache no XAMPP e ajuste
  `API_XAMPP` em `vite.config.ts`.

## Atualização de 25/11/2026: jogo na conta

O jogo agora abre pedindo login, e a carreira fica salva na conta. Importe
`sql/schema.sql` de novo (cria as tabelas `carreiras` e `lancamentos` e
adiciona colunas novas) e rode `php scripts/importar.php` para trazer os 20
clubes da Série B.


## Atualização de 25/11/2026 (testes de ponta a ponta)

- Importe `sql/schema.sql` de novo: ele adiciona a coluna `propostas.vendedor_id`.
- O login agora dura 30 dias (antes caía ao fechar o navegador).
- Conta nova já vem com o time de cartas escalado no 4-4-2 e pode procurar
  partida no ranqueado direto.
- Comprar lenda no mercado respeita o limite da coleção (300, ampliável até 500).

## Atualização de 25/11/2026 (ligas estrangeiras e divisões de baixo)

O jogo agora tem 16 países e 36 divisões: Brasil (Séries A a D) e Inglaterra
(Premier League a League Two) até a 4ª divisão; Espanha, Itália, Alemanha,
França, Portugal, Holanda, Bélgica, Argentina, Arábia Saudita, Noruega,
Dinamarca, Escócia, Áustria e Sérvia com 1ª e 2ª divisão. São 638 clubes e
18.197 jogadores atuais, mais 85 lendas estrangeiras novas. Em cada país há
acesso e rebaixamento entre todas as divisões. Para atualizar uma instalação
que já existe:

1. Baixe a versão nova (`git pull` na pasta do projeto, dentro de
   `C:\xampp\htdocs\fantasy`).
2. Com o Apache e o MySQL ligados no XAMPP, rode na pasta do projeto:

   ```
   C:\xampp\php\php.exe scripts\importar.php
   ```

   Ele importa os clubes e jogadores novos e ajusta sozinho a tabela
   `carreiras` (a divisão passou de 1 letra para até 8, para guardar a liga).
   Deve terminar com `Importados: 638 clubes, 18583 jogadores.`
3. Gere o front de novo: `npm install` e `npm run build`.

As carreiras e contas que já existem continuam valendo. Para treinar um clube
estrangeiro ou de outra divisão, comece uma carreira nova e escolha o país na
tela de clubes.
