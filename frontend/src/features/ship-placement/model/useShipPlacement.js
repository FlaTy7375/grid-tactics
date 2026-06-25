import { useEffect, useMemo, useRef, useState } from 'react';
import {
  checkPlacementValid,
  clampShipStart,
  getShipCellsOnBoard,
  getShipCoords,
  getShipCoordsFromStart,
  getShipStartFromPick,
  getSurroundingCells,
} from '@shared/lib/shipPlacementMath';
import {
  getShipPaletteDisplayDimensions,
  layoutShipPalette,
} from '@entities/ship/ui/ShipImage';
import { preloadShipThumbnails } from '@shared/lib/shipThumbnails';

const DRAG_THRESHOLD_PX = 5;

function applyHoverPreview({
  pickedIndex,
  ship,
  gridSize,
  myShips,
  setHoverAnchor,
  setHoverCoords,
  setHoverValid,
  lastHoverRef,
}) {
  const { startRow, startCol } = getShipStartFromPick(
    pickedIndex,
    ship.size,
    ship.isVertical,
    gridSize,
  );
  const placementCoords = getShipCoordsFromStart(
    startRow,
    startCol,
    ship.size,
    ship.isVertical,
    gridSize,
  );
  const displayCoords = getShipCellsOnBoard(
    startRow,
    startCol,
    ship.size,
    ship.isVertical,
    gridSize,
  );

  let anchor = { startRow, startCol };
  let coords = displayCoords;
  let placement = placementCoords;

  if (coords.length === 0) {
    const clamped = clampShipStart(startRow, startCol, ship.size, ship.isVertical, gridSize);
    anchor = { startRow: clamped.startRow, startCol: clamped.startCol };
    coords = getShipCellsOnBoard(
      clamped.startRow,
      clamped.startCol,
      ship.size,
      ship.isVertical,
      gridSize,
    );
    placement = getShipCoordsFromStart(
      clamped.startRow,
      clamped.startCol,
      ship.size,
      ship.isVertical,
      gridSize,
    );
  }

  if (coords.length === 0) {
    return false;
  }

  const valid = placement !== null && checkPlacementValid(placement, myShips, gridSize);
  const snapshot = { anchor, coords, valid };
  lastHoverRef.current = snapshot;
  setHoverAnchor(anchor);
  setHoverCoords(coords);
  setHoverValid(valid);
  return true;
}

