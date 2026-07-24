const decimalMoneyPattern = /^\d{1,10}(\.\d{1,2})?$/;
const signedDecimalMoneyPattern = /^-?\d+(\.\d{1,2})?$/;

export function isValidMoneyInput(value: string): boolean {
  return decimalMoneyPattern.test(value.trim());
}

export function normalizeMoneyInput(value: string): string {
  const trimmedValue = value.trim();
  const [integerPart = '0', fractionalPart = ''] = trimmedValue.split('.');
  const normalizedIntegerPart = integerPart.replace(/^0+(?=\d)/, '');

  return `${normalizedIntegerPart}.${fractionalPart.padEnd(2, '0')}`;
}

export function formatMoney(value: string | null): string {
  if (value === null) {
    return 'No disponible';
  }

  if (!signedDecimalMoneyPattern.test(value)) {
    return value;
  }

  const isNegative = value.startsWith('-');
  const unsignedValue = value.replace('-', '');
  const [integerPart = '0', fractionalPart = '00'] = unsignedValue.split('.');
  const groupedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const amount = `${groupedIntegerPart},${fractionalPart.padEnd(2, '0')}`;

  return isNegative ? `-Bs ${amount}` : `Bs ${amount}`;
}

export function formatPercentage(value: string | null): string {
  if (value === null) {
    return 'No aplica';
  }

  const [integerPart = '0', fractionalPart = '00'] = value.split('.');

  return `${integerPart},${fractionalPart.padEnd(2, '0')}%`;
}

export function compareMoney(firstValue: string, secondValue: string): number {
  const firstMinorUnits = toMinorUnits(firstValue);
  const secondMinorUnits = toMinorUnits(secondValue);

  if (firstMinorUnits === secondMinorUnits) {
    return 0;
  }

  return firstMinorUnits > secondMinorUnits ? 1 : -1;
}

function toMinorUnits(value: string): bigint {
  const normalizedValue = value.includes('.') ? value : `${value}.00`;
  const sign = normalizedValue.startsWith('-') ? -1n : 1n;
  const unsignedValue = normalizedValue.replace('-', '');
  const [integerPart = '0', fractionalPart = '00'] = unsignedValue.split('.');

  return sign * (BigInt(integerPart) * 100n + BigInt(fractionalPart.padEnd(2, '0')));
}
