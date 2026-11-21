import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputMaskModule } from 'primeng/inputmask';
import { InputTextModule } from 'primeng/inputtext';
import { Menu, MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Icon } from '../core/icon';
import { Item, StopType, Sub, TravelMode } from '../core/models';
import { DAYS } from '../core/seed';
import { TripService } from '../core/trip.service';

// bg/fg：節點圓圈；bg2/fg2：卡片上的小標籤（顏色取自設計稿）
const TYPES: Record<
  StopType,
  { label: string; icon: string; bg: string; fg: string; bg2: string; fg2: string }
> = {
  flight: {
    label: '航班',
    icon: 'plane',
    bg: '#E7E2D2',
    fg: '#283845',
    bg2: '#FBE0CC',
    fg2: '#F29559',
  },
  hotel: {
    label: '住宿',
    icon: 'hotel',
    bg: '#DDEADF',
    fg: '#5B8C6E',
    bg2: '#DDEADF',
    fg2: '#5B8C6E',
  },
  food: {
    label: '美食',
    icon: 'food',
    bg: '#FBE0CC',
    fg: '#F29559',
    bg2: '#FBEFCB',
    fg2: '#B98900',
  },
  place: {
    label: '景點',
    icon: 'pin',
    bg: '#FBEFCB',
    fg: '#B98900',
    bg2: '#E7E2D2',
    fg2: '#283845',
  },
  shop: {
    label: '購物',
    icon: 'bag',
    bg: '#FBE0CC',
    fg: '#F29559',
    bg2: '#FBE0CC',
    fg2: '#F29559',
  },
  transit: {
    label: '交通',
    icon: 'train',
    bg: '#E7E2D2',
    fg: '#283845',
    bg2: '#E7E2D2',
    fg2: '#283845',
  },
  other: {
    label: '其他',
    icon: 'star',
    bg: '#E7E2D2',
    fg: '#5C6775',
    bg2: '#E7E2D2',
    fg2: '#5C6775',
  },
};
const MODES: Record<Exclude<TravelMode, ''>, { label: string; icon: string }> = {
  mrt: { label: '港鐵', icon: 'train' },
  walk: { label: '步行', icon: 'footprints' },
  bus: { label: '巴士', icon: 'bus' },
  tram: { label: '叮叮', icon: 'tram' },
  taxi: { label: '計程車', icon: 'taxi' },
  ferry: { label: '渡輪', icon: 'ship' },
  train: { label: '機場快線/火車', icon: 'train' },
  other: { label: '其他（自行輸入）', icon: 'navigation' },
};

interface Draft {
  type: StopType;
  title: string;
  time: string;
  endTime: string;
  stay: number | null;
  hours: string;
  address: string;
  note: string;
  day: string;
  travelMode: TravelMode;
  travelMin: number | null;
  subs: Sub[];
}

