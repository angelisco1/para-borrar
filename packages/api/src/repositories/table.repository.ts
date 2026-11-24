import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'

interface TableRow {
    id: string
    number: number
    description: string | null
    capacity: number
    status: string
    reservedAt: string | null
    reservedFor: string | null
    restaurantId: string
    createdAt: string
    updatedAt: string
}

export interface TableRepository {
    findById(id: string): Promise<Table | null>
    findByRestaurantId(restaurantId: string): Promise<Table[]>
    findByNumber(restaurantId: string, number: number): Promise<Table | null>
    save(table: Table): Promise<void>
    delete(id: string): Promise<void>
}

export class SqliteTableRepository implements TableRepository {
    constructor(private db: Database) {}

    async findById(id: string): Promise<Table | null> {
        const row = await this.db.get<TableRow>(
            'SELECT id, number, description, capacity, status, reserved_at as reservedAt, reserved_for as reservedFor, restaurant_id as restaurantId, created_at as createdAt, updated_at as updatedAt FROM tables WHERE id = ?',
            [id]
        )
        return row ? this.mapToTable(row) : null
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(
            'SELECT id, number, description, capacity, status, reserved_at as reservedAt, reserved_for as reservedFor, restaurant_id as restaurantId, created_at as createdAt, updated_at as updatedAt FROM tables WHERE restaurant_id = ? ORDER BY number ASC',
            [restaurantId]
        )
        return rows.map(row => this.mapToTable(row))
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        const row = await this.db.get<TableRow>(
            'SELECT id, number, description, capacity, status, reserved_at as reservedAt, reserved_for as reservedFor, restaurant_id as restaurantId, created_at as createdAt, updated_at as updatedAt FROM tables WHERE restaurant_id = ? AND number = ?',
            [restaurantId, number]
        )
        return row ? this.mapToTable(row) : null
    }

    async save(table: Table): Promise<void> {
        const existing = await this.db.get<{ id: string }>('SELECT id FROM tables WHERE id = ?', [table.id])

        if (existing) {
            await this.db.run(
                'UPDATE tables SET number = ?, description = ?, capacity = ?, status = ?, reserved_at = ?, reserved_for = ?, updated_at = ? WHERE id = ?',
                [table.number, table.description, table.capacity, table.status, table.reservedAt, table.reservedFor, table.updatedAt, table.id]
            )
        } else {
            await this.db.run(
                'INSERT INTO tables (id, number, description, capacity, status, reserved_at, reserved_for, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [table.id, table.number, table.description, table.capacity, table.status, table.reservedAt, table.reservedFor, table.restaurantId, table.createdAt, table.updatedAt]
            )
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.run('DELETE FROM tables WHERE id = ?', [id])
    }

    private mapToTable(row: TableRow): Table {
        return {
            id: row.id,
            restaurantId: row.restaurantId,
            number: row.number,
            description: row.description,
            capacity: row.capacity,
            status: normalizeTableStatus(row.status),
            reservedAt: row.reservedAt,
            reservedFor: row.reservedFor,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }
}
