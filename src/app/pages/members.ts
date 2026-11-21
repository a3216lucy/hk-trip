import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { Avatar } from '../core/avatar';
import { AuthShell } from '../core/auth-shell';
import { Icon } from '../core/icon';
import { TripService } from '../core/trip.service';

@Component({
  selector: 'app-members',
  imports: [FormsModule, InputTextModule, MessageModule, AuthShell, Avatar, Icon],
  template: `
    <app-auth-shell>
      <div class="flex items-center gap-3 text-xs text-faint">
        <span class="h-px flex-1 bg-border"></span><span class="font-medium">選擇使用者</span><span class="h-px flex-1 bg-border"></span>
      </div>
      <p class="-mt-2 text-center text-xs text-faint">持有密碼者可選擇現有使用者，或新增一位。</p>

      <div class="flex flex-wrap justify-center gap-3">
        @for (m of svc.members(); track m) {
          <button type="button" class="flex h-24 w-[88px] flex-col items-center justify-center gap-2 rounded-2xl border text-[13px] font-semibold"
            [class]="svc.me() === m ? 'border-2 border-orange bg-orange-soft' : 'border-border bg-[#FAF7EF]'" (click)="pick(m)">
            <app-avatar [name]="m" [size]="40" />
            <span class="max-w-full truncate px-1">{{ m }}</span>
          </button>
        }
        <button type="button" class="flex h-24 w-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-strong bg-white text-xs font-medium text-ink-700"
          [class.border-orange]="adding()" (click)="adding.set(!adding())">
          <app-icon name="user-plus" [size]="22" />
          <span>新增使用者</span>
        </button>
      </div>

      @if (adding() || !svc.members().length) {
        <div class="flex gap-2" (keydown.enter)="add()">
          <input pInputText class="w-full" [(ngModel)]="name" placeholder="輸入你的名字" />
          <button type="button" class="shrink-0 rounded-[14px] bg-orange px-5 text-[15px] font-bold text-white disabled:opacity-50" [disabled]="!name.trim()" (click)="add()">建立</button>
        </div>
      }
      @if (error()) { <p-message severity="error">{{ error() }}</p-message> }

      <div class="flex items-center justify-center gap-5 text-sm text-muted">
        @if (canClose() && svc.me()) { <button type="button" class="underline" (click)="closed.emit()">完成</button> }
        <button type="button" class="flex items-center gap-1.5 underline" (click)="svc.lock()"><app-icon name="logout" [size]="15" /> 登出旅行密碼</button>
      </div>
    </app-auth-shell>
  `,
})
export class MembersPage {
  readonly svc = inject(TripService);
  readonly canClose = input(false);
  readonly closed = output<void>();
  name = '';
  readonly adding = signal(false);
  readonly error = signal('');

  async add() {
    const err = await this.svc.addMember(this.name);
    this.error.set(err ?? '');
    if (!err) {
      const created = this.name.trim();
      this.name = '';
      this.adding.set(false);
      // 第一位成員自動就是自己；之後新增的人，要自己點選才切換
      if (!this.svc.me() && this.svc.members().length === 1) this.svc.setMe(created);
    }
  }
  pick(m: string) { this.svc.setMe(m); this.closed.emit(); }
}
