import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Menu, MenuModule } from 'primeng/menu';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { Avatar } from '../core/avatar';
import { Icon } from '../core/icon';
import { Expense, SplitMode } from '../core/models';
import { balances, computeShares, settle } from '../core/split';
import { TripService } from '../core/trip.service';

type Cur = string;
/** 常用幣別與「1 單位 ＝ 多少港幣」的概估匯率。只是預設值，每一筆都可以改成實際匯率。 */
const CURRENCIES: { code: Cur; name: string; sym: string; rate: number }[] = [
  { code: 'HKD', name: '港幣', sym: 'HK$', rate: 1 },
  { code: 'TWD', name: '台幣', sym: 'NT$', rate: 0.244 },
  { code: 'USD', name: '美金', sym: 'US$', rate: 7.8 },
  { code: 'CNY', name: '人民幣', sym: 'CN¥', rate: 1.08 },
  { code: 'JPY', name: '日圓', sym: 'JP¥', rate: 0.052 },
  { code: 'EUR', name: '歐元', sym: '€', rate: 9 },
];
/** 花費分類（固定 6 個）。顏色用在統計色條。 */
const CATS = [
  { id: 'food', label: '餐飲', icon: 'food', color: '#F29559' },
  { id: 'transport', label: '交通', icon: 'tram', color: '#36475A' },
  { id: 'stay', label: '住宿', icon: 'hotel', color: '#5B8C6E' },
  { id: 'ticket', label: '門票', icon: 'ticket', color: '#F2D492' },
  { id: 'shop', label: '購物', icon: 'bag', color: '#C06A52' },
  { id: 'other', label: '其他', icon: 'wallet', color: '#B8B08D' },
];
/** 沒選分類時，依品名關鍵字猜一個 */
function guessCat(item: string): string {
  if (/飯店|住宿|訂金|房/.test(item)) return 'stay';
  if (/餐|飯|麵|粥|茶|咖啡|吃|食|宵夜|甜|燒|鵝/.test(item)) return 'food';
  if (/車|鐵|巴士|叮叮|船|計程|機場快線|交通|八達通|的士/.test(item)) return 'transport';
  if (/票|門票/.test(item)) return 'ticket';
  if (/買|購|伴手|藥|店/.test(item)) return 'shop';
  return 'other';
}
const curOf = (c?: string) => CURRENCIES.find((x) => x.code === c) ?? CURRENCIES[0];

