import { randomUUID } from 'crypto'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    TableNotFoundError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    DuplicatedTableNumberError,
    TableNotAvailableError,
    TableCapacityExceededError,
    InvalidPartySizeError,
    InvalidReservationDataError
} from '@errors/DomainErrors.js'

const ISO_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

export interface CreateTableDTO {
    restaurantId: string
    number: number
    description: string | null
    capacity: number
    status?: string
    reservedAt?: string | null
    reservedFor?: string | null
}

export interface UpdateTableDTO {
    number: number
    description: string | null
    capacity: number
    status: string
    reservedAt?: string | null
    reservedFor?: string | null
}

export interface ChangeTableStatusDTO {
    status: string
    reservedAt?: string | null
    reservedFor?: string | null
}

export class TableService {
    constructor(private readonly tableRepository: TableRepository) {}

    async create(dto: CreateTableDTO): Promise<Table> {
        const existing = await this.tableRepository.findByNumber(dto.restaurantId, dto.number)
        if (existing) {
            throw new DuplicatedTableNumberError()
        }

        const now = new Date().toISOString()
        const status = normalizeTableStatus(dto.status ?? 'libre')
        const reservation = this.buildReservationData(status, dto.reservedAt, dto.reservedFor)
        const table = this.buildTable({
            id: randomUUID(),
            restaurantId: dto.restaurantId,
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status,
            reservedAt: reservation.reservedAt,
            reservedFor: reservation.reservedFor,
            createdAt: now,
            updatedAt: now
        })

        await this.tableRepository.save(table)
        return table
    }

    async update(id: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.tableRepository.findById(id)
        if (!existing) {
            throw new TableNotFoundError()
        }

        const duplicated = await this.tableRepository.findByNumber(existing.restaurantId, dto.number)
        if (duplicated && duplicated.id !== existing.id) {
            throw new DuplicatedTableNumberError()
        }

        const status = normalizeTableStatus(dto.status)
        const reservation = this.buildReservationData(status, dto.reservedAt, dto.reservedFor)
        const updatedTable = this.buildTable({
            id: existing.id,
            restaurantId: existing.restaurantId,
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status,
            reservedAt: reservation.reservedAt,
            reservedFor: reservation.reservedFor,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        })

        await this.tableRepository.save(updatedTable)
        return updatedTable
    }

    async getById(id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table) {
            throw new TableNotFoundError()
        }
        return table
    }

    async listByRestaurant(restaurantId: string, status?: string): Promise<Table[]> {
        const tables = await this.tableRepository.findByRestaurantId(restaurantId)
        if (status === undefined) {
            return tables
        }
        const normalized = normalizeTableStatus(status)
        return tables.filter(t => t.status === normalized)
    }

    async delete(id: string): Promise<void> {
        const existing = await this.tableRepository.findById(id)
        if (!existing) {
            throw new TableNotFoundError()
        }
        await this.tableRepository.delete(id)
    }

    async listAvailable(restaurantId: string, minCapacity: number): Promise<Table[]> {
        const capacity = this.validateMinCapacity(minCapacity)
        const tables = await this.tableRepository.findByRestaurantId(restaurantId)
        return tables.filter(t => t.status === 'libre' && t.capacity >= capacity)
    }

    async occupy(id: string, partySize: number): Promise<Table> {
        const size = this.validatePartySize(partySize)
        const table = await this.tableRepository.findById(id)
        if (!table) {
            throw new TableNotFoundError()
        }
        if (table.status !== 'libre') {
            throw new TableNotAvailableError()
        }
        if (size > table.capacity) {
            throw new TableCapacityExceededError()
        }

        const updated: Table = {
            ...table,
            status: 'ocupada',
            reservedAt: null,
            reservedFor: null,
            updatedAt: new Date().toISOString()
        }
        await this.tableRepository.save(updated)
        return updated
    }

    async changeStatus(id: string, dto: ChangeTableStatusDTO): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table) {
            throw new TableNotFoundError()
        }

        const status = normalizeTableStatus(dto.status)
        const reservation = this.buildReservationData(status, dto.reservedAt, dto.reservedFor)
        const updated: Table = {
            ...table,
            status,
            reservedAt: reservation.reservedAt,
            reservedFor: reservation.reservedFor,
            updatedAt: new Date().toISOString()
        }
        await this.tableRepository.save(updated)
        return updated
    }

    private buildTable(props: {
        id: string
        restaurantId: string
        number: number
        description: string | null
        capacity: number
        status: string
        reservedAt: string | null
        reservedFor: string | null
        createdAt: string
        updatedAt: string
    }): Table {
        return {
            id: props.id,
            restaurantId: props.restaurantId,
            number: this.validateNumber(props.number),
            description: this.normalizeDescription(props.description),
            capacity: this.validateCapacity(props.capacity),
            status: normalizeTableStatus(props.status),
            reservedAt: props.reservedAt,
            reservedFor: props.reservedFor,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        }
    }

    private validateNumber(value: number): number {
        if (!Number.isInteger(value) || value < 1) {
            throw new InvalidTableNumberError()
        }
        return value
    }

    private validateCapacity(value: number): number {
        if (!Number.isInteger(value) || value < 1) {
            throw new InvalidTableCapacityError()
        }
        return value
    }

    private normalizeDescription(value: string | null): string | null {
        if (value === null) return null
        const trimmed = value.trim()
        return trimmed === '' ? null : trimmed
    }

    private validateMinCapacity(value: number): number {
        if (!Number.isInteger(value) || value < 1) {
            throw new InvalidTableCapacityError('minCapacity must be an integer greater than or equal to 1')
        }
        return value
    }

    private validatePartySize(value: number): number {
        if (!Number.isInteger(value) || value < 1) {
            throw new InvalidPartySizeError()
        }
        return value
    }

    private buildReservationData(status: TableStatusType, reservedAt?: string | null, reservedFor?: string | null): { reservedAt: string | null, reservedFor: string | null } {
        if (status !== 'reservada') {
            return { reservedAt: null, reservedFor: null }
        }
        const at = reservedAt ?? null
        if (at !== null && (!ISO_DATE_TIME_REGEX.test(at) || Number.isNaN(Date.parse(at)))) {
            throw new InvalidReservationDataError()
        }
        return { reservedAt: at, reservedFor: reservedFor ?? null }
    }
}
