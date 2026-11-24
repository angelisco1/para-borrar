import { Injectable, signal } from '@angular/core'
import { Table } from '../models/table.model'

@Injectable({ providedIn: 'root' })
export class DiningSessionStore {
  private readonly _table = signal<Table | null>(null)
  private readonly _partySize = signal<number | null>(null)

  readonly table = this._table.asReadonly()
  readonly partySize = this._partySize.asReadonly()

  select(table: Table, partySize: number): void {
    this._table.set(table)
    this._partySize.set(partySize)
  }

  clear(): void {
    this._table.set(null)
    this._partySize.set(null)
  }
}
