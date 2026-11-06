import assert from 'node:assert/strict';
import test from 'node:test';
import { rollupBillOfMaterials } from '../dist/esm/index.js';

const parts = [
  { id: 'assembly', unit: 'piece', components: [{ partId: 'sub', quantity: 2, unit: 'piece' }] },
  {
    id: 'sub',
    unit: 'piece',
    components: [
      { partId: 'bolt', quantity: 4, unit: 'each' },
      { partId: 'steel', quantity: 0.5, unit: 'kg' },
    ],
  },
  { id: 'bolt', unit: 'each', components: [] },
  { id: 'steel', unit: 'kg', components: [] },
];

test('rolls up shared components and preserves declared component units', () => {
  const result = rollupBillOfMaterials(parts, [
    { partId: 'assembly', quantity: 3 },
    { partId: 'sub', quantity: 2 },
  ]);
  assert.deepEqual(result.requirements, [
    { partId: 'bolt', quantity: 32, unit: 'each' },
    { partId: 'steel', quantity: 4, unit: 'kg' },
    { partId: 'sub', quantity: 6, unit: 'piece' },
  ]);
});

test('can include demanded assemblies while rolling down their components', () => {
  const result = rollupBillOfMaterials(parts, [{ partId: 'assembly', quantity: 2 }], {
    includeDemandedParts: true,
  });
  assert.deepEqual(result.requirements, [
    { partId: 'assembly', quantity: 2, unit: 'piece' },
    { partId: 'bolt', quantity: 16, unit: 'each' },
    { partId: 'steel', quantity: 2, unit: 'kg' },
    { partId: 'sub', quantity: 4, unit: 'piece' },
  ]);
});

test('adds multiple demand lines and supports leaf parts and empty demand', () => {
  assert.deepEqual(
    rollupBillOfMaterials(parts, [
      { partId: 'bolt', quantity: 2 },
      { partId: 'bolt', quantity: 3 },
    ]).requirements,
    [],
  );
  assert.deepEqual(
    rollupBillOfMaterials(parts, [{ partId: 'bolt', quantity: 2 }], {
      includeDemandedParts: true,
    }).requirements,
    [{ partId: 'bolt', quantity: 2, unit: 'each' }],
  );
  assert.deepEqual(rollupBillOfMaterials(parts, []).requirements, []);
});

test('detects cycles even in disconnected components and rejects invalid references/units', () => {
  assert.throws(
    () =>
      rollupBillOfMaterials(
        [
          ...parts,
          { id: 'x', unit: 'piece', components: [{ partId: 'y', quantity: 1, unit: 'piece' }] },
          { id: 'y', unit: 'piece', components: [{ partId: 'x', quantity: 1, unit: 'piece' }] },
        ],
        [],
      ),
    /cycle/,
  );
  assert.throws(
    () =>
      rollupBillOfMaterials(
        [{ id: 'x', unit: 'each', components: [{ partId: 'missing', quantity: 1, unit: 'each' }] }],
        [],
      ),
    /Unknown component/,
  );
  assert.throws(
    () =>
      rollupBillOfMaterials(
        [
          { id: 'x', unit: 'piece', components: [{ partId: 'y', quantity: 1, unit: 'kg' }] },
          { id: 'y', unit: 'each', components: [] },
        ],
        [],
      ),
    /declared unit/,
  );
});

test('rejects duplicate IDs, invalid quantities and numeric overflow', () => {
  assert.throws(
    () =>
      rollupBillOfMaterials(
        [
          { id: 'x', unit: 'each', components: [] },
          { id: 'x', unit: 'each', components: [] },
        ],
        [],
      ),
    /Duplicate part/,
  );
  assert.throws(
    () =>
      rollupBillOfMaterials(
        [
          { id: 'x', unit: 'each', components: [{ partId: 'y', quantity: -1, unit: 'each' }] },
          { id: 'y', unit: 'each', components: [] },
        ],
        [],
      ),
    /finite nonnegative/,
  );
  assert.throws(
    () =>
      rollupBillOfMaterials(
        [
          {
            id: 'x',
            unit: 'piece',
            components: [{ partId: 'y', quantity: Number.MAX_VALUE, unit: 'each' }],
          },
          { id: 'y', unit: 'each', components: [] },
        ],
        [{ partId: 'x', quantity: 2 }],
      ),
    /overflowed/,
  );
});
