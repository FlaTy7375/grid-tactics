const DEFAULT_SHIP_CONFIG = [
  { size: 4, count: 1 },
  { size: 3, count: 2 },
  { size: 2, count: 3 },
  { size: 1, count: 4 },
];

function createShipList(shipConfig = DEFAULT_SHIP_CONFIG) {
  const ships = [];
  shipConfig.forEach((entry) => {
    for (let i = 0; i < entry.count; i += 1) {
      ships.push({
        size: entry.size,
        id: `${entry.size}-${i}`,
        isVertical: false,
      });
    }
  });
  return ships;
}

function getSurroundingCells(index, size, isVertical, gridSize) {
  const cells = [];
  const startRow = Math.floor(index / gridSize);
  const startCol = index % gridSize;

  for (let r = startRow - 1; r <= startRow + (isVertical ? size : 1); r += 1) {
    for (let c = startCol - 1; c <= startCol + (isVertical ? 1 : size); c += 1) {
      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        cells.push(r * gridSize + c);
      }
    }
  }
  return cells;
}

function getShipCoords(index, size, isVertical, gridSize) {
  const coords = [];
  const startRow = Math.floor(index / gridSize);
  const startCol = index % gridSize;

  if (isVertical) {
    if (startRow < 0 || startRow + size > gridSize) return null;
    for (let i = 0; i < size; i += 1) coords.push(index + (i * gridSize));
  } else {
    if (startCol < 0 || startCol + size > gridSize) return null;
    for (let i = 0; i < size; i += 1) coords.push(index + i);
  }

  return coords;
}

function autoPlaceShips(gridSize, shipConfig) {
  const templates = createShipList(shipConfig);
  const placed = [];

  for (const ship of templates) {
    let success = false;

    for (let tries = 0; tries < 500 && !success; tries += 1) {
      const isVertical = Math.random() > 0.5;
      const index = Math.floor(Math.random() * (gridSize * gridSize));
      const coords = getShipCoords(index, ship.size, isVertical, gridSize);
      if (!coords) continue;

      const occupied = new Set();
      placed.forEach((existing) => {
        const existingCoords = getShipCoords(
          existing.index,
          existing.size,
          existing.isVertical,
          gridSize,
        );
        existingCoords.forEach((cell) => occupied.add(cell));
        getSurroundingCells(
          existing.index,
          existing.size,
          existing.isVertical,
          gridSize,
        ).forEach((cell) => occupied.add(cell));
      });

      if (coords.every((cell) => !occupied.has(cell))) {
        placed.push({
          index,
          size: ship.size,
          isVertical,
          id: ship.id,
        });
        success = true;
      }
    }

    if (!success) {
      return autoPlaceShips(gridSize, shipConfig);
    }
  }

  return placed;
}

module.exports = {
  DEFAULT_SHIP_CONFIG,
  autoPlaceShips,
  getSurroundingCells,
  getShipCoords,
};