@Component({
  selector: 'app-itinerary',
  host: { class: 'block' },
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputMaskModule,
    MenuModule,
    SelectModule,
    TextareaModule,
    Icon,
  ],
  template: `
    <!-- 日期分頁＋當天標題：手機是深藍頁首內的膠囊＋卡片；桌機是同一塊白色區域 -->
    <div
      class="sticky top-[calc(env(safe-area-inset-top)+68px)] z-20 bg-navy px-5 pb-4 md:sticky md:top-[116px] md:bg-white md:px-0 md:pb-3 md:pt-4"
    >
      <div class="mx-auto flex max-w-7xl items-center gap-3 md:px-8">
        <div class="flex min-w-0 flex-1 gap-2 overflow-x-auto" role="tablist">
          @for (d of pillDays; track d.date; let i = $index) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="day() === d.date"
              class="flex min-w-[74px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] border px-3 py-[9px] md:min-w-[100px] md:flex-none md:items-start md:rounded-xl md:px-3.5 md:py-2"
              [class]="
                day() === d.date
                  ? 'border-sand bg-sand text-navy md:border-navy md:bg-navy md:text-white'
                  : 'border-transparent bg-white/10 text-on-dark md:border-border md:bg-[#FAF7EF] md:text-navy'
              "
              (click)="day.set(d.date)"
            >
              <span class="text-[14px] font-bold leading-tight md:hidden">{{ d.md }}</span>
              <span
                class="text-[11px] font-medium leading-tight md:hidden"
                [class]="day() === d.date ? 'text-navy-2' : 'text-on-dark-muted'"
                >{{ d.wk }}</span
              >
              <span class="hidden text-[13px] font-bold leading-tight md:block">{{
                'Day ' + (i + 1)
              }}</span>
              <span
                class="hidden text-[11.5px] font-medium leading-tight md:block"
                [class]="day() === d.date ? 'text-on-dark-muted' : 'text-muted'"
                >{{ d.md + d.wk }}</span
              >
            </button>
          }
        </div>
        <!-- 桌機：新增與備選放在日期膠囊同一排的右側 -->
        <div class="hidden shrink-0 items-center gap-2 md:flex">
          @if (routeUrl()) {
            <a class="flex items-center gap-1.5 rounded-[14px] border border-border-strong bg-white px-4 py-2.5 text-[14px] font-semibold text-navy" [href]="routeUrl()" target="_blank" rel="noopener">
              <app-icon name="navigation" [size]="16" /> 當天路線總覽
            </a>
          }
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-[14px] border border-border-strong bg-white px-4 py-2.5 text-[14px] font-semibold text-navy"
            (click)="justAdded.set(''); poolOpen.set(true)"
          >
            <app-icon name="star" [size]="16" /> 從備選加入（{{ poolCount() }}）
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-[14px] bg-navy px-4 py-2.5 text-[14px] font-semibold text-white"
            (click)="openNew()"
          >
            <app-icon name="plus" [size]="16" /> 新增一站
          </button>
        </div>
      </div>
    </div>

    <div class="md:border-b md:border-border md:bg-white">
      <div class="mx-auto max-w-7xl px-5 pt-[18px] md:px-8 md:pb-5 md:pt-4">
        <section
          class="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-white px-4 py-3 md:rounded-none md:border-0 md:p-0"
        >
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="flex items-center gap-2">
              <h2 class="text-[18px] font-bold leading-tight md:text-[24px]">
                {{ dayInfo().md }}{{ dayInfo().wk.startsWith('（') ? dayInfo().wk : '' }}
              </h2>
              <span
                class="shrink-0 rounded-full bg-orange-soft px-[9px] py-[3px] text-xs font-semibold text-orange md:py-1"
                >{{ dayInfo().tag }}</span
              >
              @if (weatherOf(day()); as w) {
                <span
                  class="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-[3px] text-xs font-semibold text-ink md:hidden"
                >
                  <span class="text-gold-text"><app-icon [name]="w.icon" [size]="13" /></span>
                  {{ w.label }} {{ w.min }}–{{ w.max }}°
                </span>
              }
            </div>
            <div class="flex items-center justify-between gap-2">
              <p class="text-[13px] font-medium text-muted">{{ dayInfo().blurb }}</p>
              @if (routeUrl()) {
                <a class="flex shrink-0 items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-navy-2 md:hidden" [href]="routeUrl()" target="_blank" rel="noopener">
                  <app-icon name="navigation" [size]="13" /> 路線總覽
                </a>
              }
            </div>
          </div>
          <!-- 桌機：標籤放右側 -->
          <div class="hidden shrink-0 items-center gap-2 md:flex">
            @if (weatherOf(day()); as w) {
              <span
                class="flex items-center gap-[5px] rounded-full bg-accent-soft px-[11px] py-1.5 text-[12.5px] font-semibold text-ink"
              >
                <span class="text-gold-text"><app-icon [name]="w.icon" [size]="14" /></span>
                {{ w.label }} {{ w.min }}–{{ w.max }}°C
              </span>
            }
            <span
              class="flex items-center gap-[5px] rounded-full border border-border bg-[#FAF7EF] px-[11px] py-1.5 text-[12.5px] font-semibold text-muted"
            >
              <app-icon name="pin" [size]="14" /> {{ stops().length }} 站
            </span>
            @if (travelTotal()) {
              <span
                class="flex items-center gap-[5px] rounded-full border border-border bg-[#FAF7EF] px-[11px] py-1.5 text-[12.5px] font-semibold text-muted"
              >
                <app-icon name="footprints" [size]="14" /> 交通約 {{ dur(travelTotal()) }}
              </span>
            }
          </div>
        </section>
      </div>
    </div>

    <div class="mx-auto flex max-w-7xl flex-col gap-4 px-5 pb-6 pt-[18px] md:px-8 md:pt-6">
      <!-- 時間軸 -->
      <div class="flex flex-col">
        @for (it of stops(); track it.id; let i = $index; let last = $last) {
          @if (i > 0) {
            <div class="flex gap-3.5">
              <div class="flex w-10 shrink-0 justify-center">
                <div class="w-0.5 bg-border-strong"></div>
              </div>
              <button
                type="button"
                class="flex min-w-0 items-center gap-2 py-3 text-left text-[13.5px] font-medium text-muted"
                (click)="openTransport(it)"
              >
                @if (it.travelMode || it.travelMin) {
                  <app-icon [name]="modeIcon(it.travelMode)" [size]="16" />
                  <span
                    >{{ modeLabel(it.travelMode, it.travelLabel) }} → {{ it.title }}
                    @if (it.travelMin) {
                      · 約 {{ dur(it.travelMin) }}
                    }
                  </span>
                } @else {
                  <app-icon name="plus" [size]="14" /><span>加交通</span>
                }
              </button>
              @if (legUrl(i); as url) {
                <a
                  class="my-auto ml-auto flex shrink-0 items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-navy-2"
                  [href]="url"
                  target="_blank"
                  rel="noopener"
                  ><app-icon name="navigation" [size]="13" /> 查路線</a
                >
              }
            </div>
          }
          <div class="flex gap-3.5">
            <div class="flex w-10 shrink-0 flex-col items-center pt-0.5">
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-full"
                [style.background]="meta(it.type).bg"
                [style.color]="meta(it.type).fg"
              >
                <app-icon [name]="meta(it.type).icon" [size]="20" />
              </div>
              @if (!last) {
                <div class="w-0.5 flex-1 bg-border-strong"></div>
              }
            </div>
            <div class="min-w-0 flex-1 pb-1">
              <article
                class="relative flex flex-col gap-[7px] rounded-[14px] border bg-white p-4"
                [class]="
                  (isOpen(it.id) ? 'border-orange' : 'border-border') +
                  (expandable(it) ? ' cursor-pointer' : '')
                "
                [attr.role]="expandable(it) ? 'button' : null"
                [attr.tabindex]="expandable(it) ? 0 : null"
                [attr.aria-expanded]="expandable(it) ? isOpen(it.id) : null"
                (click)="toggleCard(it)"
                (keydown.enter)="toggleCard(it)"
              >
                <div class="flex items-center gap-2 md:absolute md:right-4 md:top-4">
                  <span
                    class="rounded-md px-2 py-[3px] text-xs font-bold md:hidden"
                    [style.background]="meta(it.type).bg2"
                    [style.color]="meta(it.type).fg2"
                    >{{ meta(it.type).label }}</span
                  >
                  @if (it.time) {
                    <span class="text-[13px] font-semibold text-navy-2 md:hidden">{{
                      it.time
                    }}</span>
                  } @else if (eta(it)) {
                    <span class="text-[13px] font-semibold text-orange md:hidden">預計 {{ eta(it) }}</span>
                  }
                  <span class="flex-1 md:hidden"></span>
                  @if (it.stay) {
                    <span
                      class="mono hidden rounded-full bg-sand px-3 py-1 text-[13px] font-bold text-navy md:inline-flex"
                      >{{ stayShort(it.stay) }}</span
                    >
                  }
                  @if (expandable(it)) {
                    <span class="text-faint"
                      ><app-icon [name]="isOpen(it.id) ? 'chevron-up' : 'chevron-down'" [size]="18"
                    /></span>
                  }
                  <button
                    type="button"
                    class="-mr-1 rounded p-0.5 text-faint"
                    (click)="$event.stopPropagation(); openMenu($event, it, i)"
                    aria-label="更多"
                  >
                    <app-icon name="more" [size]="18" />
                  </button>
                </div>
                <p class="hidden items-center gap-2 text-xs font-medium text-faint md:flex">
                  {{ meta(it.type).label }}
                  @if (range(it)) {
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-semibold"
                      [class]="it.time ? 'bg-[#E7E2D2] text-navy-2' : 'bg-orange-soft text-orange'"
                      >{{ range(it) }}</span
                    >
                  }
                </p>
                <h3 class="break-words text-[17px] font-bold leading-snug md:pr-24">
                  {{ it.title }}
                </h3>
                @for (line of lines(it); track $index) {
                  <p
                    class="break-words text-[13.5px] font-medium leading-snug text-muted"
                    [class]="line.endsWith(' 抵達') || line.startsWith('預計停留') ? 'md:hidden' : ''"
                  >
                    {{ line }}
                  </p>
                }

                @if (isOpen(it.id)) {
                  <div
                    class="mt-1 flex flex-col border-t border-border pt-1"
                    (click)="$event.stopPropagation()"
                  >
                    @if (it.photos?.length) {
                      <div class="flex gap-2 overflow-x-auto pb-1 pt-1">
                        @for (u of it.photos; track u) {
                          <img [src]="u" alt="" loading="lazy" referrerpolicy="no-referrer"
                            class="h-28 w-40 shrink-0 rounded-lg bg-border object-cover"
                            (error)="hideImg($event)" />
                        }
                      </div>
                    }
                    @for (r of detailRows(it); track $index) {
                      <div class="flex items-start gap-2.5 py-2 text-[14px] leading-snug">
                        <span
                          class="mt-0.5 shrink-0"
                          [class]="r.kind === 'sub' ? 'text-orange' : 'text-muted'"
                          ><app-icon [name]="r.icon" [size]="17"
                        /></span>
                        <span class="min-w-0 flex-1 break-words">
                          <span [class.font-semibold]="r.kind === 'sub'">{{ r.title }}</span>
                          @if (r.sub) {
                            <span class="block text-[13px] text-muted">{{ r.sub }}</span>
                          }
                          @if (r.photo) {
                            <img [src]="r.photo" alt="" loading="lazy" referrerpolicy="no-referrer"
                              class="mt-1.5 h-24 w-36 rounded-lg bg-border object-cover"
                              (error)="hideImg($event)" />
                          }
                        </span>
                        <button
                          type="button"
                          class="-mr-1 shrink-0 rounded p-0.5 text-faint hover:text-navy"
                          (click)="openRowMenu($event, it, r)"
                          aria-label="更多"
                        >
                          <app-icon name="more" [size]="17" />
                        </button>
                      </div>
                    }
                    <button
                      type="button"
                      class="flex items-center gap-2.5 py-2 text-left text-[14px] text-faint"
                      (click)="openRowNew(it)"
                    >
                      <app-icon name="plus" [size]="17" /> 新增一行…
                    </button>
                  </div>
                }
              </article>
            </div>
          </div>
        }
      </div>

      @if (!stops().length) {
        <p class="rounded-[14px] border border-border bg-white p-4 text-sm text-muted">
          這一天還沒有行程。
        </p>
      }
    </div>

    <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />

    <!-- 手機：右下角浮動按鈕（大：新增一站；小：從備選加入） -->
    <div
      class="fixed right-5 z-20 flex flex-col items-center gap-3 md:hidden"
      style="bottom: calc(env(safe-area-inset-bottom) + 88px)"
    >
      @if (poolCount()) {
        <button
          type="button"
          class="relative flex size-11 items-center justify-center rounded-full border border-border-strong bg-white text-navy shadow-[0_6px_16px_-4px_rgba(32,44,57,0.25)]"
          (click)="justAdded.set(''); poolOpen.set(true)"
          [attr.aria-label]="'從備選加入（' + poolCount() + '）'"
        >
          <app-icon name="star" [size]="20" />
          <span
            class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-navy px-1 text-[11px] font-bold leading-none text-white"
            >{{ poolCount() }}</span
          >
        </button>
      }
      <button
        type="button"
        class="flex size-14 items-center justify-center rounded-full bg-orange text-white shadow-[0_8px_20px_-4px_rgba(242,149,89,0.6)]"
        (click)="openNew()"
        aria-label="新增一站"
      >
        <app-icon name="plus" [size]="26" />
      </button>
    </div>

    <!-- 備選：挑一個加入目前這一天 -->
    <p-dialog
      [visible]="poolOpen()"
      (visibleChange)="!$event && poolOpen.set(false)"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      header="備選景點"
      [style]="{ width: 'min(32rem, 94vw)' }"
    >
      @for (it of poolItems(); track it.id) {
        <div class="flex items-center gap-3 border-b border-border py-3 last:border-0">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-full"
            [style.background]="meta(it.type).bg"
            [style.color]="meta(it.type).fg"
            ><app-icon [name]="meta(it.type).icon" [size]="18"
          /></span>
          <div class="min-w-0 flex-1">
            <p class="break-words text-[14.5px] font-semibold leading-snug">{{ it.title }}</p>
            @if (poolHint(it)) {
              <p class="break-words text-xs text-muted">{{ poolHint(it) }}</p>
            }
          </div>
          <button pButton type="button" size="small" class="shrink-0" (click)="addToDay(it)">
            加入 {{ dayInfo().md }}
          </button>
          <button
            type="button"
            class="shrink-0 rounded p-0.5 text-faint"
            (click)="openPoolMenu($event, it)"
            aria-label="更多"
          >
            <app-icon name="more" [size]="18" />
          </button>
        </div>
      } @empty {
        <p class="py-6 text-center text-sm text-muted">
          備選清單是空的。把排不下的點用卡片右上角選單的「移到備選」放進來。
        </p>
      }
      @if (justAdded()) {
        <p class="mt-2 text-[13px] font-medium text-success">已加入：{{ justAdded() }}</p>
      }
    </p-dialog>

    <!-- 展開區塊：新增/編輯一行 -->
    <p-dialog
      [visible]="rowDlg() !== null"
      (visibleChange)="!$event && rowDlg.set(null)"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [header]="rowDlg()?.idx == null ? '新增一行' : '編輯'"
      [style]="{ width: 'min(30rem, 94vw)' }"
    >
      <div class="flex flex-col gap-3.5">
        <div class="field">
          類型
          <p-select
            [options]="rowKinds"
            optionLabel="label"
            optionValue="value"
            [(ngModel)]="rowDraft.kind"
            [disabled]="rowDlg()?.idx != null"
            appendTo="body"
            class="w-full"
          />
        </div>
        @if (rowDraft.kind === 'sub') {
          <label class="field"
            >店名/選項名稱<input
              pInputText
              class="w-full"
              [(ngModel)]="rowDraft.text"
              placeholder="例如：祥興咖啡室"
          /></label>
          <label class="field"
            >營業時間（選填）<input
              pInputText
              class="w-full"
              [(ngModel)]="rowDraft.text2"
              placeholder="例如 07:00–17:00"
          /></label>
          <label class="field"
            >備註（選填）<input pInputText class="w-full" [(ngModel)]="rowDraft.text3"
          /></label>
        } @else if (rowDraft.kind === 'note') {
          <label class="field"
            >備註<textarea
              pTextarea
              rows="3"
              class="w-full"
              [(ngModel)]="rowDraft.text"
              placeholder="例如：建議先打電話訂位"
            ></textarea>
          </label>
        } @else {
          <label class="field"
            >{{ rowDraft.kind === 'hours' ? '營業時間' : '地址'
            }}<input
              pInputText
              class="w-full"
              [(ngModel)]="rowDraft.text"
              [placeholder]="rowDraft.kind === 'hours' ? '例如 07:00–22:00' : ''"
          /></label>
          @if (rowDlg()?.idx == null && rowExists()) {
            <p class="text-xs text-faint">
              這一站已經有{{
                rowDraft.kind === 'hours' ? '營業時間' : '地址'
              }}，儲存會取代原本的內容。
            </p>
          }
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
          <button pButton type="button" [disabled]="!rowDraft.text.trim()" (click)="saveRow()">
            儲存
          </button>
        </div>
      </ng-template>
    </p-dialog>

    <!-- 交通：從上一站過來 -->
    <p-dialog
      [visible]="transportId() !== null"
      (visibleChange)="!$event && transportId.set(null)"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      header="從上一站過來的交通"
      [style]="{ width: 'min(28rem, 94vw)' }"
    >
      <div class="grid grid-cols-2 gap-3">
        <div class="field">
          交通方式
          <p-select
            [options]="modeList"
            optionLabel="label"
            optionValue="id"
            [(ngModel)]="tDraft.mode"
            placeholder="選擇"
            [showClear]="true"
            appendTo="body"
            class="w-full"
          />
        </div>
        <label class="field"
          >時間（分鐘）<input
            pInputText
            type="number"
            inputmode="numeric"
            min="0"
            class="w-full"
            [(ngModel)]="tDraft.min"
            placeholder="例如 20"
        /></label>
      </div>
      @if (tDraft.mode === 'other') {
        <label class="field mt-3"
          >交通方式名稱<input
            pInputText
            class="w-full"
            [(ngModel)]="tDraft.label"
            placeholder="例如：包車、山頂纜車、天星小輪"
        /></label>
      }
      <ng-template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            (click)="transportId.set(null)"
          >
            取消
          </button>
          <button pButton type="button" (click)="saveTransport()">儲存</button>
        </div>
      </ng-template>
    </p-dialog>

    <!-- 新增/編輯 -->
    <p-dialog
      [visible]="editing() !== null"
      (visibleChange)="!$event && editing.set(null)"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      [header]="editing() === 'new' ? '新增一站' : '編輯站點'"
      [style]="{ width: 'min(34rem, 94vw)' }"
    >
      <div class="flex flex-col gap-3.5">
        <label class="field"
          >名稱<input pInputText class="w-full" [(ngModel)]="draft.title" placeholder="景點或店名"
        /></label>
        <div class="grid grid-cols-2 gap-3">
          <div class="field">
            類型
            <p-select
              [options]="typeList"
              optionLabel="label"
              optionValue="id"
              [(ngModel)]="draft.type"
              appendTo="body"
              class="w-full"
            />
          </div>
          <div class="field">
            日期
            <p-select
              [options]="dayOptions"
              optionLabel="short"
              optionValue="date"
              [(ngModel)]="draft.day"
              appendTo="body"
              class="w-full"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="field">
            {{ draft.type === 'flight' ? '起飛時間' : '時間' }}
            <p-inputmask
              mask="99:99"
              [(ngModel)]="draft.time"
              placeholder="hh:mm"
              [autoClear]="true"
              inputmode="numeric"
              styleClass="w-full"
            />
          </div>
          @if (draft.type === 'flight') {
            <div class="field">
              抵達時間
              <p-inputmask
                mask="99:99"
                [(ngModel)]="draft.endTime"
                placeholder="hh:mm"
                [autoClear]="true"
                inputmode="numeric"
                styleClass="w-full"
              />
            </div>
          } @else {
            <label class="field"
              >停留（分鐘）<input
                pInputText
                type="number"
                inputmode="numeric"
                min="0"
                class="w-full"
                [(ngModel)]="draft.stay"
                placeholder="例如 90"
            /></label>
          }
        </div>
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
export class ItineraryTab {
  private svc = inject(TripService);
  private confirm = inject(ConfirmationService);
  readonly days = DAYS;
  readonly dayOptions = DAYS;
  readonly pillDays = DAYS.filter((d) => d.date !== 'pool');
  /** 各日期的天氣預報（Open-Meteo）；抓不到就是空的，畫面不顯示 */
  readonly weather = signal<Record<string, { code: number; min: number; max: number } | undefined>>(
    {},
  );
  readonly typeList = (Object.keys(TYPES) as StopType[]).map((id) => ({
    id,
    label: TYPES[id].label,
  }));
  readonly modeList = (Object.keys(MODES) as Exclude<TravelMode, ''>[]).map((id) => ({
    id,
    label: MODES[id].label,
  }));

  readonly day = signal(this.initialDay());
  /** null＝關閉；'new'＝新增；其他＝正在編輯的站點 id */
  readonly editing = signal<string | null>(null);
  private readonly opened = signal<Record<string, boolean | undefined>>({});
  draft: Draft = this.blank(DAYS[0].date);

  readonly stops = computed(() =>
    this.svc
      .items()
      .filter((i) => i.day === this.day())
      .sort((a, b) => a.order - b.order),
  );
  readonly poolCount = computed(() => this.svc.items().filter((i) => i.day === 'pool').length);
  readonly dayInfo = computed(() => this.days.find((d) => d.date === this.day()) ?? this.days[0]);
  readonly travelTotal = computed(() =>
    this.stops()
      .slice(1)
      .reduce((n, x) => n + (x.travelMin || 0), 0),
  );
  readonly menu = viewChild.required<Menu>('menu');
  readonly menuItems = signal<MenuItem[]>([]);
  readonly poolOpen = signal(false);
  readonly justAdded = signal('');
  /** 這一站在 Google Maps 上要搜尋的地點；不是地點的站（搭電車、沒有地址的早餐/整理行李）回傳空字串 */
  private placeQuery(it: Item): string {
    if (it.type === 'flight') return '香港國際機場';
    if (it.type === 'transit') return '';
    const addr = it.address?.trim();
    if (addr) return addr;
    if (/早餐|午餐|整理/.test(it.title)) return '';
    const first = it.subs[0]?.note ?? '';
    return /[街道路號]/.test(first) ? first : this.placeName(it.title) + ' 香港';
  }
  /** 當天路線總覽：依序帶入當天各站。Google Maps 的大眾運輸模式不支援多個途經點，所以這個只當地圖總覽，搭車資訊請用每段交通旁的「查路線」。 */
  readonly routeUrl = computed(() => {
    const places: string[] = [];
    for (const it of this.stops()) {
      const q = this.placeQuery(it);
      if (q && places[places.length - 1] !== q) places.push(q);
    }
    if (places.length < 2) return '';
    const used = places.slice(0, 11); // 起點 + 最多 9 個途經點 + 終點
    const enc = encodeURIComponent;
    const mids = used.slice(1, -1).map(enc).join('%7C');
    return 'https://www.google.com/maps/dir/?api=1'
      + `&origin=${enc(used[0])}&destination=${enc(used[used.length - 1])}` + (mids ? `&waypoints=${mids}` : '');
  });
  /** 兩站之間的大眾運輸路線（只帶起點與終點，Google Maps 才會顯示搭車資訊） */
  legUrl(i: number): string {
    const list = this.stops();
    const from = list[i - 1] && this.placeQuery(list[i - 1]);
    const to = list[i] && this.placeQuery(list[i]);
    if (!from || !to || from === to) return '';
    return `https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`;
  }
  /** 站名去掉括號說明，並取斜線前的第一個選項，方便 Google Maps 搜尋 */
  private placeName(title: string) {
    return title.replace(/（[^）]*）|\([^)]*\)/g, '').split('/')[0].trim();
  }
  readonly poolItems = computed(() =>
    this.svc
      .items()
      .filter((i) => i.day === 'pool')
      .sort((a, b) => a.order - b.order),
  );

  constructor() {
    void this.loadWeather();
  }

  private async loadWeather() {
    const dates = DAYS.filter((d) => d.date !== 'pool').map((d) => d.date);
    try {
      // 只送出香港座標與日期區間，不含任何個人資料。距離出發超過約 16 天時，服務不會回傳預報。
      const url =
        'https://api.open-meteo.com/v1/forecast?latitude=22.3193&longitude=114.1694' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FHong_Kong' +
        `&start_date=${dates[0]}&end_date=${dates[dates.length - 1]}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const j = (await res.json()) as {
        daily?: {
          time: string[];
          weather_code: (number | null)[];
          temperature_2m_max: (number | null)[];
          temperature_2m_min: (number | null)[];
        };
      };
      const d = j.daily;
      if (!d) return;
      const out: Record<string, { code: number; min: number; max: number }> = {};
      d.time.forEach((t, i) => {
        const code = d.weather_code[i],
          max = d.temperature_2m_max[i],
          min = d.temperature_2m_min[i];
        if (code != null && max != null && min != null)
          out[t] = { code, max: Math.round(max), min: Math.round(min) };
      });
      this.weather.set(out);
    } catch {
      /* 沒網路或服務失敗：不顯示天氣 */
    }
  }
  weatherOf(date: string) {
    const w = this.weather()[date];
    if (!w) return null;
    const c = w.code;
    const [label, icon] =
      c === 0
        ? ['晴', 'sun']
        : c <= 2
          ? ['晴時多雲', 'weather']
          : c === 3
            ? ['陰', 'cloud']
            : c <= 48
              ? ['有霧', 'fog']
              : c <= 67
                ? ['雨', 'rain']
                : c <= 77
                  ? ['雪', 'snow']
                  : c <= 82
                    ? ['陣雨', 'rain']
                    : ['雷雨', 'storm'];
    return { label, icon, min: w.min, max: w.max };
  }

  private initialDay() {
    const today = new Date().toISOString().slice(0, 10);
    return DAYS.some((d) => d.date === today) ? today : DAYS[0].date;
  }
  private blank(day: string): Draft {
    return {
      type: 'place',
      title: '',
      time: '',
      endTime: '',
      stay: null,
      hours: '',
      address: '',
      note: '',
      day,
      travelMode: '',
      travelMin: null,
      subs: [],
    };
  }

  idx(it: Item) {
    return this.stops().findIndex((x) => x.id === it.id);
  }
  meta(t: StopType) {
    return TYPES[t] ?? TYPES.other;
  }
  modeIcon(m: TravelMode) {
    return m ? MODES[m].icon : 'navigation';
  }
  modeLabel(m: TravelMode, custom?: string) {
    return m === 'other' ? custom?.trim() || '其他' : m ? MODES[m].label : '交通';
  }
  dur(min: number) {
    return min >= 60
      ? `${Math.floor(min / 60)} 小時${min % 60 ? ' ' + (min % 60) + ' 分' : ''}`
      : `${min} 分`;
  }
  stayShort(min: number) {
    return min < 60 ? `${min}m` : `${String(+(min / 60).toFixed(1))}h`;
  }
  /** 08:15 — 08:45；沒填結束時間就用「時間＋停留」推算 */
  /** 當天各站的預計抵達（分鐘數）。有填時間的站以你填的為準；沒填的 ＝ 上一站離開時間 ＋ 這一站的交通時間。 */
  readonly etas = computed(() => {
    const out = new Map<string, number>();
    const parse = (v: string) => (/^\d{1,2}:\d{2}$/.test(v ?? '') ? Number(v.split(':')[0]) * 60 + Number(v.split(':')[1]) : null);
    let prevDep: number | null = null;
    for (const it of this.stops()) {
      const own = parse(it.time);
      const arrival: number | null = own ?? (prevDep != null ? prevDep + (it.travelMin || 0) : null);
      if (own == null && arrival != null) out.set(it.id, arrival);
      // 離開時間：有結束/抵達時間（航班）就用它；否則 抵達 ＋ 停留
      const end = parse(it.endTime);
      // 抵達香港的班機：落地後還要入境、領行李，約 1 小時後才踏出機場
      const exitAirport = it.type === 'flight' && it.title.includes('→ 香港') && end != null ? end + 60 : null;
      prevDep = arrival == null ? null : exitAirport ?? end ?? arrival + (it.stay || 0);
    }
    return out;
  });
  private fmtMin(min: number) {
    const t = ((min % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }
  /** 沒填時間的站，算出來的預計抵達（HH:mm），算不出來就是空字串 */
  eta(it: Item) { const m = this.etas().get(it.id); return m == null ? '' : this.fmtMin(m); }
  /** 08:15 — 08:45；沒填時間就用預計抵達，並加「預計」；沒填結束時間就用「開始 ＋ 停留」推算 */
  range(it: Item) {
    const est = !it.time;
    const start = it.time || this.eta(it);
    if (!start) return '';
    let end = it.endTime;
    if (!end && it.stay) {
      const [h, m] = start.split(':').map(Number);
      end = this.fmtMin(h * 60 + m + it.stay);
    }
    return (est ? '預計 ' : '') + (end ? `${start} — ${end}` : start);
  }
  mapUrl(it: Item) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.address || `${it.title} 香港`)}`;
  }
  /** 卡片收合時顯示的摘要行（地址、抵達、營業時間、停留、選項數）；備註只在展開時顯示 */
  lines(it: Item): string[] {
    const out: string[] = [];
    if (it.type === 'hotel' && it.address) out.push(it.address);
    if (it.type === 'hotel') {
      const f = (it.note || '').split('\n')[0].trim();
      if (f.includes('·')) out.push(f);
    }
    if (it.type === 'flight' && it.endTime) out.push(`${it.endTime} 抵達`);
    if (it.hours) out.push(`營業時間 ${it.hours}`);
    if (it.stay) out.push(`預計停留 ${this.dur(it.stay)}`);
    if (it.subs.length) out.push(`${it.subs.length} 個選項`);
    // 展開後，營業時間、地址、備註、店家都在下方各自一行，摘要只留抵達與停留
    return this.isOpen(it.id)
      ? out.filter((l) => l.endsWith(' 抵達') || l.startsWith('預計停留'))
      : out;
  }
  /** 展開後的備註列：每一行一列；住宿的第一行（房型/日期）已顯示在摘要，不重複 */
  noteRows(it: Item): string[] {
    const rows = (it.note || '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    return it.type === 'hotel' && rows[0]?.includes('·') ? rows.slice(1) : rows;
  }
  expandable(_it: Item) {
    return true;
  }
  openMenu(ev: Event, it: Item, i: number) {
    this.menuItems.set([
      { label: '編輯', icon: 'pi pi-pencil', command: () => this.openEdit(it) },
      { label: '開啟地圖', icon: 'pi pi-map', url: this.mapUrl(it), target: '_blank' },
      {
        label: '上移',
        icon: 'pi pi-arrow-up',
        disabled: i === 0,
        command: () => void this.move(it, -1),
      },
      {
        label: '下移',
        icon: 'pi pi-arrow-down',
        disabled: i === this.stops().length - 1,
        command: () => void this.move(it, 1),
      },
      { separator: true },
      ...this.moveItems(it),
      { separator: true },
      {
        label: '刪除',
        icon: 'pi pi-trash',
        styleClass: 'hk-danger',
        command: () => this.remove(it),
      },
    ]);
    this.menu().toggle(ev);
  }
  poolHint(it: Item) {
    if (it.hours) return `營業時間 ${it.hours}`;
    if (it.address) return it.address;
    const n = (it.note || '').split('\n')[0].trim();
    return n.length > 40 ? n.slice(0, 40) + '…' : n;
  }
  /** 備選 → 目前這一天（排在最後面） */
  async addToDay(it: Item) {
    await this.svc.save('items', { ...it, day: this.day(), order: Date.now() });
    this.justAdded.set(it.title);
  }
  /** 搬到另一天或備選，排在該處最後面 */
  moveTo(it: Item, day: string) {
    return this.svc.save('items', { ...it, day, order: Date.now() });
  }
  /** 「移到」選項（平面項目，不能用群組：PrimeNG 選單一有群組，其他項目都會被當成標題而不能點） */
  private moveItems(it: Item): MenuItem[] {
    return [
      ...DAYS.filter((d) => d.date !== it.day && d.date !== 'pool').map((d) => ({
        label: `移到 ${d.md}${d.wk}`,
        icon: 'pi pi-arrow-right',
        command: () => void this.moveTo(it, d.date),
      })),
      ...(it.day !== 'pool' ? [{ label: '移到 備選', icon: 'pi pi-star', command: () => void this.moveTo(it, 'pool') }] : []),
    ];
  }
  openPoolMenu(ev: Event, it: Item) {
    this.menuItems.set([
      { label: '編輯', icon: 'pi pi-pencil', command: () => this.openEdit(it) },
      { label: '開啟地圖', icon: 'pi pi-map', url: this.mapUrl(it), target: '_blank' },
      { separator: true },
      ...this.moveItems(it),
      { separator: true },
      { label: '刪除', icon: 'pi pi-trash', styleClass: 'hk-danger', command: () => this.remove(it) },
    ]);
    this.menu().toggle(ev);
  }

  // ---- 展開區塊的「一行」：營業時間、地址、備註、店家 ----
  readonly rowKinds = [
    { label: '備註/其他', value: 'note' },
    { label: '營業時間', value: 'hours' },
    { label: '地址', value: 'address' },
    { label: '店家/選項', value: 'sub' },
  ];
  readonly rowDlg = signal<{ itemId: string; idx: number | null } | null>(null);
  rowDraft = {
    kind: 'note' as 'note' | 'hours' | 'address' | 'sub',
    text: '',
    text2: '',
    text3: '',
  };
  readonly transportId = signal<string | null>(null);
  tDraft = { mode: '' as TravelMode, min: null as number | null, label: '' };

  /** 外部圖片載入失敗（連結失效或被擋）就隱藏，不留破圖 */
  hideImg(e: Event) {
    (e.target as HTMLElement).style.display = 'none';
  }

  /** 展開後要顯示的每一行，每行都可以單獨編輯、刪除 */
  detailRows(
    it: Item,
  ): {
    kind: 'note' | 'hours' | 'address' | 'sub';
    idx: number | null;
    icon: string;
    title: string;
    sub: string;
    photo?: string;
  }[] {
    const rows: {
      kind: 'note' | 'hours' | 'address' | 'sub';
      idx: number | null;
      icon: string;
      title: string;
      sub: string;
      photo?: string;
    }[] = [];
    if (it.hours)
      rows.push({
        kind: 'hours',
        idx: null,
        icon: 'clock',
        title: `營業時間 ${it.hours}`,
        sub: '',
      });
    if (it.address)
      rows.push({ kind: 'address', idx: null, icon: 'pin', title: it.address, sub: '' });
    this.noteLines(it).forEach((n, i) =>
      rows.push({ kind: 'note', idx: i, icon: 'info', title: n, sub: '' }),
    );
    it.subs.forEach((x, i) =>
      rows.push({
        kind: 'sub',
        idx: i,
        icon: 'food',
        title: x.name,
        sub: [x.hours, x.note].filter(Boolean).join(' · '),
        photo: x.photo,
      }),
    );
    return rows;
  }
  private noteLines(it: Item) {
    return (it.note || '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  rowExists() {
    const d = this.rowDlg();
    const it = d && this.svc.items().find((x) => x.id === d.itemId);
    return (
      !!it &&
      ((this.rowDraft.kind === 'hours' && !!it.hours) ||
        (this.rowDraft.kind === 'address' && !!it.address))
    );
  }
  openRowNew(it: Item) {
    this.rowDraft = { kind: 'note', text: '', text2: '', text3: '' };
    this.rowDlg.set({ itemId: it.id, idx: null });
  }
  openRowEdit(it: Item, r: { kind: 'note' | 'hours' | 'address' | 'sub'; idx: number | null }) {
    if (r.kind === 'sub') {
      const x = it.subs[r.idx!];
      this.rowDraft = { kind: 'sub', text: x.name, text2: x.hours, text3: x.note };
    } else if (r.kind === 'note')
      this.rowDraft = { kind: 'note', text: this.noteLines(it)[r.idx!], text2: '', text3: '' };
    else
      this.rowDraft = {
        kind: r.kind,
        text: r.kind === 'hours' ? it.hours : it.address,
        text2: '',
        text3: '',
      };
    this.rowDlg.set({ itemId: it.id, idx: r.kind === 'hours' || r.kind === 'address' ? 0 : r.idx });
  }
  async saveRow() {
    const d = this.rowDlg();
    const it = d && this.svc.items().find((x) => x.id === d.itemId);
    const text = this.rowDraft.text.trim();
    if (!d || !it || !text) return;
    const next: Item = { ...it, subs: it.subs.map((x) => ({ ...x })) };
    const k = this.rowDraft.kind;
    if (k === 'hours') next.hours = text;
    else if (k === 'address') next.address = text;
    else if (k === 'note') {
      const lines = this.noteLines(it);
      if (d.idx == null) lines.push(text);
      else lines[d.idx] = text;
      next.note = lines.join('\n');
    } else {
      const sub = {
        name: text,
        hours: this.rowDraft.text2.trim(),
        note: this.rowDraft.text3.trim(),
        done: false,
      };
      if (d.idx == null) next.subs.push(sub);
      else next.subs[d.idx] = { ...next.subs[d.idx], ...sub };
    }
    await this.svc.save('items', { ...next });
    this.rowDlg.set(null);
    this.setOpen(it.id, true);
  }
  openRowMenu(
    ev: Event,
    it: Item,
    r: { kind: 'note' | 'hours' | 'address' | 'sub'; idx: number | null; title: string },
  ) {
    ev.stopPropagation();
    this.menuItems.set([
      { label: '編輯', icon: 'pi pi-pencil', command: () => this.openRowEdit(it, r) },
      { separator: true },
      {
        label: '刪除',
        icon: 'pi pi-trash',
        styleClass: 'hk-danger',
        command: () => this.removeRow(it, r),
      },
    ]);
    this.menu().toggle(ev);
  }
  removeRow(
    it: Item,
    r: { kind: 'note' | 'hours' | 'address' | 'sub'; idx: number | null; title: string },
  ) {
    this.confirm.confirm({
      header: '刪除這一行',
      message: `刪除「${r.title}」？`,
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: async () => {
        const cur = this.svc.items().find((x) => x.id === it.id);
        if (!cur) return;
        const next: Item = { ...cur, subs: [...cur.subs] };
        if (r.kind === 'hours') next.hours = '';
        else if (r.kind === 'address') next.address = '';
        else if (r.kind === 'note')
          next.note = this.noteLines(cur)
            .filter((_, i) => i !== r.idx)
            .join('\n');
        else next.subs.splice(r.idx!, 1);
        await this.svc.save('items', { ...next });
      },
    });
  }

  // ---- 交通 ----
  openTransport(it: Item) {
    this.tDraft = {
      mode: it.travelMode ?? '',
      min: it.travelMin || null,
      label: it.travelLabel ?? '',
    };
    this.transportId.set(it.id);
  }
  async saveTransport() {
    const it = this.svc.items().find((x) => x.id === this.transportId());
    if (!it) return;
    await this.svc.save('items', {
      ...it,
      travelMode: this.tDraft.mode ?? '',
      travelMin: Number(this.tDraft.min) || 0,
      travelLabel: this.tDraft.mode === 'other' ? this.tDraft.label.trim() : '',
    });
    this.transportId.set(null);
  }
  toggleCard(it: Item) {
    if (this.expandable(it)) this.setOpen(it.id, !this.isOpen(it.id));
  }
  isOpen(id: string) {
    return !!this.opened()[id];
  }
  setOpen(id: string, open: boolean) {
    this.opened.update((m) => ({ ...m, [id]: open }));
  }

  openNew() {
    this.draft = this.blank(this.day());
    this.editing.set('new');
  }
  openEdit(it: Item) {
    this.draft = {
      type: it.type,
      title: it.title,
      time: it.time,
      endTime: it.endTime,
      stay: it.stay || null,
      hours: it.hours,
      address: it.address,
      note: it.note,
      day: it.day,
      travelMode: it.travelMode ?? '',
      travelMin: it.travelMin || null,
      subs: it.subs.map((s) => ({ ...s })),
    };
    this.editing.set(it.id);
  }
  /** 時間欄位只接受 24 小時制 hh:mm，其餘當作沒填 */
  private hhmm(v: string) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(v ?? '') ? v : '';
  }
  async save() {
    const d = this.draft;
    const id = this.editing();
    if (!d.title.trim() || !id) return;
    const fields = {
      type: d.type,
      title: d.title.trim(),
      time: this.hhmm(d.time),
      // 非航班：有填停留分鐘就用「時間＋停留」推算結束，清掉舊的結束時間避免兩者衝突
      endTime:
        d.type === 'flight' ? this.hhmm(d.endTime) : Number(d.stay) > 0 ? '' : this.hhmm(d.endTime),
      stay: d.type === 'flight' ? 0 : Number(d.stay) || 0,
      hours: d.hours.trim(),
      address: d.address.trim(),
      note: d.note,
      day: d.day,
      travelMode: d.travelMode ?? '',
      travelMin: Number(d.travelMin) || 0,
      subs: d.subs.filter((s) => s.name.trim()).map((s) => ({ ...s, name: s.name.trim() })),
    };
    if (id === 'new') {
      await this.svc.save('items', { ...fields, done: false, order: Date.now() });
    } else {
      const it = this.svc.items().find((x) => x.id === id);
      if (!it) return;
      await this.svc.save('items', {
        ...it,
        ...fields,
        order: d.day !== it.day ? Date.now() : it.order,
      });
    }
    this.editing.set(null);
    this.day.set(d.day);
  }
  remove(target?: Item) {
    const it = target ?? this.svc.items().find((x) => x.id === this.editing());
    if (!it) return;
    this.confirm.confirm({
      header: '刪除站點',
      message: `刪除「${it.title}」？`,
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: async () => {
        await this.svc.remove('items', it.id);
        if (this.editing() === it.id) this.editing.set(null);
      },
    });
  }
  async move(it: Item, dir: -1 | 1) {
    const list = this.stops();
    const other = list[list.findIndex((x) => x.id === it.id) + dir];
    if (!other) return;
    await Promise.all([
      this.svc.save('items', { ...it, order: other.order }),
      this.svc.save('items', { ...other, order: it.order }),
    ]);
  }
}
