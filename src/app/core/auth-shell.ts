import { Component } from '@angular/core';
import { Icon } from './icon';

/** 登入流程共用外框：深藍頂欄＋置中白色卡片（密碼頁與選身份頁共用）。 */
@Component({
  selector: 'app-auth-shell',
  imports: [Icon],
  template: `
    <div class="min-h-dvh bg-bg">
      <header class="flex h-14 items-center gap-2.5 bg-navy px-6">
        <span class="text-sand"><app-icon name="plane" [size]="18" /></span>
        <span class="text-[15px] font-bold text-on-dark">香港行</span>
      </header>
      <main class="flex justify-center px-4 py-10 md:py-24">
        <div class="w-full max-w-[460px] rounded-3xl border border-border bg-white p-7 shadow-[0_20px_40px_-12px_rgba(32,44,57,0.15)] md:p-10">
          <h1 class="text-center text-[28px] font-bold leading-tight">香港行</h1>
          <p class="mt-1.5 text-center text-sm text-muted">11/24–11/27</p>
          <div class="mt-7 flex flex-col gap-5"><ng-content /></div>
        </div>
      </main>
    </div>
  `,
})
export class AuthShell {}