export function useShipPlacement({ gridSize, locked = false, initialShips = [] }) {
  const [myShips, setMyShips] = useState([]);
  const [availableShips, setAvailableShips] = useState(initialShips);
  const [draggingShipIdx, setDraggingShipIdx] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0, startX: 0, startY: 0 });
  const [hoverCoords, setHoverCoords] = useState([]);
  const [hoverAnchor, setHoverAnchor] = useState(null);
  const [hoverValid, setHoverValid] = useState(true);
  const [isOverGrid, setIsOverGrid] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const boardRef = useRef(null);
  const boardPickRef = useRef(null);
  const dragActiveRef = useRef(false);
  const lastHoverRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragFrameRef = useRef(null);
  const dragPendingRef = useRef(null);

  useEffect(() => {
    if (initialShips.length > 0 && availableShips.length === 0) {
      setAvailableShips(initialShips);
    }
  }, [initialShips, availableShips.length]);

  useEffect(() => {
    if (availableShips.length > 0) {
      preloadShipThumbnails(availableShips);
    }
  }, [availableShips]);

  const toggleShipRotation = (idx) => {
    setAvailableShips((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], isVertical: !next[idx].isVertical };
      return next;
    });
  };

  const handleMouseDown = (e, idx) => {
    if (e.button !== 0 || locked) return;
    e.preventDefault();
    dragActiveRef.current = false;
    setIsDragActive(false);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setDraggingShipIdx(idx);
    setDragPos({ x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
  };

  useEffect(() => {
    const pickFieldIndex = (clientX, clientY) => {
      const index = boardPickRef.current?.pick(clientX, clientY);
      if (index === null || index === undefined) return null;
      return index;
    };

    const handleMouseMove = (e) => {
      if (draggingShipIdx === null) return;

      dragPendingRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (dragFrameRef.current !== null) return;

      dragFrameRef.current = requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pending = dragPendingRef.current;
        if (!pending || draggingShipIdx === null) return;

        const { clientX, clientY } = pending;
        const dx = Math.abs(clientX - dragStartRef.current.x);
        const dy = Math.abs(clientY - dragStartRef.current.y);
        if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;

        if (!dragActiveRef.current) {
          dragActiveRef.current = true;
          setIsDragActive(true);
        }

        setDragPos((prev) => (
          prev.x === clientX && prev.y === clientY
            ? prev
            : { ...prev, x: clientX, y: clientY }
        ));

        const pickedIndex = pickFieldIndex(clientX, clientY);
        setIsOverGrid((prev) => (prev === (pickedIndex !== null) ? prev : pickedIndex !== null));

        if (pickedIndex !== null) {
          const ship = availableShips[draggingShipIdx];
          applyHoverPreview({
            pickedIndex,
            ship,
            gridSize,
            myShips,
            setHoverAnchor,
            setHoverCoords,
            setHoverValid,
            lastHoverRef,
          });
        } else {
          lastHoverRef.current = null;
          setHoverAnchor(null);
          setHoverCoords([]);
          setHoverValid(false);
        }
      });
    };

    const handleMouseUp = (e) => {
      if (draggingShipIdx === null) return;

      const pickedIndex = pickFieldIndex(e.clientX, e.clientY);
      let placedSuccessfully = false;

      if (pickedIndex !== null) {
        const ship = availableShips[draggingShipIdx];
        const { startRow, startCol } = getShipStartFromPick(
          pickedIndex,
          ship.size,
          ship.isVertical,
          gridSize,
        );
        const coords = getShipCoordsFromStart(
          startRow,
          startCol,
          ship.size,
          ship.isVertical,
          gridSize,
        );

        if (coords && checkPlacementValid(coords, myShips, gridSize)) {
          setMyShips((prev) => [
            ...prev,
            {
              index: startRow * gridSize + startCol,
              size: ship.size,
              isVertical: ship.isVertical,
              id: ship.id,
            },
          ]);
          setAvailableShips((prev) => {
            const next = [...prev];
            next[draggingShipIdx] = { ...next[draggingShipIdx], placed: true };
            return next;
          });
          placedSuccessfully = true;
        }
      }

      if (!placedSuccessfully) {
        const dx = Math.abs(e.clientX - dragStartRef.current.x);
        const dy = Math.abs(e.clientY - dragStartRef.current.y);
        if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) {
          toggleShipRotation(draggingShipIdx);
        }
      }

      dragActiveRef.current = false;
      setIsDragActive(false);
      setDraggingShipIdx(null);
      setIsOverGrid(false);
      lastHoverRef.current = null;
      setHoverCoords([]);
      setHoverAnchor(null);
      setIsOverGrid(false);
    };

    if (draggingShipIdx !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingShipIdx, availableShips, myShips, gridSize]);

  const handleSelfCellClick = (index) => {
    if (locked) return;

    const shipToRemove = myShips.find((ship) => {
      const coords = getShipCoords(ship.index, ship.size, ship.isVertical, gridSize);
      return coords && coords.includes(index);
    });

    if (!shipToRemove) return;

    setMyShips((prev) => prev.filter((ship) => ship.id !== shipToRemove.id));
    setAvailableShips((prev) => {
      const next = [...prev];
      const availIdx = next.findIndex((ship) => ship.id === shipToRemove.id);
      if (availIdx !== -1) next[availIdx] = { ...next[availIdx], placed: false };
      return next;
    });
  };

  const autoPlace = () => {
    if (locked) return [];

    let currentShips = [];
    const currentAvailable = availableShips.map((ship) => ({ ...ship, placed: true }));

    for (const ship of availableShips) {
      let placed = false;
      let tries = 0;

      while (!placed && tries < 500) {
        const isVert = Math.random() > 0.5;
        const randIndex = Math.floor(Math.random() * (gridSize * gridSize));
        const coords = getShipCoords(randIndex, ship.size, isVert, gridSize);

        if (coords) {
          const allOccupied = new Set();
          currentShips.forEach((placedShip) => {
            const shipCoords = getShipCoords(
              placedShip.index,
              placedShip.size,
              placedShip.isVertical,
              gridSize,
            );
            shipCoords.forEach((cell) => allOccupied.add(cell));
            const halo = getSurroundingCells(
              placedShip.index,
              placedShip.size,
              placedShip.isVertical,
              gridSize,
            );
            halo.forEach((cell) => allOccupied.add(cell));
          });
          const isValid = coords.every((cell) => !allOccupied.has(cell));

          if (isValid) {
            currentShips.push({
              index: randIndex,
              size: ship.size,
              isVertical: isVert,
              id: ship.id,
            });
            placed = true;
          }
        }
        tries += 1;
      }

      if (!placed) {
        clearBoard();
        return [];
      }
    }

    setMyShips(currentShips);
    setAvailableShips(currentAvailable);
    return currentShips;
  };

  const clearBoard = () => {
    if (locked) return;
    setMyShips([]);
    setAvailableShips((prev) => prev.map((ship) => ({ ...ship, placed: false })));
  };

  const selfInteractive = !locked;

  const occupiedCells = useMemo(() => {
    const cells = new Set();
    myShips.forEach((ship) => {
      const coords = getShipCoords(ship.index, ship.size, ship.isVertical, gridSize);
      coords?.forEach((idx) => cells.add(idx));
    });
    return cells;
  }, [myShips, gridSize]);

  const hoverCellSet = useMemo(() => new Set(hoverCoords), [hoverCoords]);

  const selfStates = useMemo(() => (
    Array.from({ length: gridSize * gridSize }, (_, index) => {
      if (hoverCellSet.has(index) && draggingShipIdx !== null && isDragActive) {
        return hoverValid ? 'hover-valid' : 'hover-invalid';
      }

      if (occupiedCells.has(index)) return 'placed';
      return 'default';
    })
  ), [gridSize, occupiedCells, hoverCellSet, hoverValid, draggingShipIdx, isDragActive]);

  const opponentStates = useMemo(
    () => Array.from({ length: gridSize * gridSize }, () => 'disabled'),
    [gridSize],
  );

  const selfBoardShips = useMemo(() => {
    const placed = myShips.map((ship) => ({ ...ship, preview: false }));
    if (!selfInteractive || !isDragActive || draggingShipIdx === null || hoverCoords.length === 0 || !hoverAnchor) {
      return placed;
    }

    const draggingShip = availableShips[draggingShipIdx];
    if (!draggingShip) return placed;

    return [
      ...placed,
      {
        ...draggingShip,
        index: hoverAnchor.startRow * gridSize + hoverAnchor.startCol,
        startRow: hoverAnchor.startRow,
        startCol: hoverAnchor.startCol,
        id: `preview-${draggingShip.id}`,
        preview: true,
        valid: hoverValid,
      },
    ];
  }, [
    myShips,
    selfInteractive,
    isDragActive,
    draggingShipIdx,
    hoverCoords,
    hoverAnchor,
    hoverValid,
    availableShips,
    gridSize,
  ]);

  const paletteEntries = useMemo(
    () => availableShips
      .map((ship, idx) => ({ ship, idx }))
      .filter(({ ship }) => !ship.placed),
    [availableShips],
  );

  const paletteLayout = useMemo(
    () => layoutShipPalette(paletteEntries),
    [paletteEntries],
  );

  const allShipsPlaced = availableShips.every((ship) => ship.placed);

  return {
    myShips,
    availableShips,
    draggingShipIdx,
    dragPos,
    isDragActive,
    isOverGrid,
    boardRef,
    boardPickRef,
    selfStates,
    opponentStates,
    selfBoardShips,
    selfInteractive,
    paletteEntries,
    paletteLayout,
    allShipsPlaced,
    handleMouseDown,
    handleSelfCellClick,
    autoPlace,
    clearBoard,
  };
}

export { getShipPaletteDisplayDimensions };
