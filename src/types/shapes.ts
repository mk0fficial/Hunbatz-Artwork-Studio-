export type ShapeType =
  | 'line'
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'grid'
  | 'speech_bubble'
  | 'thought_bubble'
  | 'spiky_bubble'
  | 'comic_vignette'
  | 'brush_path';

export interface Point2D {
  x: number;
  y: number;
  width?: number; // Custom local line thickness at this anchor point
}

export type VignetteLayout = 'single' | 'two_horizontal' | 'two_vertical' | 'four_grid' | 'three_strip';

export interface VectorShapeConfig {
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // radians

  // Styling
  strokeWidth: number; // 1 to 100
  strokeColor: string;
  hasFill: boolean;
  fillColor: string;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  strokeCap?: 'round' | 'butt' | 'square' | 'tapered';
  opacity: number; // 0 to 1

  // Specific properties
  cornerRadius?: number; // for rectangle, speech bubble, vignette
  arrowHead?: boolean; // for line

  // Star
  starPoints?: number; // 3 to 30 points
  starInnerRatio?: number; // 0.2 to 0.8

  // Triangle
  triangleVertices?: [Point2D, Point2D, Point2D];

  // Grid
  gridRows?: number; // 1 to 24
  gridCols?: number; // 1 to 24

  // Speech bubble
  tailTip?: Point2D; // Draggable tail target
  tailBaseWidth?: number; // Width of tail attachment

  // Thought bubble
  thoughtOrigin?: Point2D; // Tail target point for trail circles
  thoughtLobeCount?: number; // Number of cloud lobes (6 to 16)

  // Spiky comic shout bubble
  spikesCount?: number; // 8 to 36 spikes
  spikeAmplitude?: number; // Height of spikes (0.1 to 0.6)

  // Comic vignette
  vignetteLayout?: VignetteLayout;
  vignetteGutter?: number; // Gutter gap between panels (2 to 40 px)
  vignettePadding?: number; // Padding inside canvas boundary

  // Vector brush path
  pathPoints?: Point2D[];
  mimicBrush?: boolean; // If true, stroke path using active brush dab stamps
  isDrawingTrail?: boolean; // Freehand trail drawing mode directly on canvas
  selectedPointIndex?: number | null; // Currently highlighted anchor point

  // Radial Area of Effect control
  radialRadius?: number; // Radius of area of effect circle (10 to 150px)
  radialIntensity?: number; // Thickness change amount per action (1 to 20px)
  radialMode?: 'thicken' | 'thin'; // Thicken or narrow lines
}
