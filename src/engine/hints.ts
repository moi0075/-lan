/** Stable, opt-in geography hints. No candidate encodes the correct answer's position. */
export interface LocatedItem {
  id: string;
  coordinates: number[];
}
export function candidateCountries(
  items: readonly LocatedItem[],
  targetId: string,
  questionNumber: number,
): string[] {
  const target = items.find((item) => item.id === targetId);
  if (!target) throw Error("Unknown hint target");
  let seed = 2166136261;
  for (const char of `${targetId}:${questionNumber}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const distance = (item: LocatedItem) => {
    const [lat, lon] = item.coordinates.map(radians);
    const [targetLat, targetLon] = target.coordinates.map(radians);
    return (
      1 -
      (Math.sin(lat) * Math.sin(targetLat) +
        Math.cos(lat) * Math.cos(targetLat) * Math.cos(lon - targetLon))
    );
  };
  const shuffle = <T>(array: T[]) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };
  // Nearby distractors make a useful regional aid. Locked countries are valid distractors too.
  const nearby = items
    .filter((item) => item.id !== targetId)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, 24);
  return shuffle([
    targetId,
    ...shuffle(nearby)
      .slice(0, 4)
      .map((item) => item.id),
  ]);
}
