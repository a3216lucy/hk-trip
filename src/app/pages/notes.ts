import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Menu, MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { Avatar } from '../core/avatar';
import { Icon } from '../core/icon';
import { Note, NoteRow, NoteRowKind } from '../core/models';
import { TripService } from '../core/trip.service';

const KINDS: { label: string; value: NoteRowKind }[] = [
  { label: '勾選項', value: 'check' },
  { label: '標題＋說明', value: 'line' },
  { label: '地點', value: 'place' },
  { label: '欄位＋內容', value: 'kv' },
  { label: '提醒（彩色圓形圖示）', value: 'alert' },
  { label: '黃色橫條（欄位＋內容）', value: 'rate' },
];
const ICON_OPTIONS = [
  { label: '資訊', value: 'info' },
  { label: '飯店', value: 'building' },
  { label: '床', value: 'bed' },
  { label: '地點', value: 'pin' },
  { label: '插頭', value: 'plug' },
  { label: '轉換/換錢', value: 'swap' },
  { label: '火車', value: 'train' },
  { label: '卡片', value: 'card' },
  { label: '收據', value: 'receipt' },
  { label: '鈴鐺', value: 'bell' },
  { label: '購物', value: 'bag' },
  { label: '餐廳', value: 'food' },
  { label: '手機', value: 'phone' },
  { label: '現金', value: 'cash' },
  { label: '天氣', value: 'weather' },
  { label: '行事曆', value: 'cal-clock' },
];
/** 卡片分類小標籤的顏色（取自設計稿），沒列到的用卡其色 */
const TONE: Record<string, { bg: string; fg: string }> = {
  必讀: { bg: '#FBEFCB', fg: '#283845' },
  住宿: { bg: '#E7E2D2', fg: '#283845' },
  實用: { bg: '#E7E2D2', fg: '#283845' },
  購物: { bg: '#FBE0CC', fg: '#F29559' },
  餐廳: { bg: '#FBEFCB', fg: '#283845' },
  提醒: { bg: '#FBE0CC', fg: '#283845' },
};
const blank = (kind: NoteRowKind = 'line'): NoteRow => ({ kind, a: '', b: '', c: '', done: false });

