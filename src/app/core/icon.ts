import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  ArrowRight, ExternalLink, ArrowDown, ArrowUp, Bus, CalendarDays, Check, ChevronDown, ChevronUp, Clock, CarTaxiFront, Footprints,
  Hotel, IconNode, LogOut, Map, MapPin, Navigation, NotebookPen, Pencil, Plane, Plus, ShoppingBag, Ship,
  Star, TrainFront, TramFront, Trash2, UserRound, Utensils, Wallet, X, Luggage, EllipsisVertical, Info, Scale, Ticket, CreditCard, PencilLine,
  Bell, Plug, Smartphone, Banknote, Receipt, ArrowLeftRight, Phone, BedDouble, Building2, CloudSun, CalendarClock,
  Shirt, Droplets, Pill, FileText, Briefcase, Lock, UserRoundPlus, ChevronRight, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog,
} from 'lucide';

const ICONS: Record<string, IconNode> = {
  'arrow-right': ArrowRight, external: ExternalLink,
  'arrow-down': ArrowDown, 'arrow-up': ArrowUp, bus: Bus, calendar: CalendarDays, check: Check,
  'chevron-down': ChevronDown, 'chevron-up': ChevronUp, clock: Clock, taxi: CarTaxiFront, footprints: Footprints,
  hotel: Hotel, logout: LogOut, map: Map, pin: MapPin, navigation: Navigation, notes: NotebookPen,
  pencil: Pencil, plane: Plane, plus: Plus, bag: ShoppingBag, ship: Ship, star: Star, train: TrainFront,
  tram: TramFront, trash: Trash2, user: UserRound, food: Utensils, wallet: Wallet, x: X,
  luggage: Luggage, more: EllipsisVertical, info: Info, scale: Scale, ticket: Ticket, card: CreditCard, 'pencil-line': PencilLine,
  bell: Bell, plug: Plug, phone: Smartphone, cash: Banknote, receipt: Receipt, swap: ArrowLeftRight, call: Phone, bed: BedDouble,
  building: Building2, weather: CloudSun, 'cal-clock': CalendarClock, shirt: Shirt, drops: Droplets, pill: Pill, file: FileText,
  briefcase: Briefcase, lock: Lock, 'user-plus': UserRoundPlus, 'chevron-right': ChevronRight,
  sun: Sun, cloud: Cloud, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, fog: CloudFog,
};

/** 線條圖示（Lucide）。用法：<app-icon name="pin" [size]="18" /> */
@Component({
  selector: 'app-icon',
  template: `<svg xmlns="http://www.w3.org/2000/svg" [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" [innerHTML]="html()"></svg>`,
  host: { class: 'inline-flex shrink-0 items-center justify-center' },
})
export class Icon {
  private san = inject(DomSanitizer);
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly html = computed(() => {
    const nodes = ICONS[this.name()] ?? ICONS['star'];
    const svg = nodes
      .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
      .join('');
    return this.san.bypassSecurityTrustHtml(svg);
  });
}
