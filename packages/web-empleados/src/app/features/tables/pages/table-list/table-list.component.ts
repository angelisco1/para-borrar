import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { Order } from '../../../orders/models/order.model';
import { OrderStore } from '../../../orders/store/order.store';
import { Table, TableStatus } from '../../models/table.model';
import { TableStore } from '../../store/table.store';

@Component({
  selector: 'app-table-list',
  standalone: true,
  templateUrl: './table-list.component.html',
  styleUrl: './table-list.component.css'
})
export class TableListComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);
  readonly orderStore = inject(OrderStore);

  private restaurantId: string | null = null;

  readonly canChangeStatus = computed(() => {
    const role = this.authStore.userRole();
    return role === 'camarero' || role === 'manager';
  });

  readonly reservingTableId = signal<string | null>(null);
  readonly reserveDate = signal('');
  readonly reserveName = signal('');
  readonly reserveError = signal<string | null>(null);

  ngOnInit(): void {
    this.restaurantId = this.authStore.user()?.restaurantId ?? null;
    if (this.restaurantId) {
      this.tableStore.startPolling(this.restaurantId);
      this.orderStore.startPolling(this.restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
    this.orderStore.stopPolling();
  }

  ordersForTable(tableId: string): Order[] {
    return this.orderStore.orders().filter(order => order.tableId === tableId);
  }

  changeStatus(table: Table, status: TableStatus): void {
    if (!this.restaurantId) {
      return;
    }
    this.tableStore.updateStatus(this.restaurantId, table.id, status);
  }

  startReserve(table: Table): void {
    this.reservingTableId.set(table.id);
    this.reserveDate.set('');
    this.reserveName.set('');
    this.reserveError.set(null);
  }

  cancelReserve(): void {
    this.reservingTableId.set(null);
    this.reserveError.set(null);
  }

  confirmReserve(table: Table): void {
    if (!this.restaurantId) {
      return;
    }
    if (!this.reserveDate() || !this.reserveName().trim()) {
      this.reserveError.set('Indica la fecha/hora y el nombre de la reserva');
      return;
    }
    const reservedAt = new Date(this.reserveDate()).toISOString();
    const reservedFor = this.reserveName().trim();
    this.reservingTableId.set(null);
    this.reserveError.set(null);
    this.tableStore.updateStatus(this.restaurantId, table.id, 'reservada', reservedAt, reservedFor);
  }

  onReserveDateInput(event: Event): void {
    this.reserveDate.set((event.target as HTMLInputElement).value);
  }

  onReserveNameInput(event: Event): void {
    this.reserveName.set((event.target as HTMLInputElement).value);
  }

  getStatusClass(status: string): string {
    return `badge badge-${status}`;
  }

  formatDateTime(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  }
}
