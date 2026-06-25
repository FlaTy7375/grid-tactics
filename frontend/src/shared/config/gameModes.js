import { DEFAULT_SHIP_CONFIG } from './defaultShipConfig';

export const GAME_MODES = {
  classic: {
    id: 'classic',
    label: 'Классика',
    description: '1 четырёхпалубный, 2 трёхпалубных, 3 двухпалубных, 4 однопалубных',
    shipConfig: DEFAULT_SHIP_CONFIG,
  },
  warrior: {
    id: 'warrior',
    label: 'Один в поле воин',
    description: '16 однопалубных корабликов',
    shipConfig: [{ size: 1, count: 16 }],
  },
};

export function getGameMode(modeId = 'classic') {
  return GAME_MODES[modeId] || GAME_MODES.classic;
}

export function getShipConfigForMode(modeId = 'classic') {
  return getGameMode(modeId).shipConfig;
}
