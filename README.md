# @lp-labs/bill-of-materials

Validates a bounded acyclic bill of materials, checks each component's declared unit, and rolls up multiple demand lines into deterministic quantity requirements.

## Install

```sh
npm install @lp-labs/bill-of-materials
```

## Quickstart

```js
import { rollupBillOfMaterials } from '@lp-labs/bill-of-materials';

const plan = rollupBillOfMaterials(
  [
    { id: 'chair', unit: 'piece', components: [{ partId: 'bolt', quantity: 4, unit: 'each' }] },
    { id: 'bolt', unit: 'each', components: [] },
  ],
  [{ partId: 'chair', quantity: 3 }],
);
console.log(plan.requirements); // bolt: 12 each
```

CommonJS: `const { rollupBillOfMaterials } = require('@lp-labs/bill-of-materials');`.

## API and types

- Runtime export `rollupBillOfMaterials(parts, demand, options?): BillRollup`.
- `BillPart` has a unique `id`, a `unit` label, and component records. Each `BillComponent` names a child part, its nonnegative finite quantity per one parent unit, and a `unit` exactly matching the child's declared unit.
- `PartDemand` is a requested part ID and quantity in that part's unit.
- `BillRollup.requirements` is an immutable list of `PartRequirement` values with `partId`, summed `quantity`, and declared `unit`, sorted lexically by part ID.
- `includeDemandedParts` defaults to `false`: only recipe components appear. When `true`, root demand lines are also included; all subassemblies and their components remain in the output.

## Validation, errors, and limits

Inputs allow up to 10,000 parts, 10,000 demand rows, and 100,000 component edges. IDs/units contain 1–128 characters. Missing references, duplicate IDs, unit mismatches, malformed records, and any cycle (including one in an unused part) are rejected. Negative/nonfinite quantities, unsafe numeric totals, or multiplication overflow throw `RangeError`; structural problems throw `TypeError`. Zero quantities are accepted.

Units are labels, not a conversion system: a component ratio is expressed in the child's unit per one parent unit. No conversion or rounding occurs; quantities use JavaScript numbers, and overflow is rejected. Rollup traversal is bounded to one million component expansions per call. This tool does not check stock, yield loss, substitutions, scrap, or procurement availability. Customize the model by expressing each component ratio in the child part's unit and applying any manufacturing yield outside this pure rollup.

`npm run build`, `npm run typecheck`, `npm test`, `npm run format`, and `npm run format:check` are available. Node.js 18+; no runtime or peer dependencies.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
