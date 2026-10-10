// Birr amounts in Amharic words, as written on receipts and vouchers:
//   1500.50 → "አንድ ሺህ አምስት መቶ ብር ከሃምሳ ሳንቲም ብቻ"

const ONES = ['', 'አንድ', 'ሁለት', 'ሦስት', 'አራት', 'አምስት', 'ስድስት', 'ሰባት', 'ስምንት', 'ዘጠኝ'];
const TENS = ['', 'አሥር', 'ሃያ', 'ሠላሳ', 'አርባ', 'ሃምሳ', 'ስልሳ', 'ሰባ', 'ሰማንያ', 'ዘጠና'];

function below1000(n: number): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  if (h) out.push(ONES[h], 'መቶ');
  if (t === 1 && o) out.push('አሥራ', ONES[o]);   // 11–19: አሥራ አንድ …
  else {
    if (t) out.push(TENS[t]);
    if (o) out.push(ONES[o]);
  }
  return out;
}

/** Whole number in Amharic words (0 – 999,999,999,999). */
function amharicWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'ዜሮ';
  const scales: [number, string][] = [[1e9, 'ቢሊዮን'], [1e6, 'ሚሊዮን'], [1e3, 'ሺህ']];
  const words: string[] = [];
  for (const [size, name] of scales) {
    const chunk = Math.floor(n / size);
    if (chunk) { words.push(...below1000(chunk), name); n %= size; }
  }
  words.push(...below1000(n));
  return words.join(' ');
}

/** "<words> ብር [ከ<words> ሳንቲም] ብቻ" */
export function birrInWords(amount: number | string): string {
  const cents = Math.round(Number(amount) * 100);
  const birr = Math.floor(cents / 100);
  const santim = cents % 100;
  return `${amharicWords(birr)} ብር${santim ? ` ከ${amharicWords(santim)} ሳንቲም` : ''} ብቻ`;
}
