import { randomUUID } from 'crypto'
import type { Table } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    TableNotFoundError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    DuplicatedTableNumberError
} from '@errors/DomainErrors.js'

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

export class TableService {
    constructor(private readonly tableRepository: TableRepository) {}

    async create(dto: CreateTableDTO): Promise<Table> {
        const existing = await this.tableRepository.findByNumber(dto.restaurantId, dto.number)
        if (existing) {
            throw new DuplicatedTableNumberError()
        }

        const now = new Date().toISOString()
        const table = this.buildTable({
            id: randomUUID(),
            restaurantId: dto.restaurantId,
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status: dto.status ?? 'libre',
            reservedAt: dto.reservedAt ?? null,
            reservedFor: dto.reservedFor ?? null,
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

        const updated = this.buildTable({
            id: existing.id,
            restaurantId: existing.restaurantId,
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status: dto.status,
            reservedAt: dto.reservedAt ?? null,
            reservedFor: dto.reservedFor ?? null,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        })

        await this.tableRepository.save(updated)
        return updated
    }

    async getById(id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table) {
            throw new TableNotFoundError()
        }
        return table
    }

    async listByRestaurant(restaurantId: string): Promise<Table[]> {
        return this.tableRepository.findByRestaurantId(restaurantId)
    }

    async delete(id: string): Promise<void> {
        const existing = await this.tableRepository.findById(id)
        if (!existing) {
            throw new TableNotFoundError()
        }
        await this.tableRepository.delete(id)
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
}
