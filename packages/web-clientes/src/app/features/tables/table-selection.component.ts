import { Component, computed, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { TableService } from '../../core/services/table.service'
import { DiningSessionStore } from '../../core/store/dining-session.store'
import { Table } from '../../core/models/table.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>Elige tu mesa</h1>
          <p class="subtitle">Dinos cuántos sois y te mostraremos las mesas libres con aforo suficiente</p>
        </div>
      </div>

      <div class="party-form card">
        <div class="form-group">
          <label for="party-size">Comensales</label>
          <input
            id="party-size"
            class="form-control"
            type="number"
            min="1"
            step="1"
            [value]="partySize()"
            (input)="onPartySizeInput($event)"
          />
        </div>
        <button type="button" class="btn btn-primary" (click)="buscarMesas()" [disabled]="loading()">
          @if (loading()) {
            Buscando...
          } @else {
            Buscar mesas
          }
        </button>
      </div>

      @if (partySizeError()) {
        <div class="alert-error">{{ partySizeError() }}</div>
      }

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (loadError()) {
        <div class="alert-error">{{ loadError() }}</div>
      } @else if (searchedSize() !== null && tables().length === 0) {
        <div class="empty-state card">
          <p>No hay mesas libres para {{ searchedSize() }} comensales.</p>
          <p>Prueba con menos comensales o vuelve más tarde.</p>
        </div>
      } @else if (tables().length > 0) {
        @if (needsNewSearch()) {
          <p class="stale-hint">
            Has cambiado el número de comensales: vuelve a buscar para actualizar el listado.
          </p>
        }
        <div class="tables-grid">
          @for (table of tables(); track table.id) {
            <button
              type="button"
              class="table-card card"
              [class.selected]="selectedTableId() === table.id"
              (click)="selectTable(table)"
            >
              <span class="table-number">Mesa {{ table.number }}</span>
              @if (table.description) {
                <span class="table-description">{{ table.description }}</span>
              }
              <span class="badge">Hasta {{ table.capacity }} comensales</span>
            </button>
          }
        </div>
      }

      @if (occupyError()) {
        <div class="alert-error">{{ occupyError() }}</div>
      }

      @if (tables().length > 0) {
        <button
          type="button"
          class="btn btn-primary btn-continue"
          [disabled]="!selectedTableId() || occupying() || needsNewSearch()"
          (click)="continuar()"
        >
          @if (occupying()) {
            Reservando tu mesa...
          } @else {
            Continuar
          }
        </button>
      }
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .back-link {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: inline-block;
    }
    .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
      margin-top: 4px;
    }
    .party-form {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 24px;
    }
    .party-form .form-group {
      width: 160px;
    }
    .stale-hint {
      color: var(--yellow);
      font-size: 13px;
      margin-bottom: 16px;
    }
    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .table-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      text-align: left;
      cursor: pointer;
      transition: all var(--transition);
      color: var(--text-primary);
    }
    .table-card:hover {
      transform: translateY(-2px);
      border-color: var(--green-medium);
    }
    .table-card.selected {
      border-color: var(--green-light);
      background: var(--green-glow);
      box-shadow: var(--shadow-glow);
    }
    .table-number {
      font-size: 16px;
      font-weight: 600;
    }
    .table-description {
      font-size: 13px;
      color: var(--text-muted);
    }
    .btn-continue {
      margin-top: 8px;
    }
  `]
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly tableService = inject(TableService)
  private readonly diningSession = inject(DiningSessionStore)

  readonly partySize = signal('1')
  readonly tables = signal<Table[]>([])
  readonly searchedSize = signal<number | null>(null)
  readonly loading = signal(false)
  readonly partySizeError = signal<string | null>(null)
  readonly loadError = signal<string | null>(null)
  readonly occupyError = signal<string | null>(null)
  readonly occupying = signal(false)
  readonly selectedTableId = signal<string | null>(null)

  readonly needsNewSearch = computed(() => {
    const searched = this.searchedSize()
    if (searched === null) return false
    const current = Number(this.partySize())
    return !Number.isInteger(current) || current !== searched
  })

  private restaurantId!: string

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!
  }

  onPartySizeInput(event: Event): void {
    this.partySize.set((event.target as HTMLInputElement).value)
    this.partySizeError.set(null)
    if (this.needsNewSearch()) {
      this.selectedTableId.set(null)
    }
  }

  buscarMesas(): void {
    const size = Number(this.partySize())
    if (!Number.isInteger(size) || size < 1) {
      this.partySizeError.set('Introduce un número de comensales válido (entero, mínimo 1)')
      return
    }
    this.partySizeError.set(null)
    this.occupyError.set(null)
    this.loadTables(size)
  }

  selectTable(table: Table): void {
    this.selectedTableId.set(table.id)
    this.occupyError.set(null)
  }

  continuar(): void {
    const size = this.searchedSize()
    const table = this.tables().find(t => t.id === this.selectedTableId())
    if (size === null || !table) return

    this.occupying.set(true)
    this.occupyError.set(null)

    this.tableService.occupy(this.restaurantId, table.id, size).subscribe({
      next: (occupied) => {
        this.diningSession.select(occupied, size)
        this.router.navigate(['/restaurants', this.restaurantId, 'menu'])
      },
      error: () => {
        this.occupying.set(false)
        this.occupyError.set(
          'La mesa que has elegido ya no está disponible o no tiene aforo suficiente. Hemos actualizado el listado: elige otra mesa.'
        )
        this.loadTables(size)
      }
    })
  }

  private loadTables(size: number): void {
    this.loading.set(true)
    this.loadError.set(null)
    this.tableService.getAvailable(this.restaurantId, size).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        this.searchedSize.set(size)
        this.selectedTableId.set(null)
        this.loading.set(false)
      },
      error: () => {
        this.loadError.set('Error al cargar las mesas. Inténtalo de nuevo.')
        this.loading.set(false)
      }
    })
  }
}
