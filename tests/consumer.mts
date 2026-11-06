import {
  rollupBillOfMaterials,
  type BillPart,
  type BillRollup,
  type PartDemand,
} from '@lp-labs/bill-of-materials';

const parts: BillPart[] = [{ id: 'bolt', unit: 'each', components: [] }];
const demand: PartDemand[] = [{ partId: 'bolt', quantity: 3 }];
const result: BillRollup = rollupBillOfMaterials(parts, demand, { includeDemandedParts: true });
void result.requirements;
// @ts-expect-error component quantities are numeric.
const invalid: PartDemand = { partId: 'bolt', quantity: 'three' };
void invalid;
