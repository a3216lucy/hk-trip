import { Injectable, computed, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  Firestore, Unsubscribe, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot,
  setDoc, writeBatch,
} from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { Expense, Item, Note, PackItem, Sub } from './models';
import { applyInfo } from './place-info';
import { HOTEL_ADDR, SEED_ITEMS, SEED_NOTES } from './seed';

const KEY_STORE = 'hk-trip:key';
const ME_STORE = 'hk-trip:me';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hk-trip:' + text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** 遞迴把所有文字裡的全形斜線「／」換成半形「/」（陣列、物件裡的文字也處理） */
function halfSlash(v: unknown): unknown {
  if (typeof v === 'string') return v.replace(/／/g, '/');
  if (Array.isArray(v)) return v.map(halfSlash);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, halfSlash(x)]));
  return v;
}
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => {
  try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 私密模式 */ }
};

@Injectable({ providedIn: 'root' })
export class TripService {
  private db: Firestore | null = null;
  private unsubs: Unsubscribe[] = [];

  readonly configured = !environment.firebase.apiKey.startsWith('YOUR_');
  readonly key = signal<string | null>(null);
  readonly members = signal<string[]>([]);
  readonly me = signal<string | null>(read(ME_STORE));
  readonly items = signal<Item[]>([]);
  readonly expenses = signal<Expense[]>([]);
  readonly notes = signal<Note[]>([]);
  readonly packing = signal<PackItem[]>([]);
  readonly ready = signal(false);
  readonly unlocked = computed(() => !!this.key() && this.ready());

  constructor() {
    if (this.configured) this.db = getFirestore(initializeApp(environment.firebase));
    const saved = read(KEY_STORE);
    if (saved && this.db) void this.open(saved).then((ok) => { if (!ok) write(KEY_STORE, null); });
    else this.ready.set(true);
  }

  private col(name: string) { return collection(this.db!, 'trips', this.key()!, name); }

  /** 嘗試用密碼開啟；找不到這組密碼回傳 'notfound'。 */
  async unlock(password: string): Promise<'ok' | 'notfound'> {
    const key = await sha256(password.trim());
    return (await this.open(key)) ? 'ok' : 'notfound';
  }

  private async open(key: string): Promise<boolean> {
    const snap = await getDoc(doc(this.db!, 'trips', key));
    if (!snap.exists()) return false;
    await this.migrateLegacyItems(key);
    // 行程已經換成最終版（v2-開頭的站存在）就不要再跑任何改行程的搬移，免得蓋掉你在網站上改過的內容。
    // 最終版存在之後，所有一次性搬移（行程、筆記、行李）一律不再執行，資料以資料庫裡現在的內容為準。
    const itineraryDone = (await getDoc(doc(this.db!, 'trips', key, 'items', 'v2-000'))).exists();
    if (itineraryDone && snap.data()['planV2'] !== true) await setDoc(doc(this.db!, 'trips', key), { planV2: true }, { merge: true });
    if (!itineraryDone) await this.ensureHotelStarts(key, snap.data()['hotelStarts'] === true);
    if (!itineraryDone) await this.ensureHotelInfo(key, snap.data()['hotelInfo'] === true);
    if (!itineraryDone) await this.ensureNotesV2(key, snap.data()['notesV2'] === true);
    if (!itineraryDone) await this.ensureHalfSlash(key, snap.data()['slashFix'] === true);
    if (!itineraryDone) await this.ensureCabinReminders(key, snap.data()['cabinNote'] === true);
    if (!itineraryDone) await this.tidyReminders(key, snap.data()['reminderTidy'] === true);
    if (!itineraryDone) await this.ensurePackExtras(key, snap.data()['packExtras'] === true);
    if (!itineraryDone) await this.ensurePackExtras2(key, snap.data()['packExtras2'] === true);
    if (!itineraryDone) await this.ensurePackExtras3(key, snap.data()['packExtras3'] === true);
    if (!itineraryDone) await this.ensurePackExtras4(key, snap.data()['packExtras4'] === true);
    if (!itineraryDone) await this.moveEsim(key, snap.data()['esimMoved'] === true);
    if (!itineraryDone) await this.moveCarryOn(key, snap.data()['carryMoved'] === true);
    if (!itineraryDone) await this.ensurePackExtras5(key, snap.data()['packExtras5'] === true);
    if (!itineraryDone) await this.fixBreakfastNote(key, snap.data()['breakfastNote'] === true);
    if (!itineraryDone) await this.renameShower(key, snap.data()['showerRename'] === true);
    if (!itineraryDone) await this.addMealsInfo(key, snap.data()['mealsNote'] === true);
    if (!itineraryDone) await this.ensurePackExtras6(key, snap.data()['packExtras6'] === true);
    if (!itineraryDone) await this.addPlanCards(key, snap.data()['planCards'] === true);
    if (!itineraryDone) await this.fixEntryDocs(key, snap.data()['entryDocs'] === true);
    if (!itineraryDone) await this.addDay1Plan(key, snap.data()['day1Plan'] === true);
    if (!itineraryDone) await this.tweakCards1(key, snap.data()['cardTweak1'] === true);
    if (!itineraryDone) await this.ensurePackExtras7(key, snap.data()['packExtras7'] === true);
    if (!itineraryDone) await this.clearHotelTime(key, snap.data()['hotelEta'] === true);
    if (!itineraryDone) await this.todoFirst(key, snap.data()['todoFirst'] === true);
    if (!itineraryDone) await this.syncDays(key, snap.data()['daysSync3'] === true);
    if (!itineraryDone) await this.syncPlaceInfo(key, snap.data()['placeInfo1'] === true);
    if (!itineraryDone) await this.addStarPicks(key, snap.data()['starPicks1'] === true);
    if (!itineraryDone) await this.addStarPicks2(key, snap.data()['starPicks2'] === true);
    if (!itineraryDone) await this.orderSubs(key, snap.data()['subOrder1'] === true);
    if (!itineraryDone) await this.addPhotos(key, snap.data()['photos1'] === true);
    if (!itineraryDone) await this.walledCityStay(key, snap.data()['walledCity1'] === true);
    if (!itineraryDone) await this.wanChaiMorning(key, snap.data()['wanChai3'] === true);
    if (!itineraryDone) await this.day3Breakfast(key, snap.data()['day3Breakfast1'] === true);
    if (!itineraryDone) await this.weekdayHours(key, snap.data()['weekday1'] === true);
    if (!itineraryDone) await this.boatToDay1(key, snap.data()['boatDay1'] === true);
    if (!itineraryDone) await this.day1Eats(key, snap.data()['day1Eats1'] === true);
    if (!itineraryDone) await this.addGuides(key, snap.data()['guides1'] === true);
    if (!itineraryDone) await this.dropPie(key, snap.data()['dropPie1'] === true);
    if (!itineraryDone) await this.addRefs(key, snap.data()['refs1'] === true);
    if (!itineraryDone) await this.sisterWah(key, snap.data()['sisterWah1'] === true);
    if (!itineraryDone) await this.day1Fix(key, snap.data()['day1Fix1'] === true);
    if (!itineraryDone) await this.planV2(key, snap.data()['planV2'] === true);
    if (!itineraryDone) await this.dimSumBranches(key, snap.data()['dimSum1'] === true);
    if (!itineraryDone) await this.moveScale(key, snap.data()['scaleMoved'] === true);
    // 例外：只「新增」選項與一個新站、在備註後面補一句，不改你已經編輯過的欄位，所以最終版之後也照樣跑一次。
    await this.thursdayEats(key, snap.data()['thursdayEats1'] === true);
    await this.thursdayDinner(key, snap.data()['thursdayDinner1'] === true);
    await this.dropDimSum(key, snap.data()['dropDimSum1'] === true);
    await this.foldDinner(key, snap.data()['foldDinner1'] === true);
    await this.thursdayPmq(key, snap.data()['thursdayPmq1'] === true);
    this.start(key, (snap.data()['members'] as string[]) ?? []);
    return true;
  }

  /** 舊版行程（沒有 type 欄位）一次性換成新版站點格式。已是新格式的不動。 */
  private async migrateLegacyItems(key: string) {
    const col = collection(this.db!, 'trips', key, 'items');
    const old = await getDocs(col);
    if (!old.docs.some((d) => d.data()['type'] === undefined)) return;
    const batch = writeBatch(this.db!);
    old.docs.filter((d) => d.data()['type'] === undefined).forEach((d) => batch.delete(d.ref));
    SEED_ITEMS.forEach((s, i) => batch.set(doc(col, 'v2-' + String(i).padStart(3, '0')), s));
    await batch.commit();
  }

  /** 既有旅行補上 11/25、11/26 的「從飯店出發」。只做一次，之後刪掉也不會再長回來。 */
  private async ensureHotelStarts(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const all = (await getDocs(col)).docs.map((d) => ({ ref: d.ref, ...(d.data() as Omit<Item, 'id'>) }));
    const batch = writeBatch(this.db!);
    for (const day of ['2026-11-25', '2026-11-26']) {
      const mine = all.filter((i) => i.day === day);
      if (!mine.length || mine.some((i) => i.type === 'hotel')) continue;
      const first = Math.min(...mine.map((i) => i.order));
      batch.set(doc(col, 'v3-hotel-' + day), {
        day, type: 'hotel', title: '從雅格飯店出發', time: '08:30', endTime: '', stay: 0, hours: '',
        address: HOTEL_ADDR, note: '港鐵黃竹坑站（南港島線）。', done: false, order: first - 0.5,
        travelMode: '', travelMin: 0, subs: [],
      });
    }
    batch.set(doc(this.db!, 'trips', key), { hotelStarts: true }, { merge: true });
    await batch.commit();
  }

  /** 既有旅行的入住站補上 15:30 與房型/日期說明。只做一次。 */
  private async ensureHotelInfo(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const hit = (await getDocs(col)).docs.find((d) => d.data()['day'] === '2026-11-24' && d.data()['type'] === 'hotel');
    const batch = writeBatch(this.db!);
    if (hit) {
      const d = hit.data();
      batch.update(hit.ref, {
        time: d['time'] || '15:30',
        note: String(d['note'] ?? '').includes('三人房') ? d['note'] : '三人房 · 入住 11/24（二）→ 退房 11/27（五）\n' + (d['note'] ?? ''),
      });
    }
    batch.set(doc(this.db!, 'trips', key), { hotelInfo: true }, { merge: true });
    await batch.commit();
  }

