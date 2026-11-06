import bom = require('@lp-labs/bill-of-materials');

const result: bom.BillRollup = bom.rollupBillOfMaterials(
  [{ id: 'part', unit: 'each', components: [] }],
  [],
);
void result.requirements;
