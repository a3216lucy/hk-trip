import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthShell } from '../core/auth-shell';
import { Icon } from '../core/icon';
import { TripService } from '../core/trip.service';

@Component({
  selector: 'app-lock',
  imports: [FormsModule, MessageModule, PasswordModule, AuthShell, Icon],
  template: `
    <app-auth-shell>
      @if (!svc.configured) {
        <p-message severity="warn">還沒設定 Firebase。請把設定貼到 src/environments/environment.ts，再重新整理。</p-message>
      } @else if (!creating()) {
        <div class="flex flex-col gap-2" (keydown.enter)="enter()">
          <label class="text-[13px] font-semibold text-muted" for="pw">密碼</label>
          <div class="relative">
            <span class="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-faint"><app-icon name="lock" [size]="18" /></span>
            <p-password inputId="pw" [(ngModel)]="password" [feedback]="false" [toggleMask]="true" placeholder="輸入旅程密碼" styleClass="w-full" inputStyleClass="w-full !pl-11" />
          </div>
        </div>
        <button type="button" class="flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-orange text-[16px] font-bold text-white disabled:opacity-50"
          [disabled]="busy() || !password.trim()" (click)="enter()">
          繼續 <app-icon name="arrow-right" [size]="18" />
        </button>
      } @else {
        <div class="flex flex-col gap-3 rounded-2xl bg-[#FAF7EF] p-4">
          <p class="font-semibold">找不到這組密碼。要用它建立新的旅行嗎？</p>
          <p class="text-sm text-muted">建立後會放入初始行程，成員可以進去再新增。</p>
        </div>
        <div class="flex gap-3">
          <button type="button" class="h-[50px] flex-1 rounded-2xl border border-border-strong bg-white text-[15px] font-semibold" (click)="creating.set(false)">重新輸入</button>
          <button type="button" class="h-[50px] flex-1 rounded-2xl bg-orange text-[15px] font-bold text-white disabled:opacity-50" [disabled]="busy()" (click)="create()">建立旅行</button>
        </div>
      }
      @if (error()) { <p-message severity="error">{{ error() }}</p-message> }
    </app-auth-shell>
  `,
})
export class LockPage {
  readonly svc = inject(TripService);
  password = '';
  readonly creating = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async enter() {
    if (!this.password.trim() || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      if ((await this.svc.unlock(this.password)) === 'notfound') this.creating.set(true);
    } catch (e) { this.error.set('連線失敗：' + (e as Error).message); }
    this.busy.set(false);
  }

  async create() {
    this.busy.set(true); this.error.set('');
    try { await this.svc.create(this.password); }
    catch (e) { this.error.set('建立失敗：' + (e as Error).message); }
    this.busy.set(false);
  }
}
