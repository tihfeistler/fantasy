# Fantasy

Gerenciador de futebol para navegador (PC, com recursos PWA) com jogadores clássicos.

Design: [docs/DESIGN.md](docs/DESIGN.md) · Formato de jogador: [docs/FORMATO-JOGADOR.md](docs/FORMATO-JOGADOR.md) · **Rodar no XAMPP: [docs/XAMPP.md](docs/XAMPP.md)**

## Rodar

Precisa de Node 20+.

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes do motor de partidas
npm run build    # build de produção em dist/
```

## Estrutura

- `src/engine/`: regras do jogo em TypeScript puro (tipos, forças, simulação, RNG com seed)
- `src/data/`: dados de exemplo
- `src/ui/`: telas React (elenco, partida, lendas)
- `api/`: API em PHP (PDO + MySQL)
- `sql/schema.sql`: tabelas do banco
- `scripts/importar.php`: carrega `data/*.json` no MySQL
- `docs/`: design e formatos
