export function getSurroundingCells(index, size, isVert, gridSize) {
  const cells = [];
  const startRow = Math.floor(index / gridSize);
  const startCol = index % gridSize;

  for (let r = startRow - 1; r <= startRow + (isVert ? size : 1); r += 1) {
    for (let c = startCol - 1; c <= startCol + (isVert ? 1 : size); c += 1) {
      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        cells.push(r * gridSize + c);
      }
    }
  }

  return cells;
}

export function getShipStartFromPick(pickedIndex, size, isVert, gridSize) {
  const pickRow = Math.floor(pickedIndex / gridSize);
  const pickCol = pickedIndex % gridSize;
  const offset = Math.floor((size - 1) / 2);
  const startRow = isVert ? pickRow - offset : pickRow;
  const startCol = isVert ? pickCol : pickCol - offset;

  return clampShipStart(startRow, startCol, size, isVert, gridSize);
}

export function clampShipStart(startRow, startCol, size, isVert, gridSize) {
  let row = startRow;
  let col = startCol;

  if (isVert) {
    row = Math.max(0, Math.min(gridSize - size, row));
    col = Math.max(0, Math.min(gridSize - 1, col));
  } else {
    col = Math.max(0, Math.min(gridSize - size, col));
    row = Math.max(0, Math.min(gridSize - 1, row));
  }

  return {
    startRow: row,
    startCol: col,
    startIndex: row * gridSize + col,
  };
}

export function getShipCoords(index, size, isVert, gridSize) {
  const coords = [];
  const startRow = Math.floor(index / gridSize);
  const startCol = index % gridSize;

  if (isVert) {
    if (startRow < 0 || startRow + size > gridSize) return null;
    for (let i = 0; i < size; i += 1) coords.push(index + (i * gridSize));
  } else {
    if (startCol < 0 || startCol + size > gridSize) return null;
    for (let i = 0; i < size; i += 1) coords.push(index + i);
  }

  return coords;
}

export function getShipCellsOnBoard(startRow, startCol, size, isVert, gridSize) {
  const coords = [];

  if (isVert) {
    for (let i = 0; i < size; i += 1) {
      const row = startRow + i;
      if (row >= 0 && row < gridSize && startCol >= 0 && startCol < gridSize) {
        coords.push(row * gridSize + startCol);
      }
    }
  } else {
    for (let i = 0; i < size; i += 1) {
      const col = startCol + i;
      if (col >= 0 && col < gridSize && startRow >= 0 && startRow < gridSize) {
        coords.push(startRow * gridSize + col);
      }
    }
  }

  return coords;
}

export function getShipCoordsFromStart(startRow, startCol, size, isVert, gridSize) {
  if (startRow < 0 || startCol < 0) return null;
  if (isVert) {
    if (startRow + size > gridSize || startCol >= gridSize) return null;
  } else if (startCol + size > gridSize || startRow >= gridSize) {
    return null;
  }

  return getShipCoords(startRow * gridSize + startCol, size, isVert, gridSize);
}

export function checkPlacementValid(coords, myShips, gridSize, ignoreShipId = null) {
  if (!coords) return false;

  const allOccupied = new Set();
  myShips.forEach((ship) => {
    if (ignoreShipId && ship.id === ignoreShipId) return;
    const shipCoords = getShipCoords(ship.index, ship.size, ship.isVertical, gridSize);
    shipCoords.forEach((cell) => allOccupied.add(cell));
    const halo = getSurroundingCells(ship.index, ship.size, ship.isVertical, gridSize);
    halo.forEach((cell) => allOccupied.add(cell));
  });

  return coords.every((cell) => !allOccupied.has(cell));
}
