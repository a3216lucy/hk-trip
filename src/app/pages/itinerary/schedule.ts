import { Item } from '../../core/models';
import { DetailRow, dur } from './stop-meta';

const AIRPORT = '香港國際機場';

const parseHm = (v: string): number | null =>
  /^\d{1,2}:\d{2}$/.test(v ?? '') ? Number(v.split(':')[0]) * 60 + Number(v.split(':')[1]) : null;

/** 分鐘數 → HH:mm（超過 24 小時會繞回） */
export function fmtMin(min: number): string {
  const t = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * 當天各站的預計抵達（分鐘數）。有填時間的站以你填的為準；沒填的 ＝ 上一站離開時間 ＋ 這一站的交通時間。
 * 離開時間：有結束/抵達時間（航班）就用它；抵達香港的班機再加 60 分（入境、領行李）；否則 抵達 ＋ 停留。
 */
export function computeEtas(stops: Item[]): Map<string, number> {
  const out = new Map<string, number>();
  let prevDep: number | null = null;
  for (const it of stops) {
    const own = parseHm(it.time);
    const arrival: number | null = own ?? (prevDep != null ? prevDep + (it.travelMin || 0) : null);
    if (own == null && arrival != null) out.set(it.id, arrival);
    const end = parseHm(it.endTime);
    const exitAirport = it.type === 'flight' && it.title.includes('→ 香港') && end != null ? end + 60 : null;
    prevDep = arrival == null ? null : exitAirport ?? end ?? arrival + (it.stay || 0);
  }
  return out;
}

/** 08:15 — 08:45；沒填時間就用預計抵達並加「預計」；沒填結束時間就用「開始 ＋ 停留」推算 */
export function rangeText(it: Item, eta: string): string {
  const est = !it.time;
  const start = it.time || eta;
  if (!start) return '';
  let end = it.endTime;
  if (!end && it.stay) {
    const [h, m] = start.split(':').map(Number);
    end = fmtMin(h * 60 + m + it.stay);
  }
  return (est ? '預計 ' : '') + (end ? `${start} — ${end}` : start);
}

/** 卡片收合時顯示的摘要行；展開後營業時間、地址、備註、店家都在下方各自一行，摘要只留抵達與停留 */
export function summaryLines(it: Item, open: boolean): string[] {
  const out: string[] = [];
  if (it.type === 'hotel' && it.address) out.push(it.address);
  if (it.type === 'hotel') {
    const f = (it.note || '').split('\n')[0].trim();
    if (f.includes('·')) out.push(f);
  }
  if (it.type === 'flight' && it.endTime) out.push(`${it.endTime} 抵達`);
  if (it.hours) out.push(`營業時間 ${it.hours}`);
  if (it.stay) out.push(`預計停留 ${dur(it.stay)}`);
  if (it.subs.length) out.push(`${it.subs.length} 個選項`);
  return open ? out.filter((l) => l.endsWith(' 抵達') || l.startsWith('預計停留')) : out;
}

export function noteLines(it: Item): string[] {
  return (it.note || '').split('\n').map((x) => x.trim()).filter(Boolean);
}

/** 展開後要顯示的每一行，每行都可以單獨編輯、刪除 */
export function detailRows(it: Item): DetailRow[] {
  const rows: DetailRow[] = [];
  if (it.hours) rows.push({ kind: 'hours', idx: null, icon: 'clock', title: `營業時間 ${it.hours}`, sub: '' });
  if (it.address) rows.push({ kind: 'address', idx: null, icon: 'pin', title: it.address, sub: '' });
  noteLines(it).forEach((n, i) => rows.push({ kind: 'note', idx: i, icon: 'info', title: n, sub: '' }));
  it.subs.forEach((x, i) =>
    rows.push({ kind: 'sub', idx: i, icon: 'food', title: x.name, sub: [x.hours, x.note].filter(Boolean).join(' · ') }),
  );
  return rows;
}

export function poolHint(it: Item): string {
  if (it.hours) return `營業時間 ${it.hours}`;
  if (it.address) return it.address;
  const n = (it.note || '').split('\n')[0].trim();
  return n.length > 40 ? n.slice(0, 40) + '…' : n;
}

// ---- Google Maps 網址 ----
/** 站名去掉括號說明，並取斜線前的第一個選項，方便 Google Maps 搜尋 */
function placeName(title: string): string {
  return title.replace(/（[^）]*）|\([^)]*\)/g, '').split('/')[0].trim();
}
/** 這一站在 Google Maps 上要搜尋的地點；不是地點的站（搭電車、沒有地址的早餐/整理行李）回傳空字串 */
export function placeQuery(it: Item): string {
  if (it.type === 'flight') return AIRPORT;
  if (it.type === 'transit') return '';
  const addr = it.address?.trim();
  if (addr) return addr;
  if (/早餐|午餐|整理/.test(it.title)) return '';
  const first = it.subs[0]?.note ?? '';
  return /[街道路號]/.test(first) ? first : placeName(it.title) + ' 香港';
}
export const mapUrl = (it: Item) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.address || `${it.title} 香港`)}`;

/** 當天路線總覽：Google Maps 的大眾運輸模式不支援多個途經點，所以只當地圖總覽，搭車資訊請用每段交通旁的「查路線」。 */
export function routeUrl(stops: Item[]): string {
  const places: string[] = [];
  for (const it of stops) {
    const q = placeQuery(it);
    if (q && places[places.length - 1] !== q) places.push(q);
  }
  if (places.length < 2) return '';
  const used = places.slice(0, 11); // 起點 + 最多 9 個途經點 + 終點
  const enc = encodeURIComponent;
  const mids = used.slice(1, -1).map(enc).join('%7C');
  return 'https://www.google.com/maps/dir/?api=1' + `&origin=${enc(used[0])}&destination=${enc(used[used.length - 1])}` + (mids ? `&waypoints=${mids}` : '');
}
/** 兩站之間的大眾運輸路線（只帶起點與終點，Google Maps 才會顯示搭車資訊） */
export function legUrl(stops: Item[], i: number): string {
  const from = stops[i - 1] && placeQuery(stops[i - 1]);
  const to = stops[i] && placeQuery(stops[i]);
  if (!from || !to || from === to) return '';
  return `https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`;
}
