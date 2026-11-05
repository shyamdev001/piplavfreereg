const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${ONES[n % 10].toLowerCase()}` : t;
}

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
  if (n % 100) parts.push(belowHundred(n % 100));
  return parts.join(' ');
}

/**
 * Whole rupees in Indian numbering words, e.g. 97290 ->
 * "Indian Rupee Ninety-seven Thousand Two Hundred Ninety Only".
 */
export function rupeesInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return 'Indian Rupee Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  const words = parts.join(' ');
  // Match the template's sentence case: "Indian Rupee One Lakh Sixty-eight Thousand ..."
  return `Indian Rupee ${words} Only`;
}

/** 168700 -> "1,68,700.00" (Indian digit grouping). */
export function formatIndianAmount(amount: number): string {
  const [intPart, dec] = amount.toFixed(2).split('.');
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${grouped}.${dec}`;
}