  /** 舊版純文字筆記（沒有 rows）一次性換成結構化卡片；已是新格式的筆記不動。 */
  private async ensureNotesV2(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'notes');
    const all = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    all.filter((d) => d.data()['rows'] === undefined).forEach((d) => batch.delete(d.ref));
    if (!all.some((d) => d.data()['rows'] !== undefined)) {
      SEED_NOTES.forEach((s, i) => batch.set(doc(col, 'v2-n' + i), s));
    }
    batch.set(doc(this.db!, 'trips', key), { notesV2: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：把既有資料裡的全形斜線「／」全部換成半形「/」。只做一次。 */
  private async ensureHalfSlash(key: string, done: boolean) {
    if (done) return;
    let batch = writeBatch(this.db!);
    let n = 0;
    for (const name of ['items', 'notes', 'expenses', 'packing']) {
      const snap = await getDocs(collection(this.db!, 'trips', key, name));
      for (const d of snap.docs) {
        const before = JSON.stringify(d.data());
        if (!before.includes('／')) continue;
        batch.set(d.ref, halfSlash(d.data()) as Record<string, unknown>);
        if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(this.db!); }
      }
    }
    batch.set(doc(this.db!, 'trips', key), { slashFix: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：已經有行李清單的人，補上「帽子」（衣物）和「eSIM」（電子用品）。已經有的不重複加。 */
  private async ensurePackExtras(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'packing');
    const all = (await getDocs(col)).docs.map((d) => d.data() as { owner: string; label: string; order: number });
    const batch = writeBatch(this.db!);
    const next: Record<string, number> = {};
    for (const owner of new Set(all.map((p) => p.owner))) {
      const mine = all.filter((p) => p.owner === owner);
      next[owner] = Math.max(...mine.map((p) => p.order)) + 1;
      const has = (re: RegExp) => mine.some((p) => re.test(p.label));
      if (!has(/帽/)) batch.set(doc(col), { owner, category: '衣物', label: '帽子', qty: null, note: null, done: false, order: next[owner]++ });
      if (!has(/esim/i)) batch.set(doc(col), { owner, category: '電子用品', label: 'eSIM', qty: null, note: null, done: false, order: next[owner]++ });
    }
    batch.set(doc(this.db!, 'trips', key), { packExtras: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：已經有行李清單的人，補上幾個常被漏掉的項目。清單裡已經有類似項目的不重複加。flag 是旅行資料上的完成標記。 */
  private async backfillPack(key: string, flag: string, done: boolean, extras: { category: string; label: string; has: RegExp }[]) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'packing');
    const all = (await getDocs(col)).docs.map((d) => d.data() as { owner: string; label: string; order: number });
    const batch = writeBatch(this.db!);
    for (const owner of new Set(all.map((p) => p.owner))) {
      const mine = all.filter((p) => p.owner === owner);
      let order = Math.max(...mine.map((p) => p.order)) + 1;
      for (const x of extras) {
        if (mine.some((p) => x.has.test(p.label))) continue;
        batch.set(doc(col), { owner, category: x.category, label: x.label, qty: null, note: null, done: false, order: order++ });
      }
    }
    batch.set(doc(this.db!, 'trips', key), { [flag]: true }, { merge: true });
    await batch.commit();
  }
  private ensurePackExtras2(key: string, done: boolean) {
    return this.backfillPack(key, 'packExtras2', done, [
      { category: '隨身包（登機）', label: '信用卡 ・ 提款卡', has: /提款卡|信用卡/ },
      { category: '衣物', label: '睡衣 ・ 拖鞋', has: /睡衣|拖鞋/ },
      { category: '衣物', label: '太陽眼鏡', has: /太陽眼鏡/ },
      { category: '證件文件', label: '護照影本（或電子檔）', has: /護照影本|電子檔/ },
      { category: '盥洗保養', label: '保濕乳液 ・ 護唇膏', has: /保濕|護唇/ },
      { category: '藥品雜物', label: '密封袋', has: /密封袋/ },
      { category: '藥品雜物', label: '行李鎖 ・ 行李標籤', has: /行李鎖|行李標籤/ },
    ]);
  }
  private ensurePackExtras3(key: string, done: boolean) {
    return this.backfillPack(key, 'packExtras3', done, [
      { category: '隨身包（登機）', label: '面紙', has: /面紙|衛生紙/ },
      { category: '盥洗保養', label: '洗臉巾', has: /洗臉巾/ },
    ]);
  }

  private ensurePackExtras4(key: string, done: boolean) {
    return this.backfillPack(key, 'packExtras4', done, [
      { category: '盥洗保養', label: '梳子 ・ 髮圈', has: /梳子|髮圈/ },
    ]);
  }

  /** 一次性：把「電子用品」裡的 eSIM 搬到「證件文件」（出發前要確認 QR code 的東西）。 */
  private async moveEsim(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'packing');
    const hits = (await getDocs(col)).docs.filter((d) => /esim/i.test(String(d.data()['label'])) && d.data()['category'] === '電子用品');
    const batch = writeBatch(this.db!);
    hits.forEach((d) => batch.update(d.ref, { category: '證件文件', label: 'eSIM（QR code 截圖）' }));
    batch.set(doc(this.db!, 'trips', key), { esimMoved: true, cabinNote: true, reminderTidy: true, carryMoved: true, packExtras5: true, breakfastNote: true, showerRename: true, mealsNote: true, packExtras6: true, planCards: true, entryDocs: true, day1Plan: true, cardTweak1: true, packExtras7: true, scaleMoved: true, hotelEta: true, todoFirst: true, daysSync3: true, placeInfo1: true, starPicks1: true, starPicks2: true, subOrder1: true, photos1: true, walledCity1: true, wanChai3: true, day3Breakfast1: true, weekday1: true, boatDay1: true, day1Eats1: true, guides1: true, dropPie1: true, refs1: true, sisterWah1: true, day1Fix1: true, planV2: true, dimSum1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：在既有的「提醒事項」筆記卡補上「隨身／託運」三條提醒（已經有的不重複加）。 */
  private async ensureCabinReminders(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'notes');
    const hit = (await getDocs(col)).docs.find((d) => d.data()['title'] === '提醒事項' && Array.isArray(d.data()['rows']));
    const batch = writeBatch(this.db!);
    if (hit) {
      const rows = hit.data()['rows'] as { a?: string }[];
      if (!rows.some((r) => String(r.a ?? '').includes('託運'))) {
        const add = SEED_NOTES.find((n) => n.title === '提醒事項')!.rows!.filter((r) => r.a.includes('託運') || r.a.startsWith('建議隨身帶'));
        batch.update(hit.ref, { rows: [...rows, ...add] });
      }
    }
    batch.set(doc(this.db!, 'trips', key), { cabinNote: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：提醒事項卡片刪掉兩條不要的，並把「只能隨身帶／建議隨身帶」改成新的措辭。 */
  private async tidyReminders(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'notes');
    const hit = (await getDocs(col)).docs.find((d) => d.data()['title'] === '提醒事項' && Array.isArray(d.data()['rows']));
    const batch = writeBatch(this.db!);
    if (hit) {
      const fresh = SEED_NOTES.find((n) => n.title === '提醒事項')!.rows!;
      const newCabin = fresh.find((r) => r.a.startsWith('只能隨身帶'))!;
      const newCarry = fresh.find((r) => r.a.startsWith('建議隨身帶'))!;
      const drop = ['周末人多，熱門餐廳與景點建議先訂位', '營業時間來自收藏貼文，出發前請再確認'];
      const rows = (hit.data()['rows'] as { a?: string }[])
        .filter((r) => !drop.includes(String(r.a ?? '')))
        .map((r) => (String(r.a ?? '').startsWith('只能隨身帶') ? newCabin : String(r.a ?? '').startsWith('建議隨身帶') ? newCarry : r));
      batch.update(hit.ref, { rows });
    }
    batch.set(doc(this.db!, 'trips', key), { reminderTidy: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：把「電子用品」裡的行動電源、耳機搬到「隨身包（登機）」並加上提醒。 */
  private async moveCarryOn(key: string, done: boolean) {
    if (done) return;
    const notes: Record<string, string> = { 行動電源: '只能隨身帶，不可託運', 耳機: '含鋰電池，建議隨身帶' };
    const col = collection(this.db!, 'trips', key, 'packing');
    const hits = (await getDocs(col)).docs.filter((d) => d.data()['category'] === '電子用品' && String(d.data()['label']) in notes);
    const batch = writeBatch(this.db!);
    hits.forEach((d) => batch.update(d.ref, { category: '隨身包（登機）', note: notes[String(d.data()['label'])] }));
    batch.set(doc(this.db!, 'trips', key), { carryMoved: true }, { merge: true });
    await batch.commit();
  }

  private ensurePackExtras5(key: string, done: boolean) {
    return this.backfillPack(key, 'packExtras5', done, [
      { category: '盥洗保養', label: '旅行用蓮蓬頭', has: /蓮蓬頭|過濾/ },
    ]);
  }

  /** 一次性：第 4 天早餐那站的備註，從「飯店附近用早餐」改成「飯店不供餐，早餐在外面吃」。 */
  private async fixBreakfastNote(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const hits = (await getDocs(col)).docs.filter((d) => d.data()['note'] === '飯店附近用早餐，收拾行李、退房。');
    const batch = writeBatch(this.db!);
    hits.forEach((d) => batch.update(d.ref, { note: '飯店不供餐，早餐在外面吃；吃完回飯店收拾行李、退房。' }));
    batch.set(doc(this.db!, 'trips', key), { breakfastNote: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：已經補進去的「蓮蓬頭過濾器」改名成「旅行用蓮蓬頭」。 */
  private async renameShower(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'packing');
    const hits = (await getDocs(col)).docs.filter((d) => d.data()['label'] === '蓮蓬頭過濾器');
    const batch = writeBatch(this.db!);
    hits.forEach((d) => batch.update(d.ref, { label: '旅行用蓮蓬頭' }));
    batch.set(doc(this.db!, 'trips', key), { showerRename: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：第 4 天早餐備註改成「三餐自理」說法；住宿筆記卡補一行「餐食：純住宿，三餐自理」。 */
  private async addMealsInfo(key: string, done: boolean) {
    if (done) return;
    const batch = writeBatch(this.db!);
    const itemsCol = collection(this.db!, 'trips', key, 'items');
    const fresh = '飯店純住宿、不供餐，三餐自理；早餐在外面吃，吃完回飯店收拾行李、退房。';
    const olds = ['飯店附近用早餐，收拾行李、退房。', '飯店不供餐，早餐在外面吃；吃完回飯店收拾行李、退房。'];
    (await getDocs(itemsCol)).docs.filter((d) => olds.includes(String(d.data()['note']))).forEach((d) => batch.update(d.ref, { note: fresh }));
    const notesCol = collection(this.db!, 'trips', key, 'notes');
    const stay = (await getDocs(notesCol)).docs.find((d) => d.data()['title'] === '訂房與入住' && Array.isArray(d.data()['rows']));
    if (stay) {
      const rows = stay.data()['rows'] as { a?: string }[];
      if (!rows.some((r) => r.a === '餐食')) {
        const at = rows.findIndex((r) => r.a === '訂房確認');
        const row = { kind: 'kv', a: '餐食', b: '純住宿，三餐自理', c: '', done: false };
        batch.update(stay.ref, { rows: at >= 0 ? [...rows.slice(0, at + 1), row, ...rows.slice(at + 1)] : [...rows, row] });
      }
    }
    batch.set(doc(this.db!, 'trips', key), { mealsNote: true }, { merge: true });
    await batch.commit();
  }

  private ensurePackExtras6(key: string, done: boolean) {
    return this.backfillPack(key, 'packExtras6', done, [
      { category: '盥洗保養', label: '擦髮巾', has: /擦髮巾|浴巾|毛巾/ },
    ]);
  }

  /** 一次性：補上三張筆記卡（出發前待辦、路線速查、一天一區對照）與五個雨天備案（室內）。標題相同的不重複加。 */
  private async addPlanCards(key: string, done: boolean) {
    if (done) return;
    const batch = writeBatch(this.db!);
    const notesCol = collection(this.db!, 'trips', key, 'notes');
    const have = new Set((await getDocs(notesCol)).docs.map((d) => String(d.data()['title'])));
    SEED_NOTES.filter((n) => ['出發前待辦', '路線速查', '一天一區對照'].includes(n.title) && !have.has(n.title))
      .forEach((n, i) => batch.set(doc(notesCol, 'v4-n' + i), n));
    const itemsCol = collection(this.db!, 'trips', key, 'items');
    const haveItems = new Set((await getDocs(itemsCol)).docs.map((d) => String(d.data()['title'])));
    SEED_ITEMS.filter((it) => it.day === 'pool' && it.title.endsWith('（雨天備案）') && !haveItems.has(it.title))
      .forEach((it, i) => batch.set(doc(itemsCol, 'rain-' + i), { ...it, order: Date.now() + i }));
    batch.set(doc(this.db!, 'trips', key), { planCards: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：「出發前待辦」卡片的入境證件說明改成台胞證版本（保留已經勾選的項目）。 */
  private async fixEntryDocs(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'notes');
    const hit = (await getDocs(col)).docs.find((d) => d.data()['title'] === '出發前待辦' && Array.isArray(d.data()['rows']));
    const batch = writeBatch(this.db!);
    if (hit) {
      const old = hit.data()['rows'] as { kind: string; a: string; done?: boolean }[];
      const fresh = SEED_NOTES.find((n) => n.title === '出發前待辦')!.rows!;
      const rows = fresh.map((r) => (r.kind === 'check' ? { ...r, done: old.some((o) => o.kind === 'check' && o.a === r.a && o.done) } : r));
      // 使用者自己加的項目（不在舊預設也不在新預設）保留在後面
      const known = new Set([...fresh.map((r) => r.a), '完成預辦入境登記，列印並簽名通知書', '入境處：台灣居民預辦入境登記']);
      batch.update(hit.ref, { rows: [...rows, ...old.filter((o) => !known.has(o.a))] });
    }
    batch.set(doc(this.db!, 'trips', key), { entryDocs: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：第 1 天補上「鴨脷洲利東邨（選擇性）」排在入住與晚餐之間，以及晚餐後的「回飯店休息」。 */
  private async addDay1Plan(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const day1 = (await getDocs(col)).docs.filter((d) => d.data()['day'] === '2026-11-24');
    const batch = writeBatch(this.db!);
    const hotel = day1.find((d) => d.data()['type'] === 'hotel');
    const dinner = day1.find((d) => String(d.data()['title']).includes('香港仔晚餐'));
    const fresh = SEED_ITEMS.filter((i) => i.day === '2026-11-24');
    const lei = fresh.find((i) => i.title.includes('利東邨'));
    const back = fresh.find((i) => i.title === '回飯店休息');
    if (hotel && dinner && lei && !day1.some((d) => String(d.data()['title']).includes('利東邨'))) {
      batch.set(doc(col, 'day1-lei'), { ...lei, order: (Number(hotel.data()['order']) + Number(dinner.data()['order'])) / 2 });
    }
    if (dinner && back && !day1.some((d) => d.data()['title'] === '回飯店休息')) {
      batch.set(doc(col, 'day1-back'), { ...back, order: Number(dinner.data()['order']) + 0.5 });
    }
    batch.set(doc(this.db!, 'trips', key), { day1Plan: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：航班卡的行程單連結換成直接連結（去掉郵件追蹤包裝），入境證件那行說明同步成短版。 */
  private async tweakCards1(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'notes');
    const batch = writeBatch(this.db!);
    const docs = (await getDocs(col)).docs;
    const fresh = (title: string, a: string) => SEED_NOTES.find((n) => n.title === title)!.rows!.find((r) => r.a === a)!;
    const flight = docs.find((d) => d.data()['title'] === '航班' && Array.isArray(d.data()['rows']));
    if (flight) {
      const row = fresh('航班', '香港航空行程單（PDF）');
      const rows = (flight.data()['rows'] as { a?: string }[]).map((r) => (r.a === '香港航空訂單管理' ? row : r));
      batch.update(flight.ref, { rows });
    }
    const todo = docs.find((d) => d.data()['title'] === '出發前待辦' && Array.isArray(d.data()['rows']));
    if (todo) {
      const row = fresh('出發前待辦', '入境證件：台胞證');
      const rows = (todo.data()['rows'] as { a?: string }[]).map((r) => (r.a === '入境證件：台胞證' ? row : r));
      batch.update(todo.ref, { rows });
    }
    batch.set(doc(this.db!, 'trips', key), { cardTweak1: true }, { merge: true });
    await batch.commit();
  }

  private ensurePackExtras7(key: string, done: boolean) {
    return this.backfillPack(key, 'packExtras7', done, [
      { category: '隨身包（登機）', label: '行李秤', has: /行李秤/ },
    ]);
  }

  /** 一次性：已經補進「藥品雜物」的行李秤搬到「隨身包（登機）」。 */
  private async moveScale(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'packing');
    const hits = (await getDocs(col)).docs.filter((d) => d.data()['label'] === '行李秤' && d.data()['category'] === '藥品雜物');
    const batch = writeBatch(this.db!);
    hits.forEach((d) => batch.update(d.ref, { category: '隨身包（登機）' }));
    batch.set(doc(this.db!, 'trips', key), { scaleMoved: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：第 1 天「入住」那站不再寫死 15:30（那是可入住時間，不是到達時間），改由行程自動推算預計抵達。 */
  private async clearHotelTime(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const hits = (await getDocs(col)).docs.filter(
      (d) => d.data()['day'] === '2026-11-24' && d.data()['type'] === 'hotel' && d.data()['time'] === '15:30',
    );
    const batch = writeBatch(this.db!);
    hits.forEach((d) => batch.update(d.ref, { time: '' }));
    batch.set(doc(this.db!, 'trips', key), { hotelEta: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：「出發前待辦」筆記卡排到最前面（order 0）。 */
  private async todoFirst(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'notes');
    const hit = (await getDocs(col)).docs.find((d) => d.data()['title'] === '出發前待辦');
    const batch = writeBatch(this.db!);
    if (hit) batch.update(hit.ref, { order: 0 });
    batch.set(doc(this.db!, 'trips', key), { todoFirst: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性：把第 2、3、4 天的行程整理成目前的預設內容，不論資料庫現在是哪個舊版本：
   * - 想去的地方排進對應的天，鄰近的餐廳合併成「挑幾家」的一站；
   * - 備選裡已有、或舊名稱的站（中環街市、維港日落、早餐等）會被搬或覆蓋，不會重複；
   * - 不要的項目（叮叮車獨立一站、已合併的單店）刪除；
   * - 第 2、3 天最後一站是回飯店，第 4 天從飯店出發；
   * - 你自己加在那幾天、不在預設裡的站，保留並排在最後面。沒被覆蓋的站只改日期與順序，不動你改過的內容。
   */
  private async syncDays(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    // 這些站用預設內容覆蓋（改名、搬日期、補內容），並用關鍵字去找舊名稱或備選裡已經有的
    const alias: Record<string, { re: RegExp; sameDay?: boolean }> = {
      '中環美食（挑 1–2 家）': { re: /中環街市|蓮香樓|蘭芳園|中環美食/ },
      '銅鑼灣美食（挑幾家）': { re: /甜姨姨|鵝頸橋|低調高手|銅鑼灣美食/ },
      'PMQ 元創方*': { re: /^PMQ/ },
      '銅鑼灣 MINISO 蒙奇奇*': { re: /MINISO/i },
      'SG 秘密花園（旺角始創中心 1 樓）*': { re: /秘密花園/ },
      '九龍城寨公園南門*': { re: /九龍城寨/ },
      '賽馬：MB3 Members Box (Home Straight)（跑馬地）（選擇性）*': { re: /MB3/ },
      '維多利亞港（搭張保仔號）*': { re: /維港日落|維多利亞港/ },
      '超市買伴手禮': { re: /超市|伴手禮/, sameDay: true },
      '退房，從雅格飯店出發': { re: /^(退房，)?從雅格飯店出發$/, sameDay: true },
      '早餐：買蛋塔（中環）*': { re: /早餐|蛋塔/, sameDay: true },
      '回飯店休息': { re: /^回飯店休息$/, sameDay: true },
    };
    const obsolete = [/^退房，出發去機場$/, /叮叮/, /^中環街市/, /蓮香樓|蘭芳園/, /甜姨姨/, /鵝頸橋/, /低調高手/];
    // 只改這些欄位的站（不覆蓋你改過的其他內容）
    const patch: Record<string, Record<string, unknown>> = {
      '尖沙咀：樂意點心': { travelMode: 'mrt', travelMin: 30 },
      // 為了讓超市排在白天、維多利亞港仍趕在日落前，縮短這兩站的預計停留（都是預設的估計值）
      '深水埗': { stay: 120 },
      '旺角': { stay: 90 },
      'HX262 香港 → 台北': { travelMode: 'train', travelMin: 40, note: '香港站搭機場快線到機場約 24 分，另加報到與安檢時間。' },
    };
    const used = new Set<string>();
    const title = (d: { data: () => Record<string, unknown> }) => String(d.data()['title']);
    for (const day of ['2026-11-25', '2026-11-26', '2026-11-27']) {
      const seq = SEED_ITEMS.filter((i) => i.day === day);
      seq.forEach((it, i) => {
        const order = (i + 1) * 10;
        const rule = alias[it.title];
        const hit = docs.find((d) => {
          if (used.has(d.id)) return false;
          if (rule) return rule.re.test(title(d)) && (!rule.sameDay || d.data()['day'] === day);
          return d.data()['day'] === day && title(d) === it.title;
        });
        if (hit) {
          used.add(hit.id);
          if (rule) batch.set(hit.ref, { ...it, order });
          else batch.update(hit.ref, { day, order, ...(patch[it.title] ?? {}) });
        } else {
          batch.set(doc(col, `plan-${day}-${i}`), { ...it, order });
        }
      });
      // 你自己加的站排在最後（不是預設、也不是要刪的）
      let tail = (seq.length + 1) * 10;
      docs
        .filter((d) => d.data()['day'] === day && !used.has(d.id) && !obsolete.some((r) => r.test(title(d))))
        .sort((x, y) => Number(x.data()['order']) - Number(y.data()['order']))
        .forEach((d) => batch.update(d.ref, { order: tail++ }));
    }
    // 不要的項目（任何一天、備選裡都找）
    docs.filter((d) => !used.has(d.id) && obsolete.some((r) => r.test(title(d)))).forEach((d) => batch.delete(d.ref));
    // 「一天一區對照」筆記卡裡 11/25、11/26、11/27 三行換成新內容
    const notesCol = collection(this.db!, 'trips', key, 'notes');
    const plan = (await getDocs(notesCol)).docs.find((d) => d.data()['title'] === '一天一區對照' && Array.isArray(d.data()['rows']));
    if (plan) {
      const fresh = SEED_NOTES.find((n) => n.title === '一天一區對照')!.rows!;
      const rows = (plan.data()['rows'] as { a?: string }[]).map((r) => {
        const a = String(r.a ?? '');
        return fresh.find((f) => /^11\/2[567]/.test(a) && f.a.slice(0, 5) === a.slice(0, 5)) ?? r;
      });
      batch.update(plan.ref, { rows });
    }
    batch.set(doc(this.db!, 'trips', key), { daysSync3: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性：把查證過的營業時間、門票、交通提醒（core/place-info.ts）套用到既有行程的每一站，
   * 補上我推薦的 8 個備選景點，並更新幾張筆記卡裡的票價與規定。
   * 沒有對應資料的站、以及資料裡沒寫到的欄位都不動。
   */
  private async syncPlaceInfo(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    // 1) 套用地點資料：只更新有變的欄位
    for (const d of docs) {
      const x = d.data();
      const before = { title: String(x['title'] ?? ''), hours: String(x['hours'] ?? ''), note: String(x['note'] ?? ''), subs: (x['subs'] ?? []) as Sub[], time: String(x['time'] ?? '') };
      const after = applyInfo(before);
      const changed: Record<string, unknown> = {};
      for (const f of ['hours', 'note', 'time'] as const) if (after[f] !== before[f]) changed[f] = after[f];
      if (JSON.stringify(after.subs) !== JSON.stringify(before.subs)) changed['subs'] = after.subs;
      if (Object.keys(changed).length) batch.update(d.ref, changed);
    }
    // 2) 補上推薦的備選景點（已經有同名的不重複加）
    const have = (re: string) => docs.some((d) => String(d.data()['title']).includes(re));
    SEED_ITEMS.filter((i) => i.day === 'pool' && ['天星小輪', '中環半山自動扶梯', '大館', '文武廟', '黃大仙祠', '南蓮園池', '赤柱市集', '淺水灣'].some((k) => i.title.includes(k)))
      .filter((i) => !have(i.title.slice(0, 3)))
      .forEach((it, n) => batch.set(doc(col, 'rec-' + n), { ...it, order: Date.now() + n }));
    // 3) 筆記卡：票價與規定那幾行換成新內容
    const notesCol = collection(this.db!, 'trips', key, 'notes');
    const noteDocs = (await getDocs(notesCol)).docs;
    const fixes: { title: string; old: string; next: string }[] = [
      { title: '重要資訊', old: '機場快線', next: '機場快線' },
      { title: '重要資訊', old: '八達通', next: '八達通' },
      { title: '提醒事項', old: '只能隨身帶', next: '行動電源只能隨身帶' },
      { title: '提醒事項', old: '液體、膏狀', next: '隨身的液體、膏狀' },
      { title: '路線速查', old: '機場快線｜回程', next: '機場快線｜回程' },
    ];
    for (const title of new Set(fixes.map((f) => f.title))) {
      const nd = noteDocs.find((d) => d.data()['title'] === title && Array.isArray(d.data()['rows']));
      if (!nd) continue;
      const seedRows = SEED_NOTES.find((n) => n.title === title)!.rows!;
      const rows = (nd.data()['rows'] as { a?: string }[]).map((r) => {
        const fix = fixes.find((f) => f.title === title && String(r.a ?? '').startsWith(f.old));
        return (fix && seedRows.find((s) => s.a.startsWith(fix.next))) || r;
      });
      batch.update(nd.ref, { rows });
    }
    batch.set(doc(this.db!, 'trips', key), { placeInfo1: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性：同伴想去的 4 家（標 *）排進行程。
   * Soft Thunder 與祥興排第 2 天（灣仔美食之後）；一點心排第 3 天旺角之後；Owl's 泡芙排第 3 天維多利亞港之前。
   * 祥興原本在備選，直接搬過來；Soft Thunder 從灣仔美食的備選店家裡移出。已經有的不重複加。
   */
  private async addStarPicks(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const find = (day: string, re: RegExp) => docs.find((d) => (!day || d.data()['day'] === day) && re.test(String(d.data()['title'])));
    const seed = (re: RegExp) => SEED_ITEMS.find((i) => re.test(i.title))!;
    const place = (re: RegExp, existing: RegExp, day: string, after: RegExp, offset: number, id: string) => {
      const anchor = find(day, after);
      const order = anchor ? Number(anchor.data()['order']) + offset : Date.now();
      const have = docs.find((d) => existing.test(String(d.data()['title'])));
      const it = { ...seed(re), order };
      if (have) batch.set(have.ref, it);
      else batch.set(doc(col, id), it);
    };
    const wanChai = find('2026-11-25', /^灣仔美食/);
    if (wanChai) {
      const subs = ((wanChai.data()['subs'] ?? []) as Sub[]).filter((x) => !/Soft Thunder/.test(x.name));
      batch.update(wanChai.ref, { subs });
    }
    place(/^Soft Thunder/, /Soft Thunder.*（蛋塔）/, '2026-11-25', /^灣仔美食/, 0.1, 'star-1');
    place(/^祥興咖啡室/, /^祥興咖啡室/, '2026-11-25', /^灣仔美食/, 0.2, 'star-2');
    place(/^一點心/, /^一點心/, '2026-11-26', /^旺角$/, 0.1, 'star-3');
    place(/^Owl/, /^Owl/, '2026-11-26', /^尖沙咀/, 0.1, 'star-4');
    batch.set(doc(this.db!, 'trips', key), { starPicks1: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性：同伴想去的第二批（標 *）：沾仔記、龍邦燒味、滑湯清牛楠加進鄰近的「挑幾家」那一站，
   * 維多利亞港改成搭張保仔號，第 4 天買蛋塔改成 Bakehouse。只改這幾站的標題、時間、地址、備註與店家清單。
   */
  private async addStarPicks2(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const seed = (re: RegExp) => SEED_ITEMS.find((i) => re.test(i.title))!;
    const apply = (day: string, existing: RegExp, seedRe: RegExp, fields: ('title' | 'hours' | 'address' | 'note')[]) => {
      const hit = docs.find((d) => d.data()['day'] === day && existing.test(String(d.data()['title'])));
      if (!hit) return;
      const s = seed(seedRe);
      const patch: Record<string, unknown> = {};
      fields.forEach((f) => (patch[f] = s[f]));
      batch.update(hit.ref, patch);
    };
    // 店家清單：加上還沒有的
    for (const [day, re, seedRe] of [
      ['2026-11-25', /^中環美食/, /^中環美食/],
      ['2026-11-25', /^銅鑼灣美食/, /^銅鑼灣美食/],
    ] as [string, RegExp, RegExp][]) {
      const hit = docs.find((d) => d.data()['day'] === day && re.test(String(d.data()['title'])));
      if (!hit) continue;
      const subs = [...((hit.data()['subs'] ?? []) as Sub[])];
      seed(seedRe).subs.filter((x) => x.name.endsWith('*') && !subs.some((y) => y.name.replace('*', '') === x.name.replace('*', ''))).forEach((x) => subs.push(x));
      batch.update(hit.ref, { subs });
    }
    apply('2026-11-26', /^維多利亞港/, /^維多利亞港/, ['title', 'note']);
    apply('2026-11-27', /早餐|蛋塔/, /^早餐：買蛋塔/, ['title', 'hours', 'address', 'note']);
    apply('2026-11-27', /^退房，?從雅格飯店出發/, /^退房，從雅格飯店出發/, ['note']);
    batch.set(doc(this.db!, 'trips', key), { starPicks2: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性（11/26 下午，修正）：之前誤加成獨立一站的「晚餐：興記菜館煲仔飯（廟街）」刪掉，
   * 改成放進原本「鵝頸橋四季火鍋*」的選項，走路能到的排前面：華姐清湯腩 → 興記煲仔飯（要搭車，備案）。
   * 清真牛肉館放到走路就到的「九龍城寨公園」那站。四季煲仔飯、泰國菜不留。
   */
  private async foldDinner(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const day3 = (await getDocs(col)).docs.filter((d) => d.data()['day'] === '2026-11-26');
    const find = (re: RegExp) => day3.find((d) => re.test(String(d.data()['title'] ?? '')));
    const batch = writeBatch(this.db!);

    const extra = find(/^晚餐：興記菜館煲仔飯/);
    const hotpot = find(/鵝頸橋|四季火鍋/);
    const walled = find(/九龍城寨/);
    const old = (extra?.data()['subs'] ?? []) as Sub[];
    const wahOld = old.find((x) => x.name.includes('華姐'));
    const halalOld = old.find((x) => x.name.includes('清真牛肉館'));

    if (hotpot) {
      const subs = ((hotpot.data()['subs'] ?? []) as Sub[]).filter((x) => !/華姐|興記|清真牛肉館/.test(x.name));
      subs.push({
        name: '備選（走路約 15 分或坐一站）：華姐清湯腩（天后總店，必比登）',
        hours: '每天 11:00–22:45；現金、八達通、支付寶',
        note: '清湯牛腩，也推薦菜肉雲吞、腩汁蘿蔔。天后電氣道 13 號 A1 號舖，從銅鑼灣坐港島線一站到天后，A2 出口對面。店小要搭枱，尖峰排 15–30 分鐘。',
        done: false,
        ...(wahOld?.photo ? { photo: wahOld.photo } : { photo: 'https://prod-pics.guide.michelin.com/api/public/content/c8dc1c2eebc5468c967caf573718eb13.jpeg?format=jpeg&w=600&h=600' }),
      });
      subs.push({
        name: '備案（要搭車過海）：興記菜館煲仔飯（廟街）',
        hours: '每天 13:30–15:30、17:30–23:00，只收現金',
        note: '想在九龍吃完再過海回飯店才選這家。炭爐即叫即煲：章魚雞粒、臘味、牛肉窩蛋；炸蠔餅份量大可分著吃。油麻地廟街 15 號，從旺角坐荃灣線兩站到油麻地（不用轉車）。',
        done: false,
      });
      batch.update(hotpot.ref, { subs });
    }

    if (walled) {
      const subs = [...((walled.data()['subs'] ?? []) as Sub[])];
      if (!subs.some((x) => x.name.includes('清真牛肉館'))) {
        subs.push({
          name: '順路點心：清真牛肉館（走路 5–10 分）',
          hours: halalOld?.hours ?? '每天 11:00–22:30；現金、八達通、AlipayHK',
          note: '打鼓嶺道 33–35 號，逛完城寨走過去。招牌牛肉餅一份 2 件約 $50，很多肉汁、很燙。要搭枱、有最低消費、店內禁酒。',
          done: false,
        });
        batch.update(walled.ref, { subs });
      }
    }

    if (extra && hotpot) batch.delete(extra.ref);
    batch.set(doc(this.db!, 'trips', key), { foldDinner1: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性（11/26 傍晚，已離開女人街）：第 3 天後半段改成 旺角 → PMQ → 晚餐 → 回飯店。
   * - 新增 PMQ 站（905 巴士到海港政府大樓 → 中環街市 → 半山扶梯）；
   * - 新增晚餐站：九記牛腩（清湯腩，PMQ 走路就到），備選坤記煲仔小菜；
   * - 超市、鵝頸橋火鍋移到備選（不刪除）；
   * - 回飯店改成從上環／中環出發。
   * 新站已存在就跳過。
   */
  private async thursdayPmq(key: string, done: boolean) {
    if (done) return;
    const D3 = '2026-11-26';
    const col = collection(this.db!, 'trips', key, 'items');
    const day3 = (await getDocs(col)).docs.filter((d) => d.data()['day'] === D3);
    const find = (re: RegExp) => day3.find((d) => re.test(String(d.data()['title'] ?? '')));
    const batch = writeBatch(this.db!);

    const home = find(/回飯店/);
    const mk = find(/^旺角/) ?? find(/SG 秘密花園/);
    const ho = home ? Number(home.data()['order']) : NaN;
    const mo = mk ? Number(mk.data()['order']) : NaN;
    const [o1, o2] = !isNaN(mo) && !isNaN(ho) && mo < ho ? [mo + (ho - mo) / 3, mo + ((ho - mo) * 2) / 3]
      : !isNaN(ho) ? [ho - 0.6, ho - 0.3]
      : [Date.now(), Date.now() + 1];

    // 今晚不去了：移到備選，保留原本內容。
    day3.filter((d) => /超市|鵝頸橋|四季火鍋/.test(String(d.data()['title'] ?? ''))).forEach((d) => batch.update(d.ref, { day: 'pool', order: Date.now() }));

    if (!find(/^PMQ/)) {
      const item: Omit<Item, 'id'> = {
        day: D3,
        type: 'place',
        title: 'PMQ 元創方*',
        time: '',
        endTime: '',
        stay: 60,
        hours: '各店不同，店舖多半傍晚就關，先逛再吃晚餐',
        address: '中環鴨巴甸街 35 號',
        note: '* 同伴想去。舊警察宿舍改建的文創基地，逛小店、拍白色建築中庭。',
        done: false,
        order: o1,
        travelMode: 'bus',
        travelMin: 50,
        travelNote: '旺角西洋菜南街搭 905，坐到「海港政府大樓」下車（港澳碼頭的下一站）。走約 5 分鐘到中環街市，搭中環至半山扶手電梯（10:00 後往上行）到荷李活道下，往西走幾分鐘到鴨巴甸街。不搭扶梯直接走約 17 分鐘，上坡。',
        subs: [],
      };
      batch.set(doc(col), item);
    }

    if (!find(/九記/)) {
      const item: Omit<Item, 'id'> = {
        day: D3,
        type: 'food',
        title: '晚餐：九記牛腩（清湯腩，必比登）',
        time: '',
        endTime: '',
        stay: 45,
        hours: '週一至六 12:30–22:30，週日及公眾假期休',
        address: '中環歌賦街 21 號',
        note: '招牌清湯牛腩，配伊麵最掛湯；咖喱牛腩也有名。店小要搭枱，服務很快很「港式」。沒吃過清湯腩，這間就在 PMQ 下面。',
        done: false,
        order: o2,
        travelMode: 'walk',
        travelMin: 5,
        travelNote: '從 PMQ 沿鴨巴甸街往下走，轉進歌賦街就到。',
        subs: [
          {
            name: '備選：坤記煲仔小菜（西營盤，必比登）',
            hours: '每天 17:30–22:30',
            note: '想吃煲仔飯選這間。招牌白鱔煲仔飯、臘味滑雞飯、油鴨煲仔飯，每份都有飯焦；也有小菜。即叫即煲要等，常排隊，可先打電話 2803 7209。皇后大道西 263 號（另一間在德輔道西 268 號）。從 PMQ 搭的士約 10 分鐘，或走到上環站坐港島線一站到西營盤。',
            done: false,
          },
        ],
      };
      batch.set(doc(col), item);
    }

    if (home) {
      batch.update(home.ref, {
        travelMode: 'mrt',
        travelMin: 35,
        travelNote: '走到上環站（約 8 分鐘），港島線到金鐘，轉南港島線到黃竹坑。吃坤記的話從西營盤站出發，路線相同。',
      });
    }

    batch.set(doc(this.db!, 'trips', key), { thursdayPmq1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性（11/26 下午）：刪掉第 3 天的「一點心」站；晚餐選項改成走路優先、搭車的放後面當備案。 */
  private async dropDimSum(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const day3 = docs.filter((d) => d.data()['day'] === '2026-11-26');
    const find = (re: RegExp) => day3.find((d) => re.test(String(d.data()['title'] ?? '')));
    day3.filter((d) => /一點心/.test(String(d.data()['title'] ?? ''))).forEach((d) => batch.delete(d.ref));

    // 晚餐選項照「走路能到」排前面，要搭車的放最後當備案；清真牛肉館搬到走路就到的九龍城寨那站。
    const hotpot = find(/鵝頸橋|四季火鍋/);
    const walled = find(/九龍城寨/);
    let halal: Sub | undefined;
    if (hotpot) {
      const subs = (hotpot.data()['subs'] ?? []) as Sub[];
      halal = subs.find((x) => x.name.includes('清真牛肉館'));
      const wah = subs.find((x) => x.name.includes('華姐'));
      const hing = subs.find((x) => x.name.includes('興記'));
      const others = subs.filter((x) => x !== halal && x !== wah && x !== hing);
      const next: Sub[] = [...others];
      if (wah) next.push({ ...wah, name: '備選（走路約 15 分或坐一站）：華姐清湯腩（天后總店，必比登）' });
      if (hing) next.push({ ...hing, name: '備案（要搭車過海）：興記菜館煲仔飯（廟街）' });
      batch.update(hotpot.ref, { subs: next });
    }
    if (walled && halal) {
      const subs = [...((walled.data()['subs'] ?? []) as Sub[])];
      if (!subs.some((x) => x.name.includes('清真牛肉館'))) {
        subs.push({ ...halal, name: '順路點心：清真牛肉館（走路 5–10 分）', note: '打鼓嶺道 33–35 號，逛完城寨走過去。招牌牛肉餅一份 2 件約 $50，很多肉汁、很燙。要搭枱、有最低消費、店內禁酒。' });
        batch.update(walled.ref, { subs });
      }
    }
    batch.set(doc(this.db!, 'trips', key), { dropDimSum1: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性（11/26 下午加的）：廟街之後加一站晚餐「興記菜館煲仔飯」，
   * 選項放四季煲仔飯、華姐清湯腩佐敦店（未確認開幕）、九龍城泰國菜（備案）。
   * 已有同名站就跳過，不改其他站。
   */
  private async thursdayDinner(key: string, done: boolean) {
    if (done) return;
    const D3 = '2026-11-26';
    const col = collection(this.db!, 'trips', key, 'items');
    const day3 = (await getDocs(col)).docs.filter((d) => d.data()['day'] === D3);
    const find = (re: RegExp) => day3.find((d) => re.test(String(d.data()['title'] ?? '')));
    const batch = writeBatch(this.db!);

    if (!find(/煲仔飯|興記/)) {
      const temple = find(/廟街/);
      const home = find(/回飯店/);
      const orders = day3.map((d) => Number(d.data()['order']) || 0);
      const to = temple ? Number(temple.data()['order']) : NaN;
      const ho = home ? Number(home.data()['order']) : NaN;
      const order = !isNaN(to) && !isNaN(ho) && to < ho ? (to + ho) / 2
        : !isNaN(to) ? to + 0.5
        : !isNaN(ho) ? ho - 0.5
        : (orders.length ? Math.max(...orders) : 0) + 1;
      const item: Omit<Item, 'id'> = {
        day: D3,
        type: 'food',
        title: '晚餐：興記菜館煲仔飯（廟街）',
        time: '',
        endTime: '',
        stay: 60,
        hours: '每天 13:30–15:30、17:30–23:00，只收現金',
        address: '油麻地廟街 15 號（總店；廟街 12–19 號都是興記）',
        note: '傳統炭爐即叫即煲，要等一下。經典：章魚雞粒、臘味、牛肉窩蛋煲仔飯；炸蠔餅份量大，適合分著吃。吃之前淋店家的煲仔飯豉油。',
        done: false,
        order,
        travelMode: 'walk',
        travelMin: 3,
        travelNote: '就在廟街上，逛到一半或逛完再吃都可以。',
        subs: [
          {
            name: '備選：四季煲仔飯',
            hours: '每天 18:00–01:00',
            note: '也是炭爐煲仔飯，招牌白鱔排骨、窩蛋牛肉、北菇滑雞；炸鴨蛋蠔餅幾乎每桌都點。油麻地鴉打街 46–58 號，離廟街很近。秋冬常排隊。',
            done: false,
          },
          {
            name: '備選：華姐清湯腩（佐敦店）',
            hours: '開幕未確認，出發前用地圖查',
            note: '天后總店是必比登推介的清湯牛腩。2026 年 5 月有報導說佐敦白加士街（澳洲牛奶公司那條街）要開分店，若已開幕可取代煲仔飯。可用現金、八達通、支付寶。',
            done: false,
            photo: 'https://prod-pics.guide.michelin.com/api/public/content/c8dc1c2eebc5468c967caf573718eb13.jpeg?format=jpeg&w=600&h=600',
          },
          {
            name: '備案：九龍城泰國菜（逛完城寨時吃）',
            hours: '小曼谷 11:30–22:00',
            note: '要選這個就在九龍城寨公園逛完後直接吃，不用等到廟街。小曼谷（南角道 9–11 號）：青咖喱海鮮、即燒串燒，常排隊；泰美味（龍崗道 2–4 號）：泰國人開的，燒青檸牛肉、菠蘿炒飯、肉碎菜包，較平價。',
            done: false,
          },
          {
            name: '備案：清真牛肉館（九龍城，逛完城寨時吃）',
            hours: '每天 11:00–22:30；現金、八達通、AlipayHK',
            note: '九龍城打鼓嶺道 33–35 號，宋皇臺站 B3 出口走約 4 分鐘。招牌牛肉餅（一份 2 件約 $50）即叫即煎、很多肉汁，很燙要小口吃；也有咖喱牛腩、羊肉煎餃、炸銀絲卷。建議當點心分一份牛肉餅，留胃給煲仔飯。要搭枱、有最低消費、店內禁酒，晚上 7 點前就開始排隊。',
            done: false,
          },
        ],
      };
      batch.set(doc(col), item);
    }

    // 早上加的 Bakehouse（中環）站補一張蛋塔圖；已經有圖就不動。
    const bake = find(/bakehouse/i);
    if (bake && !((bake.data()['photos'] as string[] | undefined)?.length)) {
      batch.update(bake.ref, { photos: ['https://d3h1lg3ksw6i6b.cloudfront.net/media/image/2025/06/09/5f4cc11ddb434df2aae28c60365f4581___Bakehouse_egg_tart_sourdough.jpg'] });
    }

    batch.set(doc(this.db!, 'trips', key), { thursdayDinner1: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性（11/26 當天加的）：
   * 1. 出發後先到中環：早餐蘭芳園（西多士、絲襪奶茶），備選興記咖啡室、勝香園。
   * 2. 接著 Bakehouse 中環店：現吃，並預約 11/27 早上在同一間取的蛋塔。
   * 3. 一點心改成從中環站出發（荃灣線起點直達太子），交通時間跟著改。
   * 4. 11/27 的 Bakehouse 站備註後面補一句：先到香港站託運行李，再空手去取。
   * 新站已存在就跳過，不重複新增。
   */
  private async thursdayEats(key: string, done: boolean) {
    if (done) return;
    const D3 = '2026-11-26';
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const day3 = docs.filter((d) => d.data()['day'] === D3);
    const find = (re: RegExp, list = day3) => list.find((d) => re.test(String(d.data()['title'] ?? '')));
    const ord = (d?: { data(): Record<string, unknown> }) => (d ? Number(d.data()['order']) : NaN);
    const batch = writeBatch(this.db!);

    const start = find(/出發/);
    const dim = find(/一點心/);
    const orders = day3.map((d) => Number(d.data()['order']) || 0);
    const so = ord(start);
    const dmo = ord(dim);
    const [o1, o2] = !isNaN(so) && !isNaN(dmo) && so < dmo ? [so + (dmo - so) / 3, so + ((dmo - so) * 2) / 3]
      : !isNaN(dmo) ? [dmo - 0.6, dmo - 0.3]
      : !isNaN(so) ? [so + 0.3, so + 0.6]
      : [(orders.length ? Math.min(...orders) : 0) - 0.6, (orders.length ? Math.min(...orders) : 0) - 0.3];

    if (!find(/蘭芳園/)) {
      const item: Omit<Item, 'id'> = {
        day: D3,
        type: 'food',
        title: '早餐：蘭芳園（中環）',
        time: '',
        endTime: '',
        stay: 40,
        hours: '週一至六 07:30–18:00（週日休），只收現金',
        address: '中環結志街 2 號',
        note: '港式西多士、絲襪奶茶的老店，也可以點豬扒包。吃完走 2–3 分鐘到 Bakehouse。',
        done: false,
        order: o1,
        travelMode: 'mrt',
        travelMin: 30,
        travelNote: '黃竹坑 → 金鐘轉荃灣線坐一站到中環，D2 出口走約 6 分鐘。',
        subs: [
          {
            name: '備選：興記咖啡室（中環）',
            hours: '早上 06:00 開（來源：鏡週刊）',
            note: '鐵板煎的傳統西多士（不油炸），放牛油、淋煉乳。在摩羅上街附近，從 Bakehouse 走過去約 10 分鐘，地址出發前用地圖確認。',
            done: false,
          },
          {
            name: '備選：勝香園（中環）',
            hours: '開門時間未查到，週日休',
            note: '露天大排檔，招牌蕃茄牛肉通粉、檸蜜脆脆（沒有西多士）。中環美輪街 2 號，離 Bakehouse 很近。',
            done: false,
          },
        ],
      };
      batch.set(doc(col), item);
    }

    if (!find(/bakehouse/i)) {
      const item: Omit<Item, 'id'> = {
        day: D3,
        type: 'food',
        title: 'Bakehouse 蛋塔（中環）',
        time: '',
        endTime: '',
        stay: 15,
        hours: '週一至日 08:00–21:00',
        address: '中環士丹頓街 5 號嘉彩閣地舖',
        note: '現吃，並預約明天（11/27）早上在這間取的蛋塔。早上剛開店，貨比晚上多。',
        done: false,
        order: o2,
        travelMode: 'walk',
        travelMin: 3,
        travelNote: '結志街往上走到士丹頓街，2–3 分鐘。',
        subs: [],
      };
      batch.set(doc(col), item);
    }

    if (dim) batch.update(dim.ref, { travelMode: 'mrt', travelMin: 25, travelNote: '走回中環站，荃灣線起點坐到太子（不用轉車）。' });

    const fri = find(/bakehouse|蛋塔/i, docs.filter((d) => d.data()['day'] === '2026-11-27'));
    if (fri) {
      const note = String(fri.data()['note'] ?? '');
      const add = '已在 11/26 早上預約（中環店）。建議順序：退房後先到香港站預辦登機、把行李託運掉，再空手上來取蛋塔（上坡不用拖行李），最後走回香港站搭機場快線。';
      if (!note.includes(add)) batch.update(fri.ref, { note: note ? note + '\n' + add : add });
    }

    batch.set(doc(this.db!, 'trips', key), { thursdayEats1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：第 3 天早餐：一點心（太子）排到深水埗之前（深水埗、太子、旺角同一條線），交通時間跟著調整。 */
  private async day3Breakfast(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const day3 = docs.filter((d) => d.data()['day'] === '2026-11-26');
    const dim = day3.find((d) => /^一點心/.test(String(d.data()['title'])));
    const sham = day3.find((d) => /^深水埗/.test(String(d.data()['title'])));
    const batch = writeBatch(this.db!);
    if (dim && sham) {
      const seed = SEED_ITEMS.find((i) => /^一點心/.test(i.title))!;
      batch.update(dim.ref, { order: Number(sham.data()['order']) - 0.1, travelMode: seed.travelMode, travelMin: seed.travelMin, note: seed.note });
      batch.update(sham.ref, { travelMode: 'mrt', travelMin: 10 });
    }
    batch.set(doc(this.db!, 'trips', key), { day3Breakfast1: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性：灣仔那批（發達叉燒、榕哥、我杯茶、聰。C Dessert）先拿掉，11/25 從 Soft Thunder 開始。
   * 刪掉「灣仔美食／灣仔早餐／灣仔午餐」那幾站，Soft Thunder 改成從飯店搭港鐵過來，PMQ 的交通改回從跑馬地過來。
   */
  private async wanChaiMorning(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const d2 = (await getDocs(col)).docs.filter((d) => d.data()['day'] === '2026-11-25');
    const batch = writeBatch(this.db!);
    d2.filter((d) => /^灣仔(美食|早餐|午餐)/.test(String(d.data()['title']))).forEach((d) => batch.delete(d.ref));
    const soft = d2.find((d) => /^Soft Thunder/.test(String(d.data()['title'])));
    if (soft) batch.update(soft.ref, { travelMode: 'mrt', travelMin: 20 });
    const pmq = d2.find((d) => /^PMQ/.test(String(d.data()['title'])));
    if (pmq) batch.update(pmq.ref, { travelMode: 'mrt', travelMin: 35 });
    const notes = (await getDocs(collection(this.db!, 'trips', key, 'notes'))).docs.find((d) => d.data()['title'] === '一天一區對照' && Array.isArray(d.data()['rows']));
    if (notes) {
      const fresh = SEED_NOTES.find((n) => n.title === '一天一區對照')!.rows!.find((r) => r.a.startsWith('11/25'));
      if (fresh) batch.update(notes.ref, { rows: (notes.data()['rows'] as { a?: string }[]).map((r) => (String(r.a ?? '').startsWith('11/25') ? fresh : r)) });
    }
    batch.set(doc(this.db!, 'trips', key), { wanChai3: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：維多利亞港（搭張保仔號）從第 3 天搬到第 1 天晚上（香港仔晚餐之後、回飯店之前）。 */
  private async boatToDay1(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const boat = docs.find((d) => /^維多利亞港/.test(String(d.data()['title'])));
    const back = docs.find((d) => d.data()['day'] === '2026-11-24' && /^回飯店休息/.test(String(d.data()['title'])));
    if (boat && back) {
      const seed = SEED_ITEMS.find((i) => /^維多利亞港/.test(i.title))!;
      batch.update(boat.ref, { day: '2026-11-24', order: Number(back.data()['order']) - 0.1, stay: seed.stay, travelMode: seed.travelMode, travelMin: seed.travelMin, note: seed.note });
      batch.update(back.ref, { travelMode: 'mrt', travelMin: 50 });
    }
    const notes = (await getDocs(collection(this.db!, 'trips', key, 'notes'))).docs.find((d) => d.data()['title'] === '一天一區對照' && Array.isArray(d.data()['rows']));
    if (notes) {
      const seedRows = SEED_NOTES.find((n) => n.title === '一天一區對照')!.rows!;
      const rows = (notes.data()['rows'] as { a?: string }[]).map((r) => seedRows.find((f) => /^11\/2[46]/.test(String(r.a ?? '')) && f.a.slice(0, 5) === String(r.a ?? '').slice(0, 5)) ?? r);
      batch.update(notes.ref, { rows });
    }
    batch.set(doc(this.db!, 'trips', key), { boatDay1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：第 1 天晚上改成「放完行李直接去尖沙咀少量多餐 → 搭船」：香港仔晚餐移到備選，尖沙咀小吃與 Owl 泡芙從第 3 天搬過來。 */
  private async day1Eats(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const find = (re: RegExp) => docs.find((d) => re.test(String(d.data()['title'])));
    const seed = (re: RegExp) => SEED_ITEMS.find((i) => re.test(i.title))!;
    const boat = find(/^維多利亞港/);
    const tst = find(/^尖沙咀：/);
    const owl = find(/^Owl/);
    const gang = find(/^香港仔晚餐/);
    if (gang) batch.update(gang.ref, { day: 'pool', order: Date.now(), travelMode: '', travelMin: 0 });
    if (boat) {
      const o = Number(boat.data()['order']);
      const move = (d: typeof tst, re: RegExp, order: number) => {
        if (!d) return;
        const s = seed(re);
        batch.update(d.ref, { day: '2026-11-24', order, stay: s.stay, travelMode: s.travelMode, travelMin: s.travelMin, note: s.note });
      };
      move(owl, /^Owl/, o - 0.2);
      move(tst, /^尖沙咀：/, o - 0.1);
      batch.update(boat.ref, { travelMode: 'walk', travelMin: 10, note: seed(/^維多利亞港/).note });
    }
    const lei = find(/^鴨脷洲 利東邨/);
    if (lei) batch.delete(lei.ref);
    const temple = find(/^廟街夜市/);
    if (temple) batch.update(temple.ref, { travelMode: 'mrt', travelMin: 30 });
    const notes = (await getDocs(collection(this.db!, 'trips', key, 'notes'))).docs.find((d) => d.data()['title'] === '一天一區對照' && Array.isArray(d.data()['rows']));
    if (notes) {
      const seedRows = SEED_NOTES.find((n) => n.title === '一天一區對照')!.rows!;
      const rows = (notes.data()['rows'] as { a?: string }[]).map((r) => seedRows.find((f) => /^11\/2[46]/.test(String(r.a ?? '')) && f.a.slice(0, 5) === String(r.a ?? '').slice(0, 5)) ?? r);
      batch.update(notes.ref, { rows });
    }
    batch.set(doc(this.db!, 'trips', key), { day1Eats1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：同伴的攻略圖：中環藝穗會與街頭壁畫（第 2 天）、九龍公園（第 3 天），旺角與維港站補上攻略備註。 */
  private async addGuides(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const find = (day: string, re: RegExp) => docs.find((d) => d.data()['day'] === day && re.test(String(d.data()['title'])));
    const seed = (re: RegExp) => SEED_ITEMS.find((i) => re.test(i.title))!;
    const add = (re: RegExp, day: string, before: RegExp, id: string) => {
      if (docs.some((d) => re.test(String(d.data()['title'])))) return;
      const anchor = find(day, before);
      batch.set(doc(col, id), { ...seed(re), order: anchor ? Number(anchor.data()['order']) - 0.1 : Date.now() });
    };
    add(/^中環藝穗會/, '2026-11-25', /^中環美食/, 'guide-1');
    add(/^九龍公園/, '2026-11-26', /^廟街夜市/, 'guide-2');
    const line = (re: RegExp, day: string, seedRe: RegExp, key2: string) => {
      const d = find(day, re);
      if (!d) return;
      const cur = String(d.data()['note'] ?? '');
      if (cur.includes('同伴的攻略')) return;
      const extra = seed(seedRe).note.split('\n').filter((x) => x.includes(key2));
      batch.update(d.ref, { note: [cur, ...extra].filter(Boolean).join('\n') });
    };
    line(/^旺角$/, '2026-11-26', /^旺角$/, '同伴的攻略');
    line(/^維多利亞港/, '2026-11-24', /^維多利亞港/, '同伴的攻略');
    batch.set(doc(this.db!, 'trips', key), { guides1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：批&撻疑似已結業，從尖沙咀那站拿掉，站名改成「尖沙咀：樂意點心」。 */
  private async dropPie(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const hit = (await getDocs(col)).docs.find((d) => /^尖沙咀：/.test(String(d.data()['title'])));
    const batch = writeBatch(this.db!);
    if (hit) batch.update(hit.ref, { title: '尖沙咀：樂意點心', subs: ((hit.data()['subs'] ?? []) as Sub[]).filter((x) => !/批&撻/.test(x.name)) });
    batch.set(doc(this.db!, 'trips', key), { dropPie1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：同伴的三份攻略（旺角 Citywalk、港島兩日遊、中環到堅尼地城）：旺角補路線備註，備選補上怪獸大廈、中環摩天輪，堅尼地城補叮叮車路線。 */
  private async addRefs(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const seed = (re: RegExp) => SEED_ITEMS.find((i) => re.test(i.title));
    const mong = docs.find((d) => d.data()['day'] === '2026-11-26' && /^旺角$/.test(String(d.data()['title'])));
    if (mong && !String(mong.data()['note']).includes('旺角 Citywalk')) {
      const extra = (seed(/^旺角$/)?.note ?? '').split('\n').filter((x) => x.includes('旺角 Citywalk'));
      batch.update(mong.ref, { note: [String(mong.data()['note'] ?? ''), ...extra].filter(Boolean).join('\n') });
    }
    const kennedy = docs.find((d) => /^堅尼地城/.test(String(d.data()['title'])));
    if (kennedy && !String(kennedy.data()['note']).includes('叮叮車')) {
      batch.update(kennedy.ref, { note: [String(kennedy.data()['note'] ?? ''), seed(/^堅尼地城/)?.note ?? ''].filter(Boolean).join('\n') });
    }
    for (const [re, id] of [[/^怪獸大廈/, 'ref-1'], [/^中環摩天輪/, 'ref-2']] as [RegExp, string][]) {
      if (docs.some((d) => re.test(String(d.data()['title'])))) continue;
      const s = seed(re);
      if (s) batch.set(doc(col, id), { ...s, order: Date.now() });
    }
    batch.set(doc(this.db!, 'trips', key), { refs1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：「滑湯清牛楠」是打錯，正確是華姐清湯腩（天后）。 */
  private async sisterWah(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const hit = (await getDocs(col)).docs.find((d) => ((d.data()['subs'] ?? []) as Sub[]).some((x) => /滑湯清牛楠/.test(x.name)));
    const batch = writeBatch(this.db!);
    if (hit) {
      const fresh = SEED_ITEMS.flatMap((i) => i.subs).find((x) => x.name.startsWith('華姐清湯腩'))!;
      batch.update(hit.ref, { subs: ((hit.data()['subs'] ?? []) as Sub[]).map((x) => (/滑湯清牛楠/.test(x.name) ? { ...x, name: fresh.name, hours: fresh.hours, note: fresh.note } : x)) });
    }
    batch.set(doc(this.db!, 'trips', key), { sisterWah1: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性（修正）：第 1 天晚上先前那版搬移跑過一次，之後我又調整了內容，所以這裡補一次：
   * 刪掉鴨脷洲利東邨，Owl 泡芙排在樂意點心前面並套用最新的交通時間與備註。
   */
  private async day1Fix(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const find = (re: RegExp) => docs.find((d) => d.data()['day'] === '2026-11-24' && re.test(String(d.data()['title'])));
    const seed = (re: RegExp) => SEED_ITEMS.find((i) => re.test(i.title))!;
    docs.filter((d) => /^鴨脷洲 利東邨/.test(String(d.data()['title']))).forEach((d) => batch.delete(d.ref));
    const boat = find(/^維多利亞港/);
    const owl = find(/^Owl/);
    const tst = find(/^尖沙咀：/);
    if (boat && owl && tst) {
      const o = Number(boat.data()['order']);
      const put = (d: typeof owl, re: RegExp, order: number) => {
        const s = seed(re);
        batch.update(d.ref, { order, stay: s.stay, travelMode: s.travelMode, travelMin: s.travelMin, note: s.note });
      };
      put(owl, /^Owl/, o - 0.2);
      put(tst, /^尖沙咀：/, o - 0.1);
    }
    batch.set(doc(this.db!, 'trips', key), { day1Fix1: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性：第 1–4 天改成最終版行程（原行程備份在專案的「原行程備份.md」）。
   * 這四天現有的站全部刪除，換成預設的新行程；備選區不動，祥興咖啡室如果在行程裡，會移到備選。
   */
  private async planV2(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const days = ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
    const hasPool = (re: RegExp) => docs.some((d) => d.data()['day'] === 'pool' && re.test(String(d.data()['title'])));
    docs.filter((d) => days.includes(String(d.data()['day']))).forEach((d) => batch.delete(d.ref));
    SEED_ITEMS.filter((i) => days.includes(i.day)).forEach((it, n) => batch.set(doc(col, 'v2-' + String(n).padStart(3, '0')), { ...it, order: (n + 1) * 10 }));
    if (!hasPool(/^祥興咖啡室/)) {
      const s = SEED_ITEMS.find((i) => i.day === 'pool' && /^祥興咖啡室/.test(i.title));
      if (s) batch.set(doc(col, 'v2-pool-xingxing'), { ...s, order: Date.now() });
    }
    const notes = (await getDocs(collection(this.db!, 'trips', key, 'notes'))).docs.find((d) => d.data()['title'] === '一天一區對照' && Array.isArray(d.data()['rows']));
    if (notes) {
      const seedRows = SEED_NOTES.find((n) => n.title === '一天一區對照')!.rows!;
      const rows = (notes.data()['rows'] as { a?: string }[]).map((r) => seedRows.find((f) => /^11\/2[4567]/.test(String(r.a ?? '')) && f.a.slice(0, 5) === String(r.a ?? '').slice(0, 5)) ?? r);
      batch.update(notes.ref, { rows });
    }
    batch.set(doc(this.db!, 'trips', key), { planV2: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：一點心官網有三間分店，更新備註（地址維持太子店）。 */
  private async dimSumBranches(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const hit = (await getDocs(col)).docs.find((d) => /^一點心/.test(String(d.data()['title'])));
    const batch = writeBatch(this.db!);
    if (hit) batch.update(hit.ref, { note: SEED_ITEMS.find((i) => /^一點心/.test(i.title))!.note, address: '九龍太子通菜街 209A-209B 號地舖' });
    batch.set(doc(this.db!, 'trips', key), { dimSum1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：營業時間只寫平日（11/24–11/27 都是平日），並把一點心、Owl's 的時間改成平日。 */
  private async weekdayHours(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    for (const d of docs) {
      const x = d.data();
      const title = String(x['title'] ?? '');
      const before = { title, hours: String(x['hours'] ?? ''), note: String(x['note'] ?? ''), subs: (x['subs'] ?? []) as Sub[], time: String(x['time'] ?? '') };
      const after = applyInfo(before);
      const changed: Record<string, unknown> = {};
      if (after.hours !== before.hours) changed['hours'] = after.hours;
      if (after.note !== before.note) changed['note'] = after.note;
      if (JSON.stringify(after.subs) !== JSON.stringify(before.subs)) changed['subs'] = after.subs;
      if (/^(一點心|Owl)/.test(title)) changed['hours'] = SEED_ITEMS.find((i) => i.title.startsWith(title.slice(0, 3)))?.hours ?? before.hours;
      if (Object.keys(changed).length) batch.update(d.ref, changed);
    }
    batch.set(doc(this.db!, 'trips', key), { weekday1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：九龍城寨公園南門預計停留改 120 分鐘（免費景點，想多逛）。 */
  private async walledCityStay(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const hit = (await getDocs(col)).docs.find((d) => /^九龍城寨公園/.test(String(d.data()['title'])));
    const batch = writeBatch(this.db!);
    if (hit) batch.update(hit.ref, { stay: 120 });
    batch.set(doc(this.db!, 'trips', key), { walledCity1: true }, { merge: true });
    await batch.commit();
  }

  /** 一次性：把招牌菜圖片連結（seed 裡的 photos、店家 photo）補到既有行程。只加圖，不動其他欄位。 */
  private async addPhotos(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const base = (t: string) => t.replace(/[*（(].*$/, '').trim();
    for (const s of SEED_ITEMS) {
      const hit = docs.find((d) => d.data()['day'] === s.day && base(String(d.data()['title'])) === base(s.title));
      if (!hit) continue;
      const patch: Record<string, unknown> = {};
      if (s.photos?.length) patch['photos'] = s.photos;
      const have = (hit.data()['subs'] ?? []) as Sub[];
      if (s.subs.some((x) => x.photo)) {
        const subs = have.map((x) => ({ ...x, ...(s.subs.find((y) => y.photo && base(y.name) === base(x.name))?.photo ? { photo: s.subs.find((y) => base(y.name) === base(x.name))!.photo } : {}) }));
        patch['subs'] = subs;
      }
      if (Object.keys(patch).length) batch.update(hit.ref, patch);
    }
    batch.set(doc(this.db!, 'trips', key), { photos1: true }, { merge: true });
    await batch.commit();
  }

  /**
   * 一次性：同伴名單（標 *）要排前面，我推薦的排後面並標註：
   * - 必去的站與店家加上 *（PMQ、MINISO、SG 秘密花園、九龍城寨、賽馬、中環街市、甜姨姨、鵝頸橋）；
   * - 中環美食的店家清單：你們給的名單在前，我推薦的蓮香樓、蘭芳園排最後並標「我推薦」。
   */
  private async orderSubs(key: string, done: boolean) {
    if (done) return;
    const col = collection(this.db!, 'trips', key, 'items');
    const docs = (await getDocs(col)).docs;
    const batch = writeBatch(this.db!);
    const starStop = /^(PMQ|銅鑼灣 MINISO|SG 秘密花園|九龍城寨公園|賽馬：MB3)/;
    const starSub = /^(中環街市|甜姨姨|鵝頸橋)/;
    const mine = (x: Sub) => /蓮香樓|蘭芳園/.test(x.name);
    for (const d of docs) {
      const t = String(d.data()['title']);
      const patch: Record<string, unknown> = {};
      if (starStop.test(t) && !t.endsWith('*')) patch['title'] = t + '*';
      const subs = (d.data()['subs'] ?? []) as Sub[];
      if (subs.length) {
        let next = subs.map((x) => {
          if (starSub.test(x.name) && !x.name.endsWith('*')) return { ...x, name: x.name + '*' };
          if (mine(x) && !x.name.includes('我推薦')) return { ...x, name: x.name + '（我推薦）' };
          return x;
        });
        if (/^中環美食/.test(t)) next = [...next.filter((x) => !mine(x)), ...next.filter(mine)];
        if (JSON.stringify(next) !== JSON.stringify(subs)) patch['subs'] = next;
      }
      if (Object.keys(patch).length) batch.update(d.ref, patch);
    }
    batch.set(doc(this.db!, 'trips', key), { subOrder1: true }, { merge: true });
    await batch.commit();
  }

  /** 用新密碼建立旅行，並放入初始行程。 */
  async create(password: string): Promise<void> {
    const members: string[] = [];
    const key = await sha256(password.trim());
    const batch = writeBatch(this.db!);
    batch.set(doc(this.db!, 'trips', key), { members, createdAt: Date.now(), hotelStarts: true, hotelInfo: true, notesV2: true, slashFix: true, packExtras: true, packExtras2: true, packExtras3: true, packExtras4: true, esimMoved: true, cabinNote: true });
    SEED_ITEMS.forEach((s, i) => batch.set(doc(collection(this.db!, 'trips', key, 'items'), 'i' + String(i).padStart(3, '0')), s));
    SEED_NOTES.forEach((s, i) => batch.set(doc(collection(this.db!, 'trips', key, 'notes'), 'n' + i), s));
    await batch.commit();
    this.start(key, members);
  }

  private start(key: string, members: string[]) {
    this.stop();
    write(KEY_STORE, key);
    this.key.set(key);
    this.members.set(members);
    if (!members.includes(this.me() ?? '')) this.setMe(null);
    const sub = <T extends { id: string }>(name: string, target: (v: T[]) => void) =>
      onSnapshot(this.col(name), (s) => target(s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T)));
    this.unsubs = [
      sub<Item>('items', (v) => this.items.set(v)),
      sub<Expense>('expenses', (v) => this.expenses.set(v)),
      sub<Note>('notes', (v) => this.notes.set(v)),
      sub<PackItem>('packing', (v) => this.packing.set(v)),
      onSnapshot(doc(this.db!, 'trips', key), (d) => this.members.set((d.data()?.['members'] as string[]) ?? members)),
    ];
    this.ready.set(true);
  }

  private stop() { this.unsubs.forEach((u) => u()); this.unsubs = []; }

  lock() {
    this.stop();
    write(KEY_STORE, null);
    this.key.set(null);
    this.items.set([]); this.expenses.set([]); this.notes.set([]); this.packing.set([]);
  }

  setMe(name: string | null) { this.me.set(name); write(ME_STORE, name); }

  async addMember(name: string): Promise<string | null> {
    const n = name.trim();
    if (!n) return '請輸入名字';
    if (this.members().includes(n)) return '這個名字已經有了';
    await this.setMembers([...this.members(), n]);
    return null;
  }
  async removeMember(name: string) {
    await this.setMembers(this.members().filter((m) => m !== name));
    if (this.me() === name) this.setMe(null);
  }
  async setMembers(members: string[]) {
    await setDoc(doc(this.db!, 'trips', this.key()!), { members }, { merge: true });
  }

  // 通用 CRUD ------------------------------------------------------------
  async save(name: 'items' | 'expenses' | 'notes' | 'packing', data: { id?: string; [k: string]: unknown }) {
    const { id, ...rest } = data as { id?: string };
    const ref = id ? doc(this.col(name), id) : doc(this.col(name));
    await setDoc(ref, rest);
    return ref.id;
  }
  async remove(name: 'items' | 'expenses' | 'notes' | 'packing', id: string) {
    await deleteDoc(doc(this.col(name), id));
  }

  /** 一次寫入多筆（例如幫某位成員建立預設行李清單） */
  async saveMany(name: 'packing', rows: Record<string, unknown>[]) {
    const batch = writeBatch(this.db!);
    rows.forEach((r) => batch.set(doc(this.col(name)), r));
    await batch.commit();
  }
}
