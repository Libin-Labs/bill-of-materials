export interface BillComponent {
  partId: string;
  quantity: number;
  unit: string;
}

export interface BillPart {
  id: string;
  unit: string;
  components: readonly BillComponent[];
}

export interface PartDemand {
  partId: string;
  quantity: number;
}

export interface PartRequirement {
  readonly partId: string;
  readonly quantity: number;
  readonly unit: string;
}

export interface BillRollup {
  readonly requirements: readonly PartRequirement[];
}

const MAX_PARTS = 10_000;
const MAX_COMPONENTS = 100_000;

function record(value: unknown, fields: readonly string[], label: string) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor =
      typeof key === 'string' ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (
      typeof key !== 'string' ||
      !fields.includes(key) ||
      !descriptor?.enumerable ||
      !('value' in descriptor)
    ) {
      throw new TypeError(`${label} contains an unsupported or non-data property.`);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
    throw new TypeError(`${label} must contain 1..128 characters.`);
  }
  return value;
}

function quantity(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite nonnegative number.`);
  }
  return value;
}

export function rollupBillOfMaterials(
  inputParts: readonly BillPart[],
  inputDemand: readonly PartDemand[],
  options: { includeDemandedParts?: boolean } = {},
): BillRollup {
  if (!Array.isArray(inputParts) || inputParts.length > MAX_PARTS) {
    throw new RangeError(`parts must be an array of at most ${MAX_PARTS} entries.`);
  }
  if (!Array.isArray(inputDemand) || inputDemand.length > MAX_PARTS) {
    throw new RangeError(`demand must be an array of at most ${MAX_PARTS} entries.`);
  }
  const parsedOptions = record(options, ['includeDemandedParts'], 'options');
  if (
    parsedOptions.includeDemandedParts !== undefined &&
    typeof parsedOptions.includeDemandedParts !== 'boolean'
  ) {
    throw new TypeError('includeDemandedParts must be a boolean.');
  }
  const parts = new Map<string, { id: string; unit: string; components: BillComponent[] }>();
  let componentCount = 0;
  for (const value of inputParts) {
    const part = record(value, ['id', 'unit', 'components'], 'part');
    const partId = text(part.id, 'part ID');
    if (parts.has(partId)) throw new TypeError(`Duplicate part ID: ${partId}`);
    const unit = text(part.unit, 'part unit');
    if (!Array.isArray(part.components)) throw new TypeError('part components must be an array.');
    componentCount += part.components.length;
    if (componentCount > MAX_COMPONENTS)
      throw new RangeError('Bill of materials exceeds 100000 components.');
    const components = Array.from(part.components, (value) => {
      const component = record(value, ['partId', 'quantity', 'unit'], 'component');
      return {
        partId: text(component.partId, 'component part ID'),
        quantity: quantity(component.quantity, 'component quantity'),
        unit: text(component.unit, 'component unit'),
      };
    });
    parts.set(partId, { id: partId, unit, components });
  }
  for (const part of parts.values()) {
    for (const component of part.components) {
      const child = parts.get(component.partId);
      if (!child) throw new TypeError(`Unknown component part: ${component.partId}`);
      if (component.unit !== child.unit) {
        throw new TypeError(
          `Component ${component.partId} must use its declared unit ${child.unit}.`,
        );
      }
    }
  }
  const incoming = new Map([...parts.keys()].map((partId) => [partId, 0]));
  for (const part of parts.values()) {
    for (const component of part.components) {
      incoming.set(component.partId, incoming.get(component.partId)! + 1);
    }
  }
  const ready = [...parts.keys()].filter((partId) => incoming.get(partId) === 0);
  let visited = 0;
  while (ready.length > 0) {
    const partId = ready.pop()!;
    visited++;
    for (const component of parts.get(partId)!.components) {
      const count = incoming.get(component.partId)! - 1;
      incoming.set(component.partId, count);
      if (count === 0) ready.push(component.partId);
    }
  }
  if (visited !== parts.size) throw new TypeError('Bill of materials contains a cycle.');

  const totals = new Map<string, number>();
  const add = (partId: string, amount: number): void => {
    if (!Number.isFinite(amount))
      throw new RangeError('Component quantity multiplication overflowed.');
    const next = (totals.get(partId) ?? 0) + amount;
    if (!Number.isFinite(next)) throw new RangeError('Aggregated component quantity overflowed.');
    totals.set(partId, next);
  };
  let expansions = 0;
  for (const value of inputDemand) {
    const request = record(value, ['partId', 'quantity'], 'demand');
    const partId = text(request.partId, 'demand part ID');
    if (!parts.has(partId)) throw new TypeError(`Unknown demanded part: ${partId}`);
    const amount = quantity(request.quantity, 'demand quantity');
    const stack = [{ partId, amount, includeSelf: parsedOptions.includeDemandedParts === true }];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current.includeSelf) add(current.partId, current.amount);
      for (const component of parts.get(current.partId)!.components) {
        expansions++;
        if (expansions > 1_000_000) {
          throw new RangeError('Bill of materials exceeds one million rollup expansions.');
        }
        const required = current.amount * component.quantity;
        if (!Number.isFinite(required)) {
          throw new RangeError('Component quantity multiplication overflowed.');
        }
        add(component.partId, required);
        stack.push({ partId: component.partId, amount: required, includeSelf: false });
      }
    }
  }
  const requirements = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([partId, amount]) =>
      Object.freeze({ partId, quantity: amount, unit: parts.get(partId)!.unit }),
    );
  return Object.freeze({ requirements: Object.freeze(requirements) });
}
