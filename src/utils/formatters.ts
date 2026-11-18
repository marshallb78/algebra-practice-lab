/**
 * Compact number formatting for clicker economy.
 */

const SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'UDc',
  'Ddc',
  'Tdc',
  'Qadc',
  'Qidc',
  'Sxdc',
  'Spdc',
  'Ocdc',
  'Nmdc',
  'Vg',
  'UVg',
  'DVg',
  'TrVg',
  'QaVg',
  'QnVg',
  'SeVg',
  'SpVg',
  'OVg',
  'NVg',
  'Tg',
  'UTg',
  'DTg',
  'TrTg',
  'QaTg',
  'QnTg',
  'SeTg',
  'SpTg',
  'OTg',
  'NTg',
  'QAg',
  'UQAg',
  'DQAg',
  'TrQAg',
  'QaQAg',
  'QnQAg',
  'SeQAg',
  'SpQAg',
  'OQAg',
  'NQAg',
  'Qqg',
  'UQqg',
  'DQqg',
  'TrQqg',
  'QaQqg',
  'QnQqg',
  'SeQqg',
  'SpQqg',
  'OQqg',
  'NQqg',
  'Sxg',
  'USxg',
  'DSxg',
  'TrSxg',
  'QaSxg',
  'QnSxg',
  'SeSxg',
  'SpSxg',
  'OSxg',
  'NSxg',
  'Stg',
  'UStg',
  'DStg',
  'TrStg',
  'QaStg',
  'QnStg',
  'SeStg',
  'SpStg',
  'OStg',
  'NStg',
  'Og',
  'UOg',
  'DOg',
  'TrOg',
  'QaOg',
  'QnOg',
  'SeOg',
  'SpOg',
  'OOg',
  'NOg',
  'Ng',
  'UNg',
  'DNg',
  'TrNg',
  'QaNg',
  'QnNg',
  'SeNg',
  'SpNg',
  'ONg',
  'NNg',
  'Ctg',
];

export function formatKrillion(krillionVal: number, precision: number = 2): string {
  if (!Number.isFinite(krillionVal) || krillionVal <= 0) return '0 Krillion';
  if (krillionVal < 1000) {
    return `${krillionVal.toFixed(krillionVal >= 100 ? 1 : precision)} Krillion`;
  }
  if (krillionVal < 1e12) {
    return `${Math.floor(krillionVal).toLocaleString()} Krillion`;
  }
  return `${krillionVal.toExponential(2).replace('+', '')} Krillion`;
}

export function formatCoins(val: number, precision: number = 1): string {
  if (isNaN(val) || val <= 0) return '0';
  if (!isFinite(val)) return '∞';

  if (val >= 1e306) {
    return formatKrillion(val / 1e306, precision);
  }

  if (val < 1000) {
    return val >= 10 ? Math.floor(val).toLocaleString() : (Math.round(val * 10) / 10).toString();
  }

  const tier = Math.floor(Math.log10(val) / 3 + 1e-12);
  if (tier >= SUFFIXES.length) return formatKrillion(val / 1e306, precision);

  const scale = Math.pow(10, tier * 3);
  const scaled = val / scale;

  return scaled.toFixed(precision) + SUFFIXES[tier];
}

export function formatExtendedCoins(
  coins: number,
  krillion: number = 0,
  precision: number = 1
): string {
  const safeKr = typeof krillion === 'number' && Number.isFinite(krillion) && krillion > 0 ? krillion : 0;
  if (safeKr > 0) {
    const extra = typeof coins === 'number' && Number.isFinite(coins) && coins > 0 ? coins / 1e306 : 0;
    return formatKrillion(safeKr + extra, 2);
  }
  return formatCoins(coins, precision);
}

export function formatNumber(val: number): string {
  return Math.floor(val).toLocaleString();
}

export function formatTime(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  if (safeSec < 60) return `${safeSec}s`;
  const m = Math.floor(safeSec / 60);
  const s = safeSec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return `${h}h ${remM}m`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return `${d}d ${remH}h ${remM}m`;
}
