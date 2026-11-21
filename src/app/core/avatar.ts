import { Component, computed, inject, input } from '@angular/core';
import { TripService } from './trip.service';

const TONES = [
  { bg: '#F29559', fg: '#FFFFFF' },
  { bg: '#36475A', fg: '#F5F1E7' },
  { bg: '#B8B08D', fg: '#202C39' },
  { bg: '#F2D492', fg: '#202C39' },
  { bg: '#5B8C6E', fg: '#FFFFFF' },
];

/** 成員頭像：取名字第一個字，顏色依成員在清單中的順序固定。 */
@Component({
  selector: 'app-avatar',
  template: `<span class="inline-flex box-border items-center justify-center rounded-full font-bold"
    [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.4"
    [style.background]="tone().bg" [style.box-shadow]="ring() ? '0 0 0 2px ' + ring() : null" [style.color]="tone().fg">{{ initial() }}</span>`,
  host: { class: 'inline-flex shrink-0' },
})
export class Avatar {
  private svc = inject(TripService);
  readonly name = input.required<string>();
  readonly size = input(28);
  /** 外框色（頭像重疊時用頁首底色，做出分隔線） */
  readonly ring = input('');
  readonly initial = computed(() => Array.from(this.name())[0] ?? '?');
  readonly tone = computed(() => {
    const i = this.svc.members().indexOf(this.name());
    return TONES[(i < 0 ? 0 : i) % TONES.length];
  });
}
