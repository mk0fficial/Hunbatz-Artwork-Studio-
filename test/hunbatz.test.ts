import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQuadPoint, createDefaultMeshGrid, evaluateMeshPoint } from '../src/utils/warpEngine.ts';
import { stabilizeStrokePoints, simplifyPointsRDP } from '../src/utils/vectorEngine.ts';

test('Warp Engine - 4-corner Quad Bilinear Interpolation', () => {
  const corners = {
    tl: { x: 0, y: 0 },
    tr: { x: 100, y: 0 },
    br: { x: 100, y: 100 },
    bl: { x: 0, y: 100 },
  };

  // Center point at u=0.5, v=0.5 should be (50, 50)
  const center = evaluateQuadPoint(corners, 0.5, 0.5);
  assert.equal(Math.round(center.x), 50);
  assert.equal(Math.round(center.y), 50);

  // Top-left at u=0, v=0
  const tl = evaluateQuadPoint(corners, 0, 0);
  assert.equal(tl.x, 0);
  assert.equal(tl.y, 0);

  // Bottom-right at u=1, v=1
  const br = evaluateQuadPoint(corners, 1, 1);
  assert.equal(br.x, 100);
  assert.equal(br.y, 100);
});

test('Warp Engine - 4x4 Mesh Grid creation and evaluation', () => {
  const grid = createDefaultMeshGrid(10, 20, 200, 100);
  assert.equal(grid.length, 4);
  assert.equal(grid[0].length, 4);

  // Origin point at top-left
  assert.equal(grid[0][0].x, 10);
  assert.equal(grid[0][0].y, 20);

  // Extent point at bottom-right
  assert.equal(grid[3][3].x, 210);
  assert.equal(grid[3][3].y, 120);

  // Center evaluation
  const mid = evaluateMeshPoint(grid, 0.5, 0.5);
  assert.equal(Math.round(mid.x), 110);
  assert.equal(Math.round(mid.y), 70);
});

test('Vector Engine - Point stabilization & RDP reduction', () => {
  const rawPoints = [
    { x: 10, y: 10, pressure: 0.5 },
    { x: 12, y: 11, pressure: 0.52 },
    { x: 14, y: 12, pressure: 0.54 },
    { x: 16, y: 13, pressure: 0.55 },
    { x: 50, y: 50, pressure: 0.8 },
  ];

  const stabilized = stabilizeStrokePoints(rawPoints, 50);
  assert.ok(stabilized.length >= 2, 'Should maintain polyline endpoints');
  assert.equal(stabilized[0].x, 10);
  assert.equal(stabilized[0].y, 10);

  // RDP simplification on collinear points
  const collinear = [
    { id: '1', x: 0, y: 0 },
    { id: '2', x: 10, y: 0 },
    { id: '3', x: 20, y: 0 },
    { id: '4', x: 30, y: 0 },
    { id: '5', x: 40, y: 0 },
  ];
  const simplified = simplifyPointsRDP(collinear, 1.0);
  assert.equal(simplified.length, 2, 'Collinear line should simplify to 2 points');
  assert.equal(simplified[0].x, 0);
  assert.equal(simplified[1].x, 40);
});

test('Puppet Warp Engine - Mesh Generation & Deformation with Pins', async () => {
  const { createPuppetMesh, deformPuppetMesh } = await import('../src/utils/warpEngine.ts');
  const mesh = createPuppetMesh(0, 0, 100, 100, 4, 4);

  // Mesh should contain (4+1)*(4+1) = 25 vertices
  assert.equal(mesh.vertices.length, 25);
  // Mesh should contain 4*4*2 = 32 triangles
  assert.equal(mesh.triangles.length, 32);

  // When no pins are defined, deformed vertices equal original vertices
  const noPinDeform = deformPuppetMesh([], mesh.vertices);
  assert.deepEqual(noPinDeform, mesh.vertices);

  // When 1 pin is moved, rigid translation occurs
  const singlePin = [{ id: 'p1', x: 60, y: 60, origX: 50, origY: 50 }];
  const singlePinDeform = deformPuppetMesh(singlePin, mesh.vertices);
  assert.equal(singlePinDeform[0].x, mesh.vertices[0].x + 10);
  assert.equal(singlePinDeform[0].y, mesh.vertices[0].y + 10);

  // When multiple pins are moved, deformation is localized with inverse distance weighting
  const pins = [
    { id: 'p_fixed', x: 0, y: 0, origX: 0, origY: 0 },
    { id: 'p_moved', x: 120, y: 100, origX: 100, origY: 100 },
  ];
  const multiDeform = deformPuppetMesh(pins, mesh.vertices);
  // Point near p_fixed (0,0) should barely move
  const distFromFixed = Math.hypot(multiDeform[0].x - mesh.vertices[0].x, multiDeform[0].y - mesh.vertices[0].y);
  assert.ok(distFromFixed < 2, 'Point near fixed pin should stay close to original position');
  // Point at bottom-right corner (index 24) should have moved towards dx=+20
  const distFromMoved = multiDeform[24].x - mesh.vertices[24].x;
  assert.ok(distFromMoved > 10, 'Point near moved pin should be pulled along pin direction');
});
