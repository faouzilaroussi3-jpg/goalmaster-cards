export function openingCinematic(cards: ReadonlyArray<{ tier: number }>) {
  const tier = Math.min(7, Math.max(1, ...cards.map((card) => card.tier)));
  const action = tier >= 5 ? "bicycle" : tier === 4 ? "volley" : tier === 3 ? "shot" : "dribble";
  return { tier, action, duration: tier >= 5 ? 4800 : tier >= 3 ? 3800 : 2800 };
}