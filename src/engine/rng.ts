/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 * Mesma seed => mesma partida. Isso permite reproduzir partidas no
 * servidor do modo online e escrever testes estáveis.
 */
export type Rng = () => number;

export function criarRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function escolherPonderado<T>(rng: Rng, itens: T[], peso: (x: T) => number): T {
  const total = itens.reduce((s, x) => s + Math.max(0, peso(x)), 0);
  let r = rng() * total;
  for (const x of itens) {
    r -= Math.max(0, peso(x));
    if (r <= 0) return x;
  }
  return itens[itens.length - 1];
}
