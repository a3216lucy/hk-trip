import { Expense, SplitMode, Transfer } from './models';

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

/** 依權重把金額（分）切開，餘數依序補給前面的人，確保加總一定等於總額。 */
function allocate(totalCents: number, names: string[], weights: number[]): Record<string, number> {
  const sum = weights.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  if (!names.length || sum <= 0) return out;
  const base = weights.map((w) => Math.floor((totalCents * w) / sum));
  let rest = totalCents - base.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % names.length, rest--) base[i]++;
  names.forEach((n, i) => (out[n] = fromCents(base[i])));
  return out;
}

export interface SplitResult {
  shares: Record<string, number>;
  error: string | null;
}

export function computeShares(
  mode: SplitMode,
  amount: number,
  participants: string[],
  weights: Record<string, number>,
): SplitResult {
  if (!(amount > 0)) return { shares: {}, error: '請輸入金額' };
  if (!participants.length) return { shares: {}, error: '請至少勾選一位分攤的人' };
  const total = toCents(amount);

  if (mode === 'equal') {
    return { shares: allocate(total, participants, participants.map(() => 1)), error: null };
  }
  if (mode === 'ratio') {
    const w = participants.map((p) => Number(weights[p]) || 0);
    if (w.some((x) => x < 0) || w.every((x) => x === 0)) return { shares: {}, error: '請填入比例' };
    return { shares: allocate(total, participants, w), error: null };
  }
  const shares: Record<string, number> = {};
  let sum = 0;
  for (const p of participants) {
    const c = toCents(Number(weights[p]) || 0);
    shares[p] = fromCents(c);
    sum += c;
  }
  if (sum !== total) {
    return { shares, error: `自填金額合計 ${fromCents(sum)}，與總額 ${amount} 差 ${fromCents(total - sum)}` };
  }
  return { shares, error: null };
}

/** 每人淨額：正數 = 別人欠他，負數 = 他欠別人 */
export function balances(expenses: Expense[], members: string[]): Record<string, number> {
  const net: Record<string, number> = {};
  members.forEach((m) => (net[m] = 0));
  for (const e of expenses) {
    net[e.payer] = (net[e.payer] ?? 0) + toCents(e.amount);
    for (const [p, s] of Object.entries(e.shares)) net[p] = (net[p] ?? 0) - toCents(s);
  }
  const out: Record<string, number> = {};
  for (const k of Object.keys(net)) out[k] = fromCents(net[k]);
  return out;
}

/** 最少筆數的轉帳建議 */
export function settle(net: Record<string, number>): Transfer[] {
  const cr = Object.entries(net).map(([n, v]) => ({ n, c: toCents(v) })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c);
  const db = Object.entries(net).map(([n, v]) => ({ n, c: -toCents(v) })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < cr.length && j < db.length) {
    const t = Math.min(cr[i].c, db[j].c);
    out.push({ from: db[j].n, to: cr[i].n, amount: fromCents(t) });
    cr[i].c -= t;
    db[j].c -= t;
    if (cr[i].c === 0) i++;
    if (db[j].c === 0) j++;
  }
  return out;
}
