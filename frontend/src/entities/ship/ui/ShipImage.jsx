import React, { useEffect, useState } from 'react';
import {
  getShipThumbnail,
  getShipPreviewDimensions,
  peekShipThumbnail,
  getShipPaletteSlotSize,
  getShipPaletteDisplayDimensions,
  getShipPaletteLift,
  getShipPaletteLabelOffset,
  layoutShipPalette,
} from '@shared/lib/shipThumbnails';

export {
  getShipPreviewDimensions,
  getShipPaletteSlotSize,
  getShipPaletteDisplayDimensions,
  getShipPaletteLift,
  getShipPaletteLabelOffset,
  layoutShipPalette,
};

export default function ShipImage({ ship, className = '', style, width, height }) {
  const [src, setSrc] = useState(() => peekShipThumbnail(ship.size, ship.isVertical));
  const dimensions = getShipPreviewDimensions(ship);
  const resolvedWidth = width ?? dimensions.width;
  const resolvedHeight = height ?? dimensions.height;

  useEffect(() => {
    const cached = peekShipThumbnail(ship.size, ship.isVertical);
    if (cached) {
      setSrc(cached);
      return undefined;
    }

    let active = true;
    getShipThumbnail(ship.size, ship.isVertical).then((url) => {
      if (active && url) {
        setSrc(url);
      }
    });

    return () => {
      active = false;
    };
  }, [ship.size, ship.isVertical]);

  return (
    <img
      src={src || undefined}
      alt=""
      className={`ship-thumb ${className}`.trim()}
      style={{
        width: resolvedWidth,
        height: resolvedHeight,
        ...style,
      }}
      draggable={false}
    />
  );
}
