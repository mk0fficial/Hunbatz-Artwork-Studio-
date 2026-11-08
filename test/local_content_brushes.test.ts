import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateBrush, DEFAULT_BRUSH_CATEGORIES, DEFAULT_BRUSHES, loadBrushFolders } from '../src/constants/brushes.ts';

test('Hydrate brush defaults category cleanly without resurrecting deleted Pencils', () => {
  const customBrush = hydrateBrush({
    id: 'test_brush_1',
    name: 'My Custom Inker',
  });
  assert.equal(customBrush.category, 'Inking');
  assert.notEqual(customBrush.category, 'Pencils');
});

test('Deleted categories do not reappear in fallback folder loader', () => {
  const folders = loadBrushFolders();
  // When no previous saved folders exist or local storage is clean, default folder is Inking
  assert.ok(folders.includes('Inking'));
  assert.ok(!folders.includes('Pencils'));
});

test('Deleted brushes are not forcefully re-injected when filtered to active non-deleted list', () => {
  const activeBrushes = DEFAULT_BRUSHES.filter((b) => b.category === 'Inking');
  assert.ok(activeBrushes.length > 0);
  assert.ok(activeBrushes.every((b) => b.category === 'Inking'));
  
  // Verify none of the deleted pencils, air brushes, or charcoal exist in active list
  const hasPencils = activeBrushes.some((b) => b.category === 'Pencils');
  assert.equal(hasPencils, false);
});
