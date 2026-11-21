import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { Menu, MenuModule } from 'primeng/menu';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { Avatar } from '../core/avatar';
import { Icon } from '../core/icon';
import { PackItem } from '../core/models';
import { PACK_DEFAULT } from '../core/seed';
import { TripService } from '../core/trip.service';

/** 分類 → 圖示與色塊（顏色取自設計稿）；沒列到的分類用預設 */
const CAT: Record<string, { icon: string; bg: string; fg: string }> = {
  '隨身包（登機）': { icon: 'briefcase', bg: '#FBE0CC', fg: '#F29559' },
  '電子用品': { icon: 'plug', bg: '#E7E2D2', fg: '#283845' },
  '衣物': { icon: 'shirt', bg: '#FBE0CC', fg: '#F29559' },
  '證件文件': { icon: 'file', bg: '#FBEFCB', fg: '#B98900' },
  '盥洗保養': { icon: 'drops', bg: '#DDEADF', fg: '#5B8C6E' },
  '藥品雜物': { icon: 'pill', bg: '#FBEFCB', fg: '#B98900' },
};
const DEFAULT_CAT = { icon: 'luggage', bg: '#E7E2D2', fg: '#283845' };

@Component({
  selector: 'app-packing',
  imports: [FormsModule, ButtonModule, CheckboxModule, DialogModule, InputNumberModule, InputTextModule, MenuModule, ProgressBarModule, SelectModule, Avatar, Icon],
  template: `
    <div class="flex flex-col gap-[22px]">
      <section class="flex flex-col gap-3 rounded-[20px] border border-border bg-white px-5 py-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="flex min-w-0 items-center gap-2 text-[18px] font-bold">
            <span class="text-orange"><app-icon name="luggage" [size]="20" /></span> 我的行李
            <app-avatar [name]="me()" [size]="24" />
          </h2>
          <button type="button" class="flex shrink-0 items-center gap-1.5 rounded-xl bg-orange px-3.5 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50" [disabled]="!mine().length" (click)="openNew()">
            <app-icon name="plus" [size]="16" /> 新增項目
          </button>
        </div>
        <div class="flex items-center gap-3">
          <p-progressbar class="min-w-0 flex-1" [value]="percent()" [showValue]="false" [style]="{ height: '6px' }" />
          <span class="shrink-0 text-[13px] text-muted"><b class="text-[18px] font-bold text-orange">{{ doneCount() }}</b> / {{ mine().length }} 項已打包</span>
        </div>
      </section>

      @if (!mine().length) {
        <section class="flex flex-col items-center gap-3 rounded-[20px] border border-border bg-white p-8 text-center">
          <span class="text-orange"><app-icon name="luggage" [size]="32" /></span>
          <p class="text-sm text-muted">你還沒有行李清單，先用預設清單開始，之後可以自己增刪。</p>
          <button type="button" class="rounded-[14px] bg-navy px-5 py-3 text-[15px] font-semibold text-on-dark disabled:opacity-50" [disabled]="busy()" (click)="seed()">建立預設清單</button>
        </section>
      }

      <div class="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
        @for (g of groups(); track g.category) {
          <section class="flex flex-col gap-3.5 rounded-[20px] border border-border bg-white p-5">
            <header
              class="flex cursor-pointer items-center gap-3 md:cursor-default"
              (click)="toggleGroup(g)"
              [attr.aria-expanded]="!isCollapsed(g)"
            >
              <span class="flex size-10 shrink-0 items-center justify-center rounded-xl" [style.background]="cat(g.category).bg" [style.color]="cat(g.category).fg"><app-icon [name]="cat(g.category).icon" [size]="20" /></span>
              <h3 class="min-w-0 flex-1 text-[16px] font-bold">{{ g.category }}</h3>
              <span class="text-[13px] font-medium text-faint">{{ g.done }}/{{ g.items.length }}</span>
              <span class="text-faint md:hidden"
                ><app-icon [name]="isCollapsed(g) ? 'chevron-down' : 'chevron-up'" [size]="18"
              /></span>
            </header>
            <ul [class]="isCollapsed(g) ? 'hidden flex-col md:flex' : 'flex flex-col'">
              @for (it of g.items; track it.id) {
                <li class="group flex items-center gap-3 border-b border-border py-2.5 last:border-0" (click)="activeId.set(it.id)">
                  <p-checkbox styleClass="pack-check" [binary]="true" [ngModel]="it.done" (ngModelChange)="toggle(it, $event)" [inputId]="it.id" />
                  <label [for]="it.id" class="min-w-0 flex-1 cursor-pointer break-words text-[14.5px] font-medium" [class.text-faint]="it.done">{{ it.label }}</label>
                  @if (it.qty) { <span class="shrink-0 text-[13px] text-faint">×{{ it.qty }}</span> }
                  @if (it.note) { <span class="shrink-0 text-[12.5px] text-faint">{{ it.note }}</span> }
                  <button type="button" [class]="activeId() === it.id ? 'shrink-0 rounded p-0.5 text-faint hover:text-navy' : 'invisible shrink-0 rounded p-0.5 text-faint hover:text-navy md:visible md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'" (click)="$event.stopPropagation(); openMenu($event, it)" [attr.aria-label]="'更多：' + it.label"><app-icon name="more" [size]="16" /></button>
                </li>
              }
            </ul>
          </section>
        }
      </div>

    </div>

    <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />

    <p-dialog [visible]="editing() !== null" (visibleChange)="!$event && editing.set(null)" [modal]="true" [draggable]="false"
      [dismissableMask]="true" [header]="editing() === 'new' ? '新增打包項目' : '編輯項目'" [style]="{ width: 'min(30rem, 94vw)' }">
      <div class="flex flex-col gap-3.5">
        <label class="field">名稱<input pInputText class="w-full" [(ngModel)]="draft.label" placeholder="例如：延長線、暈車藥" /></label>
        <div class="field">分類
          <p-select [options]="categories()" [(ngModel)]="draft.category" [editable]="true" placeholder="選擇或輸入新分類" appendTo="body" class="w-full" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="field">數量（選填）
            <p-inputnumber [(ngModel)]="draft.qty" [min]="1" [max]="99" placeholder="例如 4" inputStyleClass="w-full" styleClass="w-full" />
          </div>
          <label class="field">備註（選填）<input pInputText class="w-full" [(ngModel)]="draft.note" placeholder="例如：香港 G 型" /></label>
        </div>
      </div>
      <ng-template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <button pButton type="button" severity="secondary" [outlined]="true" (click)="editing.set(null)">取消</button>
          <button pButton type="button" [disabled]="!draft.label.trim()" (click)="save()">儲存</button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class PackingTab {
  private svc = inject(TripService);
  private confirm = inject(ConfirmationService);
  readonly busy = signal(false);
  readonly menu = viewChild.required<Menu>('menu');
  readonly menuItems = signal<MenuItem[]>([]);
  /** null＝關閉；'new'＝新增；其他＝正在編輯的項目 id */
  readonly editing = signal<string | null>(null);
  draft = { label: '', category: '', qty: null as number | null, note: '' };

  readonly me = computed(() => this.svc.me() ?? '');
  readonly mine = computed(() => this.svc.packing().filter((p) => p.owner === this.me()).sort((a, b) => a.order - b.order));
  readonly doneCount = computed(() => this.mine().filter((p) => p.done).length);
  readonly percent = computed(() => (this.mine().length ? Math.round((this.doneCount() / this.mine().length) * 100) : 0));
  readonly categories = computed(() => [...new Set(this.mine().map((p) => p.category))]);
  readonly groups = computed(() => {
    const map = new Map<string, PackItem[]>();
    for (const p of this.mine()) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map].map(([category, items]) => ({ category, items, done: items.filter((i) => i.done).length }));
  });

  /** 手機版分類展開/收合（電腦版一律展開）。記在這支手機的瀏覽器裡；沒記錄時，全部勾完的分類收合、還有沒勾的展開。 */
  private readonly collapsedMap = signal<Record<string, boolean>>(this.loadCollapsed());
  private loadCollapsed(): Record<string, boolean> {
    try { return JSON.parse(localStorage.getItem('hk-trip:pack-collapsed') ?? '{}'); } catch { return {}; }
  }
  /** 第一次有清單時，記下「哪些分類本來就全部勾完」，之後勾選不會讓分類自己突然收合 */
  private initial: Record<string, boolean> | null = null;
  isCollapsed(g: { category: string; items: PackItem[]; done: number }): boolean {
    const stored = this.collapsedMap()[g.category];
    if (stored !== undefined) return stored;
    this.initial ??= Object.fromEntries(this.groups().map((x) => [x.category, x.items.length > 0 && x.done === x.items.length]));
    return this.initial[g.category] ?? false;
  }
  toggleGroup(g: { category: string; items: PackItem[]; done: number }) {
    const next = { ...this.collapsedMap(), [g.category]: !this.isCollapsed(g) };
    this.collapsedMap.set(next);
    try { localStorage.setItem('hk-trip:pack-collapsed', JSON.stringify(next)); } catch { /* 私密模式 */ }
  }

  /** 手機上點過的那一列才顯示 ⋮（電腦版滑鼠移上去才顯示） */
  readonly activeId = signal<string | null>(null);

  cat(name: string) { return CAT[name] ?? DEFAULT_CAT; }

  async seed() {
    this.busy.set(true);
    let n = 0;
    const rows = PACK_DEFAULT.flatMap((g) =>
      g.items.map((it) => ({ owner: this.me(), category: g.category, label: it.label, qty: it.qty ?? null, note: it.note ?? null, done: false, order: n++ })));
    try { await this.svc.saveMany('packing', rows); } finally { this.busy.set(false); }
  }
  toggle(it: PackItem, done: boolean) { void this.svc.save('packing', { ...it, done }); }
  openMenu(ev: Event, it: PackItem) {
    this.menuItems.set([
      { label: '編輯', icon: 'pi pi-pencil', command: () => this.openEdit(it) },
      { separator: true },
      { label: '刪除', icon: 'pi pi-trash', styleClass: 'hk-danger', command: () => this.remove(it) },
    ]);
    this.menu().toggle(ev);
  }
  openNew() {
    this.draft = { label: '', category: this.categories()[0] ?? '', qty: null, note: '' };
    this.editing.set('new');
  }
  openEdit(it: PackItem) {
    this.draft = { label: it.label, category: it.category, qty: it.qty ?? null, note: it.note ?? '' };
    this.editing.set(it.id);
  }
  async save() {
    const id = this.editing();
    const label = this.draft.label.trim();
    if (!id || !label) return;
    const fields = { label, category: this.draft.category.trim() || '其他', qty: this.draft.qty || null, note: this.draft.note.trim() || null };
    if (id === 'new') await this.svc.save('packing', { ...fields, owner: this.me(), done: false, order: Date.now() });
    else {
      const it = this.mine().find((x) => x.id === id);
      if (it) await this.svc.save('packing', { ...it, ...fields });
    }
    this.editing.set(null);
  }
  remove(target?: PackItem) {
    const it = target ?? this.mine().find((x) => x.id === this.editing());
    if (!it) return;
    this.confirm.confirm({
      header: '刪除項目', message: `刪除「${it.label}」？`, acceptLabel: '刪除', rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' }, rejectButtonProps: { severity: 'secondary', text: true },
      accept: async () => { await this.svc.remove('packing', it.id); if (this.editing() === it.id) this.editing.set(null); },
    });
  }
}
