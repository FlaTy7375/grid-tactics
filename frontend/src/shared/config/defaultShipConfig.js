export const DEFAULT_SHIP_CONFIG = [
  { size: 4, count: 1 },
  { size: 3, count: 2 },
  { size: 2, count: 3 },
  { size: 1, count: 4 },
];

export function createAvailableShips(shipConfig = DEFAULT_SHIP_CONFIG) {
  const ships = [];

  shipConfig.forEach((entry) => {
    for (let i = 0; i < entry.count; i += 1) {
      ships.push({
        size: entry.size,
        id: `${entry.size}-${i}`,
        placed: false,
        isVertical: false,
      });
    }
  });

  return ships;
}
