import { hexToRgb } from '../constants/palettes';

/**
 * Scanline flood fill algorithm for Procreate ColorDrop
 * Supports tolerance threshold (0 - 100)
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  tolerance: number = 32
): boolean {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;

  startX = Math.floor(startX);
  startY = Math.floor(startY);

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return false;
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const targetIdx = (startY * width + startX) * 4;
  const targetR = data[targetIdx];
  const targetG = data[targetIdx + 1];
  const targetB = data[targetIdx + 2];
  const targetA = data[targetIdx + 3];

  const fillRgb = hexToRgb(fillColorHex);
  const fillR = fillRgb.r;
  const fillG = fillRgb.g;
  const fillB = fillRgb.b;
  const fillA = 255;

  // If already matches fill color, skip
  if (
    Math.abs(targetR - fillR) < 3 &&
    Math.abs(targetG - fillG) < 3 &&
    Math.abs(targetB - fillB) < 3 &&
    Math.abs(targetA - fillA) < 3
  ) {
    return false;
  }

  const colorMatch = (idx: number): boolean => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    // Color difference
    const diff =
      Math.abs(r - targetR) +
      Math.abs(g - targetG) +
      Math.abs(b - targetB) +
      Math.abs(a - targetA);

    return diff <= (tolerance * 4);
  };

  const visited = new Uint8Array(width * height);
  const stack: [number, number][] = [[startX, startY]];

  while (stack.length > 0) {
    const [curX, curY] = stack.pop()!;
    let y1 = curY;

    let pixelIdx = (y1 * width + curX) * 4;
    let visitIdx = y1 * width + curX;

    if (visited[visitIdx]) continue;

    // Move up to boundary
    while (y1 >= 0 && colorMatch((y1 * width + curX) * 4)) {
      y1--;
    }
    y1++;

    let spanLeft = false;
    let spanRight = false;

    // Scan down
    while (y1 < height && colorMatch((y1 * width + curX) * 4)) {
      pixelIdx = (y1 * width + curX) * 4;
      visitIdx = y1 * width + curX;

      visited[visitIdx] = 1;
      data[pixelIdx] = fillR;
      data[pixelIdx + 1] = fillG;
      data[pixelIdx + 2] = fillB;
      data[pixelIdx + 3] = fillA;

      // Check left
      if (curX > 0) {
        const leftIdx = (y1 * width + (curX - 1)) * 4;
        const leftVis = y1 * width + (curX - 1);
        if (!visited[leftVis] && colorMatch(leftIdx)) {
          if (!spanLeft) {
            stack.push([curX - 1, y1]);
            spanLeft = true;
          }
        } else if (spanLeft) {
          spanLeft = false;
        }
      }

      // Check right
      if (curX < width - 1) {
        const rightIdx = (y1 * width + (curX + 1)) * 4;
        const rightVis = y1 * width + (curX + 1);
        if (!visited[rightVis] && colorMatch(rightIdx)) {
          if (!spanRight) {
            stack.push([curX + 1, y1]);
            spanRight = true;
          }
        } else if (spanRight) {
          spanRight = false;
        }
      }

      y1++;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return true;
}
