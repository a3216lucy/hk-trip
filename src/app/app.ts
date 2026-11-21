import { Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Icon } from './core/icon';
import { TripService } from './core/trip.service';
import { LockPage } from './pages/lock';
import { MembersPage } from './pages/members';
import { ItineraryTab } from './pages/itinerary';
import { ExpensesTab } from './pages/expenses';
import { NotesTab } from './pages/notes';
import { PackingTab } from './pages/packing';
import { Avatar } from './core/avatar';

type Tab = 'trip' | 'money' | 'packing' | 'notes';

@Component({
  selector: 'app-root',
  imports: [ButtonModule, ConfirmDialogModule, Icon, LockPage, MembersPage, ItineraryTab, ExpensesTab, NotesTab, PackingTab, Avatar],
  templateUrl: './app.html',
})
export class App {
  readonly svc = inject(TripService);
  readonly tab = signal<Tab>('trip');
  readonly managing = signal(false);
  readonly tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'trip', label: '行程', icon: 'map' },
    { id: 'money', label: '記帳', icon: 'wallet' },
    { id: 'notes', label: '筆記', icon: 'notes' },
    { id: 'packing', label: '行李', icon: 'luggage' },
  ];
}
