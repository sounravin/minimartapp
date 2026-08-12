export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatKhr(amount: number): string {
  const rounded = Math.round(amount);
  return `${new Intl.NumberFormat('km-KH').format(rounded)} ៛`;
}

export function generateReceiptNo(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(100 + Math.random() * 900);
  return `INV-${dateStr}-${random}`;
}

export function generateBarcodeNumber(): string {
  // Generate EAN-13 style starting with 884 (Cambodia prefix code)
  let result = '884';
  for (let i = 0; i < 9; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  // Calculate check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(result[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return result + checkDigit;
}

export function formatKhmerDateTime(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