@Component({
  selector: 'app-expenses',
  imports: [
    FormsModule,
    DecimalPipe,
    NgTemplateOutlet,
    ButtonModule,
    CheckboxModule,
    DatePickerModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    MenuModule,
    SelectModule,
    Avatar,
    Icon,
  ],
  template: `
    <div class="mx-auto max-w-4xl">
      <div class="flex flex-col gap-6">
        <!-- 結算 -->
        <section
          class="flex flex-col gap-3 rounded-[20px] border border-border bg-white p-5 md:p-6"
        >
          <div class="flex items-center justify-between">
            <h2 class="flex items-center gap-2 text-[18px] font-bold">
              <span class="text-navy-2"><app-icon name="scale" [size]="19" /></span> 結算
            </h2>
            <span class="text-xs font-medium text-faint">港幣 HKD</span>
          </div>
          <div class="flex flex-col">
            @for (m of svc.members(); track m) {
              <div
                class="flex items-center justify-between border-b border-border py-3.5 last:border-0"
              >
                <div class="flex items-center gap-3">
                  <app-avatar [name]="m" [size]="34" /><span class="text-[15px] font-medium">{{
                    m
                  }}</span>
                </div>
                <span
                  class="text-[16px] font-bold"
                  [style.color]="net()[m] >= 0 ? '#5B8C6E' : '#C06A52'"
                  >{{ net()[m] >= 0 ? '+' : '−' }} HK$ {{ abs(net()[m]) | number: '1.0-2' }}</span
                >
              </div>
            } @empty {
              <p class="text-sm text-muted">還沒有成員，請先點右上角建立身分。</p>
            }
          </div>
          @if (transfers().length) {
            <div class="rounded-[14px] bg-[#FAF7EF] p-3.5">
              <p class="mb-2 text-xs font-semibold text-muted">建議這樣轉帳（筆數最少）</p>
              <ul class="flex flex-col gap-2 text-sm">
                @for (t of transfers(); track $index) {
                  <li class="flex items-center gap-2">
                    <b>{{ t.from }}</b> <app-icon name="arrow-right" [size]="14" /> <b>{{ t.to }}</b
                    ><span class="ml-auto font-bold">HK$ {{ t.amount | number: '1.0-2' }}</span>
                  </li>
                }
              </ul>
            </div>
          }
          @if (stats().length) {
            <div class="flex flex-col gap-2.5 border-t border-border pt-4">
              <p class="text-[13px] font-semibold text-muted">花費分類</p>
              <div class="flex h-2.5 overflow-hidden rounded-full bg-[#EFE9DA]">
                @for (c of stats(); track c.id) { <span [style.width.%]="c.pct" [style.background]="c.color"></span> }
              </div>
              <ul class="flex flex-col">
                @for (c of stats(); track c.id) {
                  <li class="flex items-center gap-2.5 py-1.5 text-sm">
                    <span class="size-2.5 shrink-0 rounded-full" [style.background]="c.color"></span>
                    <span class="flex-1">{{ c.label }}</span>
                    <span class="font-semibold">HK$ {{ c.sum | number: '1.0-2' }}</span>
                    <span class="w-10 text-right text-xs text-muted">{{ c.pct | number: '1.0-0' }}%</span>
                  </li>
                }
              </ul>
            </div>
          }
        </section>

        <!-- 明細 -->
        <section class="rounded-[20px] border border-border bg-white px-5 py-5 md:px-6">
          <div class="flex items-center justify-between pb-1.5">
            <h2 class="text-[18px] font-bold">明細（{{ list().length }}）</h2>
            <button
              type="button"
              class="flex items-center gap-[7px] rounded-[14px] bg-orange px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
              [disabled]="!svc.members().length"
              (click)="openNew()"
            >
              <app-icon name="plus" [size]="17" /> 記一筆
            </button>
          </div>
          @for (e of list(); track e.id) {
            <div
              role="button"
              tabindex="0"
              class="flex w-full cursor-pointer items-center gap-3.5 border-b border-border py-3.5 text-left last:border-0"
              (click)="edit(e)"
              (keydown.enter)="edit(e)"
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#FAF7EF] text-ink-700"
                ><app-icon [name]="catOf(e).icon" [size]="19"
              /></span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px] font-semibold">{{ e.item }}</span>
                <span class="block text-[12.5px] text-muted"
                  >付：{{ e.payer
                  }}<span class="hidden sm:inline">
                    · {{ fmt(e.time) }} · {{ modeLabel(e.mode) }}</span
                  ></span
                >
              </span>
              <span class="flex shrink-0 items-center gap-2">
                <span
                  class="rounded-full px-2 py-[3px] text-[10.5px] font-bold"
                  [style.background]="(e.currency ?? 'HKD') === 'HKD' ? '#FBEFCB' : '#FBE0CC'"
                  [style.color]="(e.currency ?? 'HKD') === 'HKD' ? '#283845' : '#C06A52'"
                  >{{ e.currency ?? 'HKD' }}</span
                >
                <span class="text-[15px] font-bold"
                  >{{ sym(e.currency)
                  }}{{
                    ((e.currency ?? 'HKD') === 'HKD' ? e.amount : (e.orig ?? e.amount))
                      | number: '1.0-2'
                  }}</span
                >
              </span>
              <span class="hidden w-[84px] shrink-0 justify-end sm:flex">
                @for (p of e.participants; track p; let i = $index) {
                  <span [class.-ml-2]="i > 0"
                    ><app-avatar [name]="p" [size]="26" ring="#fff"
                  /></span>
                }
              </span>
              <button
                type="button"
                class="-mr-1 shrink-0 rounded p-1 text-faint hover:text-navy"
                (click)="openMenu($event, e)"
                aria-label="更多"
              >
                <app-icon name="more" [size]="18" />
              </button>
            </div>
          } @empty {
            <p class="py-4 text-sm text-muted">還沒有花費紀錄</p>
          }
        </section>
      </div>
    </div>

    <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />

    <!-- 記一筆/編輯：所有螢幕都用彈出視窗 -->
    <p-dialog
      [visible]="formOpen()"
      (visibleChange)="!$event && formOpen.set(false)"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [header]="f.id ? '編輯花費' : '記一筆'"
      [style]="{ width: 'min(32rem, 94vw)', maxHeight: '88dvh' }"
    >
      <ng-container *ngTemplateOutlet="formTpl" />
      <ng-template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <button pButton type="button" severity="secondary" [outlined]="true" (click)="reset()">
            取消
          </button>
          <button
            pButton
            type="button"
            [disabled]="!!preview().error || !f.item.trim() || !f.payer"
            (click)="submit()"
          >
            {{ f.id ? '儲存修改' : '新增支出' }}
          </button>
        </div>
      </ng-template>
    </p-dialog>

    <ng-template #formTpl let-mobile="mobile">
      <div class="flex flex-col gap-[18px]">
        <label class="flex flex-col gap-2 text-[13px] font-semibold text-muted"
          >內容
          <input pInputText class="w-full" [ngModel]="f.item" (ngModelChange)="onItem($event)" placeholder="例如：香港仔晚餐" />
        </label>

        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-semibold text-muted">分類</span>
          <div class="flex flex-wrap gap-2">
            @for (c of cats; track c.id) {
              <button type="button" class="flex items-center gap-1.5 rounded-full border px-2.5 py-[7px] text-[13px] font-medium"
                [class]="f.category === c.id ? 'border-[1.5px] border-orange bg-orange-soft' : 'border-border bg-[#FAF7EF]'" (click)="setCat(c.id)">
                <app-icon [name]="c.icon" [size]="14" /> {{ c.label }}
              </button>
            }
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-semibold text-muted">幣別</span>
          <p-select
            [options]="curOptions"
            optionLabel="label"
            optionValue="code"
            [ngModel]="f.currency"
            (ngModelChange)="setCurrency($event)"
            appendTo="body"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-2 text-[13px] font-semibold text-muted">
          金額（{{ f.currency }}）
          <p-inputnumber
            [(ngModel)]="f.amount"
            mode="decimal"
            [minFractionDigits]="0"
            [maxFractionDigits]="2"
            [min]="0"
            placeholder="0"
            inputStyleClass="w-full"
            styleClass="w-full"
          />
        </div>

        @if (f.currency !== 'HKD') {
          <div class="flex flex-col gap-2 rounded-[14px] bg-[#FAF7EF] p-3.5">
            <label class="flex items-center gap-2 text-[13px] font-semibold text-muted"
              >匯率　1 {{ f.currency }} ＝
              <input
                pInputText
                class="!w-24 !py-1.5"
                type="number"
                inputmode="decimal"
                step="any"
                min="0"
                [(ngModel)]="f.rate"
                name="rate"
              />
              HKD
            </label>
            <span class="text-xs text-faint">預設是概估匯率，請改成實際刷卡或換匯的匯率。</span>
            @if (f.amount) {
              <span class="text-sm font-semibold text-ink"
                >≈ HK$ {{ hkd() | number: '1.0-2' }}</span
              >
            }
          </div>
        }

        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-semibold text-muted">時間</span>
          <p-datepicker
            [(ngModel)]="f.time"
            [showTime]="true"
            hourFormat="24"
            dateFormat="yy/mm/dd"
            appendTo="body"
            styleClass="w-full"
            inputStyleClass="w-full"
          />
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-semibold text-muted">誰支付</span>
          <div class="flex flex-wrap gap-2">
            @for (m of svc.members(); track m) {
              <button
                type="button"
                class="flex items-center gap-[7px] rounded-full border px-2.5 py-[7px] text-[13px] font-medium"
                [class]="
                  f.payer === m
                    ? 'border-[1.5px] border-orange bg-orange-soft'
                    : 'border-border bg-[#FAF7EF]'
                "
                (click)="f.payer = m"
              >
                <app-avatar [name]="m" [size]="22" /> {{ m }}
              </button>
            }
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-semibold text-muted">分攤方式</span>
          <div class="seg" role="radiogroup">
            @for (m of modes; track m.id) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="f.mode === m.id"
                (click)="setMode(m.id)"
              >
                {{ m.label }}
              </button>
            }
          </div>
          <span class="text-xs text-faint">{{ modeHint() }}</span>
        </div>

        <div class="flex flex-col gap-1 rounded-[14px] bg-[#FAF7EF] p-3.5">
          @for (m of svc.members(); track m) {
            <div class="flex items-center gap-2 py-1.5 text-sm">
              @if (f.mode === 'equal') {
                <p-checkbox
                  styleClass="note-check"
                  [binary]="true"
                  [ngModel]="f.participants.includes(m)"
                  (ngModelChange)="toggleP(m)"
                  [name]="'p' + m"
                />
              }
              <span class="flex min-w-[5.5rem] flex-1 items-center gap-2"
                ><app-avatar [name]="m" [size]="24" /><span
                  class="min-w-0 break-words font-medium leading-tight"
                  >{{ m }}</span
                ></span
              >
              @if (f.mode !== 'equal') {
                <span class="flex shrink-0 items-center gap-1">
                  <input
                    pInputText
                    class="!w-[4.5rem] !px-2.5 !py-1.5 text-right"
                    type="number"
                    inputmode="decimal"
                    step="any"
                    min="0"
                    [(ngModel)]="f.weights[m]"
                    [name]="'w' + m"
                    placeholder="0"
                  />
                  <span class="w-5 text-xs text-muted">{{ f.mode === 'ratio' ? '%' : '$' }}</span>
                </span>
              }
              <span class="w-16 shrink-0 text-right text-[13px] font-semibold text-muted">{{
                isIn(m) ? (preview().shares[m] | number: '1.0-2') : '—'
              }}</span>
            </div>
          }
          @if (preview().error && f.amount) {
            <p-message severity="error" size="small" class="mt-1">{{ preview().error }}</p-message>
          }
        </div>
      </div>
    </ng-template>
  `,
})
export class ExpensesTab {
  readonly svc = inject(TripService);
  private confirm = inject(ConfirmationService);
  readonly curOptions = CURRENCIES.map((c) => ({ code: c.code, label: `${c.code}　${c.name}` }));
  sym(c?: string) {
    return curOf(c).sym;
  }
  setCurrency(c: Cur) {
    this.f.currency = c;
    this.f.rate = curOf(c).rate;
  }
  readonly modes: { id: SplitMode; label: string }[] = [
    { id: 'equal', label: '平分' },
    { id: 'ratio', label: '按比例' },
    { id: 'custom', label: '按金額' },
  ];
  readonly formOpen = signal(false);
  readonly menu = viewChild.required<Menu>('menu');
  readonly menuItems = signal<MenuItem[]>([]);
  f = this.blank();

