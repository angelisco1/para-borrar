import { Component, inject, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { firstValueFrom } from 'rxjs'
import { TableStore } from '../../store/table.store'
import { TableService } from '../../services/table.service'
import type { CreateTableDto, TableStatus } from '../../models/table.model'

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './table-form.component.html',
  styleUrl: './table-form.component.css'
})
export class TableFormComponent implements OnInit {
  private readonly store = inject(TableStore)
  private readonly service = inject(TableService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  isEditing = false
  tableId: string | null = null
  restaurantId = ''
  loading = signal(false)
  error = signal<string | null>(null)

  statuses: TableStatus[] = ['libre', 'ocupada', 'reservada']

  form = {
    number: 1,
    description: '',
    capacity: 4,
    status: 'libre' as TableStatus,
    reservedAt: '',
    reservedFor: ''
  }

  get pageTitle(): string {
    return this.isEditing ? 'Editar mesa' : 'Nueva mesa'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/tables`
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
    const id = this.route.snapshot.paramMap.get('id')

    if (id && this.restaurantId) {
      this.isEditing = true
      this.tableId = id
      this.loadTable()
    }
  }

  private async loadTable(): Promise<void> {
    this.loading.set(true)
    try {
      const table = await firstValueFrom(this.service.getById(this.restaurantId, this.tableId!))
      this.form = {
        number: table.number,
        description: table.description ?? '',
        capacity: table.capacity,
        status: table.status,
        reservedAt: this.toLocalDateTime(table.reservedAt),
        reservedFor: table.reservedFor ?? ''
      }
    } catch {
      this.error.set('No se pudo cargar la mesa.')
    } finally {
      this.loading.set(false)
    }
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'libre': 'Libre',
      'ocupada': 'Ocupada',
      'reservada': 'Reservada'
    }
    return labels[status] ?? status
  }

  async onSubmit(): Promise<void> {
    this.error.set(null)

    const validationError = this.validate()
    if (validationError) {
      this.error.set(validationError)
      return
    }

    this.loading.set(true)
    try {
      if (this.isEditing && this.tableId) {
        await this.store.update(this.restaurantId, this.tableId, this.buildDto())
      } else {
        await this.store.create(this.restaurantId, this.buildDto())
      }
      this.router.navigate(['/restaurants', this.restaurantId, 'tables'])
    } catch (err: any) {
      this.error.set(this.getErrorMessage(err))
    } finally {
      this.loading.set(false)
    }
  }

  private validate(): string | null {
    if (!Number.isInteger(this.form.number) || this.form.number < 1) {
      return 'El número de mesa debe ser un entero mayor o igual que 1.'
    }
    if (!Number.isInteger(this.form.capacity) || this.form.capacity < 1) {
      return 'La capacidad debe ser un entero mayor o igual que 1.'
    }
    if (this.form.status === 'reservada' && !this.form.reservedAt) {
      return 'Indica la fecha y hora prevista de la reserva.'
    }
    return null
  }

  private buildDto(): CreateTableDto {
    const isReserved = this.form.status === 'reservada'
    return {
      number: this.form.number,
      description: this.form.description.trim() || null,
      capacity: this.form.capacity,
      status: this.form.status,
      reservedAt: isReserved && this.form.reservedAt
        ? new Date(this.form.reservedAt).toISOString()
        : null,
      reservedFor: isReserved && this.form.reservedFor.trim() ? this.form.reservedFor.trim() : null
    }
  }

  private getErrorMessage(err: any): string {
    const messages: Record<string, string> = {
      'DuplicatedTableNumberError': 'Ya existe una mesa con ese número en este restaurante.',
      'InvalidTableNumberError': 'El número de mesa debe ser un entero mayor o igual que 1.',
      'InvalidTableCapacityError': 'La capacidad debe ser un entero mayor o igual que 1.',
      'InvalidTableStatusError': 'El estado de la mesa no es válido.',
      'TableNotFoundError': 'La mesa no existe.'
    }
    const code = err?.error?.error
    return messages[code] ?? err?.error?.message ?? 'Error al guardar la mesa.'
  }

  private toLocalDateTime(iso: string | null): string {
    if (!iso) return ''
    const date = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}
