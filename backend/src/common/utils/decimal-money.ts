export const decimalMoneyPattern = /^\d{1,10}(\.\d{1,2})?$/;
export const normalizedDecimalMoneyPattern = /^\d{1,10}\.\d{2}$/;

export function normalizeMoneyInput(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  if (!decimalMoneyPattern.test(trimmedValue)) {
    return trimmedValue;
  }

  return normalizeMoney(trimmedValue);
}

export function normalizeMoney(value: string): string {
  const [integerPart = '0', fractionalPart = ''] = value.split('.');
  const normalizedIntegerPart = integerPart.replace(/^0+(?=\d)/, '');

  return `${normalizedIntegerPart}.${fractionalPart.padEnd(2, '0')}`;
}

export function addMoney(...values: readonly string[]): string {
  return formatMinorUnits(values.reduce((total, value) => total + toMinorUnits(value), 0n));
}

export function subtractMoney(minuend: string, subtrahend: string): string {
  return formatMinorUnits(toMinorUnits(minuend) - toMinorUnits(subtrahend));
}

export function compareMoney(firstValue: string, secondValue: string): number {
  const firstMinorUnits = toMinorUnits(firstValue);
  const secondMinorUnits = toMinorUnits(secondValue);

  if (firstMinorUnits === secondMinorUnits) {
    return 0;
  }

  return firstMinorUnits > secondMinorUnits ? 1 : -1;
}

export function calculatePercentage(numerator: string, denominator: string): string | null {
  const numeratorMinorUnits = toMinorUnits(numerator);
  const denominatorMinorUnits = toMinorUnits(denominator);

  if (denominatorMinorUnits === 0n) {
    return null;
  }

  const percentageMinorUnits =
    (numeratorMinorUnits * 10000n + denominatorMinorUnits / 2n) / denominatorMinorUnits;

  return formatMinorUnits(percentageMinorUnits);
}

export function toMinorUnits(value: string): bigint {
  const normalizedValue = normalizeMoney(value);
  const sign = normalizedValue.startsWith('-') ? -1n : 1n;
  const unsignedValue = normalizedValue.replace('-', '');
  const [integerPart = '0', fractionalPart = '00'] = unsignedValue.split('.');

  return sign * (BigInt(integerPart) * 100n + BigInt(fractionalPart.padEnd(2, '0')));
}

function formatMinorUnits(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absoluteValue = value < 0n ? -value : value;
  const integerPart = absoluteValue / 100n;
  const fractionalPart = absoluteValue % 100n;

  return `${sign}${integerPart.toString()}.${fractionalPart.toString().padStart(2, '0')}`;
}