/** 舊版純文字筆記：每一行轉成一列「標題＋說明」。 */
function legacyRows(n: Note): NoteRow[] {
  const rows = (n.content ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((a) => ({ ...blank('line'), a }));
  if (n.url) rows.push({ ...blank('line'), a: n.url });
  return rows;
}

@Component({
  selector: 'app-notes',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    InputTextModule,
    MenuModule,
    SelectModule,
    Avatar,
    Icon,
  ],
  template: `
    <div class="mb-5 flex items-center justify-between gap-3 md:mb-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-[24px] font-bold leading-tight">旅遊筆記</h2>
      </div>
      <div class="flex items-center gap-4">
        <span class="hidden items-center sm:flex">
          @for (m of svc.members(); track m; let i = $index) {
            <span [class.-ml-2]="i > 0"><app-avatar [name]="m" [size]="30" ring="#fff" /></span>
          }
        </span>
        <button
          type="button"
          class="flex shrink-0 items-center gap-[7px] rounded-[14px] bg-orange px-4 py-2.5 text-[14px] font-semibold text-white"
          (click)="addNew()"
        >
          <app-icon name="plus" [size]="17" /> 新增筆記
        </button>
      </div>
    </div>

    @for (n of wideNotes(); track n.id) {
      <ng-container *ngTemplateOutlet="cardTpl; context: { $implicit: n, wide: true }" />
    }
    <div class="gap-6 sm:columns-2 lg:columns-3">
      @for (n of narrowNotes(); track n.id) {
        <ng-container *ngTemplateOutlet="cardTpl; context: { $implicit: n, wide: false }" />
      } @empty {
        @if (!wideNotes().length) {
          <p class="text-sm text-muted">還沒有筆記</p>
        }
      }
    </div>

    <ng-template #cardTpl let-n let-wide="wide">
      <section
        class="mb-6 flex break-inside-avoid flex-col gap-3.5 rounded-[20px] border border-border bg-white p-5"
      >
        <header
          class="flex cursor-pointer items-center gap-2.5 md:cursor-default"
          (click)="toggleCard(n)"
          [attr.aria-expanded]="!isCollapsed(n)"
        >
          @if (n.category) {
            <span
              class="shrink-0 rounded-full px-2.5 py-[5px] text-xs font-bold leading-none"
              [style.background]="tone(n.category).bg"
              [style.color]="tone(n.category).fg"
              >{{ n.category }}</span
            >
          }
          @if (n.icon) {
            <span class="shrink-0 translate-y-[2px] text-navy-2"
              ><app-icon [name]="n.icon" [size]="18"
            /></span>
          }
          <h3 class="min-w-0 flex-1 break-words text-[17px] font-bold leading-snug">
            {{ n.title }}
          </h3>
          @if (checkCount(n)) {
            <span class="shrink-0 text-xs font-medium leading-none text-faint"
              >{{ checkDone(n) }} / {{ checkCount(n) }}</span
            >
          }
          <button
            type="button"
            class="-mr-1 shrink-0 translate-y-[2px] rounded p-1 text-faint hover:bg-bg hover:text-navy"
            (click)="$event.stopPropagation(); openMenu($event, n)"
            aria-label="更多"
          >
            <app-icon name="more" [size]="18" />
          </button>
          <span class="shrink-0 translate-y-[2px] text-faint md:hidden"
            ><app-icon [name]="isCollapsed(n) ? 'chevron-down' : 'chevron-up'" [size]="18"
          /></span>
        </header>

        <div
          [class]="
            isCollapsed(n)
              ? wide
                ? 'hidden gap-x-8 gap-y-1 sm:grid-cols-3 md:grid'
                : 'hidden flex-col md:flex'
              : wide
                ? 'grid gap-x-8 gap-y-1 sm:grid-cols-3'
                : 'flex flex-col'
          "
        >
          @for (r of rowsOf(n); track $index; let last = $last) {
            <div
              class="group flex items-center gap-1"
              (click)="activeRow.set(n.id + ':' + $index)"
              [class.border-b]="(r.kind === 'place' || r.kind === 'kv') && !last"
              [class.border-border]="(r.kind === 'place' || r.kind === 'kv') && !last"
            >
              <div class="min-w-0 flex-1">
                @switch (r.kind) {
                  @case ('check') {
                    <label class="flex items-center gap-[11px] py-[7px] text-[14px] font-medium">
                      <p-checkbox
                        styleClass="note-check"
                        [binary]="true"
                        [ngModel]="r.done"
                        (ngModelChange)="toggle(n, $index, $event)"
                      />
                      <span class="min-w-0 break-words" [class.text-faint]="r.done">{{ r.a }}</span>
                    </label>
                  }
                  @case ('line') {
                    <div class="flex items-start gap-3 py-2">
                      <span
                        class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#FAF7EF] text-ink-700"
                        ><app-icon [name]="r.icon || 'info'" [size]="17"
                      /></span>
                      <div class="min-w-0 flex-1">
                        @if (r.url) {
                          <a
                            class="break-all text-[14px] font-semibold text-navy-2 underline"
                            [href]="r.url"
                            target="_blank"
                            rel="noopener"
                            >{{ r.a }}</a
                          >
                        } @else if (isUrl(r.a)) {
                          <a
                            class="break-all text-[14px] font-semibold text-navy-2 underline"
                            [href]="r.a"
                            target="_blank"
                            rel="noopener"
                            >{{ r.a }}</a
                          >
                        } @else {
                          <p class="break-words text-[14px] font-semibold leading-snug">
                            {{ r.a }}
                          </p>
                        }
                        @if (r.b) {
                          <p class="break-words text-[12.5px] leading-snug text-muted">{{ r.b }}</p>
                        }
                      </div>
                    </div>
                  }
                  @case ('place') {
                    <div class="flex items-center justify-between gap-2 py-[13px]">
                      <div class="min-w-0">
                        <p class="break-words text-[14px] font-semibold">{{ r.a }}</p>
                        @if (r.b) {
                          <p class="break-words text-[12.5px] text-muted">{{ r.b }}</p>
                        }
                      </div>
                      @if (r.c) {
                        <a
                          class="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-[#FAF7EF] px-[11px] py-[7px] text-[12.5px] font-semibold"
                          [href]="'tel:' + r.c"
                          ><app-icon name="call" [size]="14" />{{ r.c }}</a
                        >
                      }
                    </div>
                  }
                  @case ('alert') {
                    <div class="flex items-center gap-3 py-2">
                      <span
                        class="flex size-8 shrink-0 items-center justify-center rounded-full text-on-dark"
                        [style.background]="alertTone(n, $index)"
                        ><app-icon [name]="r.icon || 'info'" [size]="16"
                      /></span>
                      <p class="min-w-0 break-words text-[14px] font-semibold leading-snug">
                        {{ r.a }}
                      </p>
                    </div>
                  }
                  @case ('rate') {
                    <div
                      class="flex items-center justify-between gap-3 rounded-[14px] bg-accent-soft px-3.5 py-[11px]"
                    >
                      <span class="text-[12.5px] font-medium text-navy-2">{{ r.a }}</span>
                      <span class="text-right text-[13.5px] font-bold">{{ r.b }}</span>
                    </div>
                  }
                  @case ('kv') {
                    <div class="flex items-start justify-between gap-3 py-[11px] text-[13px]">
                      <span class="shrink-0 text-muted">{{ r.a }}</span>
                      <span class="break-words text-right text-[13.5px] font-semibold">{{
                        r.b
                      }}</span>
                    </div>
                  }
                }
              </div>
              <button
                type="button"
                [class]="
                  activeRow() === n.id + ':' + $index
                    ? 'shrink-0 rounded p-1 text-faint hover:text-navy'
                    : 'invisible shrink-0 rounded p-1 text-faint hover:text-navy md:visible md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
                "
                (click)="$event.stopPropagation(); openRowMenu($event, n, $index)"
                aria-label="這一列的選項"
              >
                <app-icon name="more" [size]="16" />
              </button>
            </div>
          } @empty {
            <p class="py-1 text-xs text-muted">這張卡片還沒有內容</p>
          }
          <button
            type="button"
            class="mt-1 flex items-center gap-[11px] py-1.5 text-left sm:col-span-full text-[14px] font-medium text-faint"
            (click)="addRow(n)"
          >
            <span
              class="flex size-[22px] items-center justify-center rounded-full border-[1.5px] border-border-strong"
              ><app-icon name="plus" [size]="13"
            /></span>
            新增一列…
          </button>
        </div>
      </section>
    </ng-template>

    <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />

    <!-- 新增／編輯一列 -->
    <p-dialog
      [visible]="rowDlg() !== null"
      (visibleChange)="!$event && rowDlg.set(null)"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [header]="rowDlg()?.idx == null ? '新增一列' : '編輯這一列'"
      [style]="{ width: 'min(30rem, 94vw)' }"
    >
      <div class="flex flex-col gap-3.5">
        <div class="field">
          型態
          <p-select
            [options]="kinds"
            optionLabel="label"
            optionValue="value"
            [(ngModel)]="rowDraft.kind"
            appendTo="body"
            class="w-full"
          />
        </div>
        <label class="field"
          >{{ ph(rowDraft.kind)[0]
          }}<input
            pInputText
            class="w-full"
            [(ngModel)]="rowDraft.a"
            [placeholder]="ph(rowDraft.kind)[0]"
        /></label>
        @if (rowDraft.kind !== 'check' && rowDraft.kind !== 'alert') {
          <label class="field"
            >{{ ph(rowDraft.kind)[1]
            }}<input
              pInputText
              class="w-full"
              [(ngModel)]="rowDraft.b"
              [placeholder]="ph(rowDraft.kind)[1]"
          /></label>
        }
        @if (rowDraft.kind === 'place') {
          <label class="field"
            >電話（選填）<input pInputText class="w-full" inputmode="tel" [(ngModel)]="rowDraft.c"
          /></label>
        }
        @if (rowDraft.kind === 'line' || rowDraft.kind === 'alert') {
          <div class="field">
            左側圖示
            <p-select
              [options]="iconOptions"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="rowDraft.icon"
              placeholder="選擇圖示"
              appendTo="body"
              class="w-full"
            />
          </div>
        }
      </div>
      <ng-template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            (click)="rowDlg.set(null)"
          >
            取消
          </button>
          <button
            pButton
            type="button"
            [disabled]="!rowDraft.a.trim() && !rowDraft.b.trim()"
            (click)="saveRow()"
          >
            儲存
          </button>
        </div>
      </ng-template>
    </p-dialog>

    <p-dialog
      [visible]="editing() !== null"
      (visibleChange)="!$event && editing.set(null)"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [header]="editing() === 'new' ? '新增筆記' : '編輯筆記'"
      [style]="{ width: 'min(36rem, 94vw)' }"
    >
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-3 gap-3">
          <label class="field col-span-2"
            >標題<input pInputText class="w-full" [(ngModel)]="draft.title"
          /></label>
          <label class="field"
            >分類<input
              pInputText
              class="w-full"
              placeholder="例：住宿"
              [(ngModel)]="draft.category"
          /></label>
        </div>
        <label class="flex items-center gap-2 text-sm text-muted"
          ><p-checkbox [binary]="true" [(ngModel)]="draft.wide" name="wide" />
          整排寬卡片（顯示在最上方）</label
        >
        <label class="field"
          >卡片圖示
          <p-select
            [options]="iconOptions"
            optionLabel="label"
            optionValue="value"
            [(ngModel)]="draft.icon"
            [showClear]="true"
            placeholder="（不顯示）"
            appendTo="body"
            class="w-full"
          />
        </label>
      </div>
      <ng-template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            (click)="editing.set(null)"
          >
            取消
          </button>
          <button pButton type="button" [disabled]="!draft.title.trim()" (click)="save()">
            儲存
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class NotesTab {
  private confirm = inject(ConfirmationService);
  /** 手機上點過的那一列才顯示 ⋮（電腦版滑鼠移上去才顯示） */
  readonly activeRow = signal<string | null>(null);
  readonly kinds = KINDS;
  /** 手機版卡片展開/收合（電腦版一律展開）。記在這支手機的瀏覽器裡；沒記錄時只展開「出發前待辦」和整排寬的卡片。 */
  private readonly collapsedMap = signal<Record<string, boolean>>(this.loadCollapsed());
  private loadCollapsed(): Record<string, boolean> {
    try { return JSON.parse(localStorage.getItem('hk-trip:notes-collapsed') ?? '{}'); } catch { return {}; }
  }
  isCollapsed(n: Note): boolean {
    const v = this.collapsedMap()[n.id];
    return v ?? !(n.wide || n.title === '出發前待辦');
  }
  toggleCard(n: Note) {
    const next = { ...this.collapsedMap(), [n.id]: !this.isCollapsed(n) };
    this.collapsedMap.set(next);
    try { localStorage.setItem('hk-trip:notes-collapsed', JSON.stringify(next)); } catch { /* 私密模式 */ }
  }
  readonly menu = viewChild.required<Menu>('menu');
  readonly menuItems = signal<MenuItem[]>([]);
  readonly iconOptions = ICON_OPTIONS;
  readonly svc = inject(TripService);
  readonly blank = blank;
  /** null＝關閉；'new'＝新增；其他＝正在編輯的筆記 id */
  readonly editing = signal<string | null>(null);
  draft: { title: string; category: string; icon: string; wide: boolean; rows: NoteRow[] } = {
    title: '',
    category: '',
    icon: '',
    wide: false,
    rows: [],
  };
  readonly sorted = computed(() => [...this.svc.notes()].sort((a, b) => a.order - b.order));
  readonly wideNotes = computed(() => this.sorted().filter((n) => n.wide));
  readonly narrowNotes = computed(() => this.sorted().filter((n) => !n.wide));
  /** 提醒列的圓形底色：同一張卡片內依序輪流 */
  alertTone(n: Note, idx: number) {
    const tones = ['#F29559', '#36475A', '#B8B08D', '#C06A52'];
    const k = this.rowsOf(n)
      .slice(0, idx)
      .filter((r) => r.kind === 'alert').length;
    return tones[k % tones.length];
  }

  rowsOf(n: Note): NoteRow[] {
    return n.rows ?? legacyRows(n);
  }
  tone(c: string) {
    return TONE[c] ?? { bg: '#E7E2D2', fg: '#283845' };
  }
  checkCount(n: Note) {
    return this.rowsOf(n).filter((r) => r.kind === 'check').length;
  }
  checkDone(n: Note) {
    return this.rowsOf(n).filter((r) => r.kind === 'check' && r.done).length;
  }
  // ---- 卡片裡的一列：用輕量小視窗新增、編輯、刪除 ----
  readonly rowDlg = signal<{ noteId: string; idx: number | null } | null>(null);
  rowDraft: NoteRow = blank('line');
  /** 卡片底部「新增一列」：型態預設沿用最後一列 */
  addRow(n: Note) {
    const rows = this.rowsOf(n);
    this.rowDraft = blank(rows[rows.length - 1]?.kind ?? 'line');
    this.rowDlg.set({ noteId: n.id, idx: null });
  }
  openRowMenu(ev: Event, n: Note, idx: number) {
    this.menuItems.set([
      {
        label: '編輯',
        icon: 'pi pi-pencil',
        command: () => {
          this.rowDraft = { ...this.rowsOf(n)[idx] };
          this.rowDlg.set({ noteId: n.id, idx });
        },
      },
      { separator: true },
      {
        label: '刪除',
        icon: 'pi pi-trash',
        styleClass: 'hk-danger',
        command: () => this.removeRow(n, idx),
      },
    ]);
    this.menu().toggle(ev);
  }
  async saveRow() {
    const d = this.rowDlg();
    const n = d && this.svc.notes().find((x) => x.id === d.noteId);
    if (!d || !n) return;
    const rows = this.rowsOf(n).map((r) => ({ ...r }));
    const row = {
      ...this.rowDraft,
      a: this.rowDraft.a.trim(),
      b: this.rowDraft.b.trim(),
      c: this.rowDraft.c.trim(),
    };
    if (d.idx == null) rows.push(row);
    else rows[d.idx] = row;
    await this.svc.save('notes', { ...n, rows, content: '', url: '' });
    this.rowDlg.set(null);
  }
  removeRow(n: Note, idx: number) {
    const r = this.rowsOf(n)[idx];
    this.confirm.confirm({
      header: '刪除這一列',
      message: `刪除「${r.a || r.b}」？`,
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: async () => {
        const cur = this.svc.notes().find((x) => x.id === n.id);
        if (!cur) return;
        await this.svc.save('notes', {
          ...cur,
          rows: this.rowsOf(cur).filter((_, i) => i !== idx),
          content: '',
          url: '',
        });
      },
    });
  }
  isUrl(s: string) {
    return /^https?:\/\//i.test(s);
  }
  ph(k: NoteRowKind): [string, string] {
    return {
      check: ['項目', ''],
      line: ['標題', '補充說明（選填）'],
      place: ['店家/地點名稱', '地區 · 備註'],
      kv: ['欄位，例：房號', '內容'],
      alert: ['提醒內容', ''],
      rate: ['欄位，例：參考匯率', '內容'],
    }[k] as [string, string];
  }

  openMenu(ev: Event, n: Note) {
    this.menuItems.set([
      { label: '編輯', icon: 'pi pi-pencil', command: () => this.edit(n) },
      { separator: true },
      {
        label: '刪除',
        icon: 'pi pi-trash',
        styleClass: 'hk-danger',
        command: () => this.remove(n),
      },
    ]);
    this.menu().toggle(ev);
  }
  addNew() {
    this.draft = { title: '', category: '', icon: '', wide: false, rows: [] };
    this.editing.set('new');
  }
  edit(n: Note) {
    this.draft = {
      title: n.title,
      category: n.category ?? '',
      icon: n.icon ?? '',
      wide: !!n.wide,
      rows: this.rowsOf(n).map((r) => ({ ...r })),
    };
    this.editing.set(n.id);
  }
  move(i: number, d: number) {
    const rows = this.draft.rows,
      j = i + d;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  toggle(n: Note, i: number, done: boolean) {
    const rows = this.rowsOf(n).map((r, k) => (k === i ? { ...r, done } : r));
    void this.svc.save('notes', { ...n, rows, content: '', url: '' });
  }
  async save() {
    const id = this.editing();
    if (!id || !this.draft.title.trim()) return;
    const rows = this.draft.rows.filter((r) => r.a.trim() || r.b.trim());
    const data = {
      title: this.draft.title.trim(),
      category: this.draft.category.trim(),
      icon: this.draft.icon || '',
      wide: this.draft.wide,
      rows,
      content: '',
      url: '',
    };
    if (id === 'new') await this.svc.save('notes', { ...data, order: Date.now() });
    else {
      const n = this.svc.notes().find((x) => x.id === id);
      if (n) await this.svc.save('notes', { ...n, ...data });
    }
    this.editing.set(null);
  }
  remove(target?: Note) {
    const n = target ?? this.svc.notes().find((x) => x.id === this.editing());
    if (!n) return;
    this.confirm.confirm({
      header: '刪除筆記',
      message: `刪除「${n.title}」？`,
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: async () => {
        await this.svc.remove('notes', n.id);
        if (this.editing() === n.id) this.editing.set(null);
      },
    });
  }
}