  readonly list = computed(() =>
    [...this.svc.expenses()].sort((a, b) => b.time.localeCompare(a.time)),
  );
  readonly net = computed(() => balances(this.svc.expenses(), this.svc.members()));
  readonly transfers = computed(() => settle(this.net()));
  readonly total = computed(() => this.svc.expenses().reduce((s, e) => s + e.amount, 0));

  openMenu(ev: Event, e: Expense) {
    ev.stopPropagation();
    this.menuItems.set([
      { label: '編輯', icon: 'pi pi-pencil', command: () => this.edit(e) },
      { separator: true },
      {
        label: '刪除',
        icon: 'pi pi-trash',
        styleClass: 'hk-danger',
        command: () => this.remove(e),
      },
    ]);
    this.menu().toggle(ev);
  }
  readonly cats = CATS;
  catOf(e: Expense) { return CATS.find((c) => c.id === (e.category ?? guessCat(e.item))) ?? CATS[5]; }
  /** 各分類小計（港幣）與占比，金額大的在前 */
  readonly stats = computed(() => {
    const total = this.total();
    if (!(total > 0)) return [];
    const sums = new Map<string, number>();
    for (const e of this.svc.expenses()) { const id = this.catOf(e).id; sums.set(id, (sums.get(id) ?? 0) + e.amount); }
    return CATS.filter((c) => (sums.get(c.id) ?? 0) > 0)
      .map((c) => ({ ...c, sum: sums.get(c.id)!, pct: (sums.get(c.id)! / total) * 100 }))
      .sort((a, b) => b.sum - a.sum);
  });
  /** 品名一改就依關鍵字預選分類；你手動點過分類之後就不再自動改 */
  onItem(v: string) { this.f.item = v; if (!this.f.catTouched) this.f.category = guessCat(v); }
  setCat(id: string) { this.f.category = id; this.f.catTouched = true; }
  abs(n: number) {
    return Math.abs(n);
  }
  /** 表單目前金額換算成港幣 */
  hkd() {
    const a = Number(this.f.amount) || 0;
    return this.f.currency === 'HKD' ? a : Math.round(a * (Number(this.f.rate) || 0) * 100) / 100;
  }
  /** 實際分攤的人：平分＝有勾的人；按比例/按金額＝有填數字（大於 0）的人，填 0 或留空就是不分攤 */
  parts(): string[] {
    if (this.f.mode === 'equal') return this.f.participants;
    return this.svc.members().filter((m) => (Number(this.f.weights[m]) || 0) > 0);
  }
  isIn(m: string) {
    return this.parts().includes(m);
  }
  /** 按比例＝填百分比，加總必須是 100；其餘沿用 computeShares 的檢查 */
  preview() {
    const parts = this.parts();
    if (this.f.mode === 'ratio' && parts.length) {
      const sum = parts.reduce((n, p) => n + (Number(this.f.weights[p]) || 0), 0);
      if (Math.abs(sum - 100) > 0.001)
        return {
          shares: {} as Record<string, number>,
          error: `比例加總要是 100（目前 ${Math.round(sum * 100) / 100}）`,
        };
    }
    return computeShares(this.f.mode, this.hkd(), parts, this.f.weights);
  }
  /** 切到「按比例」時，先把 100% 平均分給目前有分攤的人（兩人 50/50、三人 34/33/33），其他人是 0，再自己微調 */
  private prefillPercent() {
    const who = this.f.participants.length ? this.f.participants : this.svc.members();
    const n = who.length;
    if (!n) return;
    const base = Math.floor(100 / n),
      extra = 100 - base * n;
    this.f.weights = Object.fromEntries(who.map((p, i) => [p, base + (i < extra ? 1 : 0)]));
  }
  setMode(m: SplitMode) {
    const prev = this.f.mode;
    if (prev !== 'equal' && m === 'equal') {
      const keep = this.parts();
      this.f.participants = keep.length ? keep : [...this.svc.members()];
    }
    this.f.mode = m;
    if (m === 'ratio') this.prefillPercent();
    else if (m === 'custom') this.f.weights = {};
  }
  modeHint() {
    return {
      equal: '勾選要分攤的人，平均分攤',
      ratio: '每個人填百分比，加總要等於 100（例如 40 / 60、50 / 50）；不分攤的人填 0',
      custom: '每個人填港幣金額，合計要等於總額；不分攤的人填 0',
    }[this.f.mode];
  }
  modeLabel(m: SplitMode) {
    return this.modes.find((x) => x.id === m)!.label;
  }
  fmt(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  private blank() {
    return {
      id: undefined as string | undefined,
      item: '',
      category: 'other',
      catTouched: false,
      amount: null as number | null,
      currency: 'HKD' as Cur,
      rate: 1,
      payer: this.svc.me() ?? this.svc.members()[0] ?? '',
      time: new Date(),
      mode: 'equal' as SplitMode,
      participants: [...this.svc.members()],
      weights: {} as Record<string, number>,
    };
  }
  reset() {
    this.f = this.blank();
    this.formOpen.set(false);
  }
  openNew() {
    this.f = this.blank();
    this.formOpen.set(true);
  }
  edit(e: Expense) {
    const cur: Cur = e.currency ?? 'HKD';
    const rate = cur === 'HKD' ? 1 : (e.rate ?? (e.orig ? e.amount / e.orig : curOf(cur).rate));
    this.f = {
      id: e.id,
      item: e.item,
      category: this.catOf(e).id,
      catTouched: true,
      amount: cur === 'HKD' ? e.amount : (e.orig ?? e.amount),
      currency: cur,
      rate,
      payer: e.payer,
      time: new Date(e.time),
      mode: e.mode,
      participants: [...e.participants],
      weights: { ...e.weights },
    };
    if (e.mode === 'ratio') {
      // 舊資料的比例（例如 2:1:1）換算成百分比，才符合「加總 100」
      const sum = e.participants.reduce((n, p) => n + (Number(e.weights[p]) || 0), 0);
      if (sum > 0 && Math.abs(sum - 100) > 0.001)
        this.f.weights = Object.fromEntries(
          e.participants.map((p) => [
            p,
            Math.round(((Number(e.weights[p]) || 0) / sum) * 10000) / 100,
          ]),
        );
    }
    this.formOpen.set(true);
  }
  toggleP(m: string) {
    this.f.participants = this.f.participants.includes(m)
      ? this.f.participants.filter((x) => x !== m)
      : [...this.f.participants, m];
  }
  async submit() {
    const total = this.hkd();
    const parts = this.parts();
    const r = computeShares(this.f.mode, total, parts, this.f.weights);
    if (r.error) return;
    const w: Record<string, number> = {};
    if (this.f.mode !== 'equal') for (const p of parts) w[p] = Number(this.f.weights[p]) || 0;
    const foreign = this.f.currency !== 'HKD';
    await this.svc.save('expenses', {
      id: this.f.id,
      item: this.f.item.trim(),
      category: this.f.category,
      amount: total,
      currency: this.f.currency,
      orig: foreign ? Number(this.f.amount) : null,
      rate: foreign ? Number(this.f.rate) : null,
      payer: this.f.payer,
      time: (this.f.time ?? new Date()).toISOString(),
      mode: this.f.mode,
      participants: parts,
      weights: w,
      shares: r.shares,
    });
    this.reset();
  }
  removeCurrent() {
    const e = this.svc.expenses().find((x) => x.id === this.f.id);
    if (e) this.remove(e);
  }
  remove(e: Expense) {
    this.confirm.confirm({
      header: '刪除花費',
      message: `刪除「${e.item}」？`,
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: async () => {
        await this.svc.remove('expenses', e.id);
        if (this.f.id === e.id) this.reset();
      },
    });
  }
}
