import React from 'react';
import { CheckCircle, Trash2, Zap } from 'lucide-react';
import GameBoards3D from '@widgets/game-board/ui/GameBoards3D';
import ShipImage, {
  getShipPaletteDisplayDimensions,
  getShipPaletteLift,
  getShipPaletteLabelOffset,
  getShipPreviewDimensions,
} from '@entities/ship/ui/ShipImage';

import { BoardPlayerCard } from '@widgets/game-board/ui/BoardsSceneChrome';
import BoardWaitingOverlay from '@features/game-session/ui/BoardWaitingOverlay';

export default function ShipPlacementStage({
  gridSize,
  opponentName = 'Соперник',
  placement,
  locked = false,
  onReady,
  readyLabel = 'Готов',
  showPlacementPanel = true,
  selfReadyOverlay = false,
  opponentPlacing = false,
  opponentStatusText = 'Соперник расставляет фигуры...',
}) {
  const {
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
  } = placement;

  return (
    <>
      <div className="boards-layout boards-layout--placement">
        {showPlacementPanel && !locked && (
          <section className="board-section placement-panel">
            <div className="placement-controls">
              <div className="placement-toolbar">
                <span className="placement-hint">Перетащи фигуру. Клик — поворот.</span>
                <div className="placement-actions">
                  <button className="btn-secondary game-tool-btn" onClick={autoPlace} title="Авторасстановка" type="button">
                    <Zap size={16} /> Авто
                  </button>
                  <button className="btn-secondary game-tool-btn" onClick={clearBoard} title="Очистить поле" type="button">
                    <Trash2 size={16} /> Очистить
                  </button>
                </div>
              </div>

              <div className="ship-selector">
                <div
                  className="ship-selector-dock"
                  style={{
                    width: paletteLayout.width,
                    height: paletteLayout.height,
                  }}
                >
                  {paletteEntries.map(({ ship, idx }) => {
                    const position = paletteLayout.positions.get(idx);
                    const displayDims = getShipPaletteDisplayDimensions(ship);
                    if (!position) return null;

                    return (
                      <div
                        key={ship.id}
                        className={`ship-palette-item ${draggingShipIdx === idx && isDragActive ? 'ship-palette-item--hidden' : ''}`}
                        style={{
                          left: position.left,
                          top: position.top,
                          width: position.width,
                          height: position.height,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, idx)}
                        title="Клик — поворот, перетаскивание — расстановка"
                      >
                        <div className="ship-palette-slot">
                          <div
                            className="ship-palette-ship-wrap"
                            style={{
                              width: displayDims.width,
                              height: displayDims.height,
                              bottom: getShipPaletteLift(ship.size),
                            }}
                          >
                            <ShipImage
                              ship={ship}
                              className="ship-thumb--palette"
                              {...displayDims}
                            />
                            <span
                              className="ship-palette-label"
                              style={{
                                transform: `translate(-50%, calc(-50% + ${getShipPaletteLabelOffset(ship.size)}px))`,
                              }}
                            >
                              {ship.size}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {allShipsPlaced && (
                  <div className="ship-ready-msg">
                    <CheckCircle size={20} /> Все фигуры расставлены
                  </div>
                )}
              </div>

              {onReady && (
                <button
                  className="btn-primary lobby-create-btn lobby-create-btn--full"
                  disabled={!allShipsPlaced}
                  onClick={onReady}
                  type="button"
                >
                  <CheckCircle size={20} /> {readyLabel}
                </button>
              )}
            </div>
          </section>
        )}

        <div className="boards-3d-panel">
          <div className="boards-top">
            <BoardPlayerCard side="self" title="Твоё поле" name="Ты" />
            <BoardPlayerCard
              side="opponent"
              title="Поле соперника"
              name={opponentName}
              hint={opponentPlacing ? opponentStatusText : null}
            />
          </div>

          <div className="game-boards-3d-host">
            <div className="boards-center-divider" aria-hidden />
            <GameBoards3D
              gridSize={gridSize}
              selfStates={selfStates}
              opponentStates={opponentStates}
              selfShips={selfBoardShips}
              selfInteractive={selfInteractive}
              opponentInteractive={false}
              onSelfCellClick={handleSelfCellClick}
              onOpponentCellClick={() => {}}
              pickRef={boardPickRef}
              wrapRef={boardRef}
              isPlacing
              suppressPlacementHover={isDragActive && draggingShipIdx !== null}
            />

            {selfReadyOverlay && (
              <BoardWaitingOverlay
                side="self"
                title="Ждём соперника"
                hint="Твоя расстановка сохранена"
              />
            )}
          </div>
        </div>
      </div>

      {isDragActive && draggingShipIdx !== null && !isOverGrid && (
        <div
          className="ship-drag-ghost"
          style={{
            left: dragPos.x,
            top: dragPos.y,
          }}
        >
          <ShipImage
            ship={availableShips[draggingShipIdx]}
            {...getShipPreviewDimensions(availableShips[draggingShipIdx])}
          />
        </div>
      )}
    </>
  );
}
