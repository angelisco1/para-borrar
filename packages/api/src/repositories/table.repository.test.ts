import { SqliteTableRepository } from './table.repository.js'
import { Database } from '@config/database.js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Table } from '@models/table.model.js'

describe('SqliteTableRepository (Integration)', () => {
    let db: Database
    let repo: SqliteTableRepository

    const buildTable = (overrides: Partial<Table> = {}): Table => ({
        id: 't1',
        restaurantId: 'r1',
        number: 1,
        description: 'Mesa junto a la ventana',
        capacity: 4,
        status: 'libre',
        reservedAt: null,
        reservedFor: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    })

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteTableRepository(db)

        await db.run(
            'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['r1', 'La Trattoria', 'Calle Mayor 10', 'info@trattoria.com', '+34 612345678', 'Carlos', 'García', new Date().toISOString(), new Date().toISOString()]
        )
    })

    afterAll(async () => {
        await db.close()
    })

    it('should save and find a table by id', async () => {
        await repo.save(buildTable())

        const found = await repo.findById('t1')
        expect(found).not.toBeNull()
        expect(found?.number).toBe(1)
        expect(found?.description).toBe('Mesa junto a la ventana')
        expect(found?.capacity).toBe(4)
        expect(found?.status).toBe('libre')
    })

    it('should find tables by restaurant id', async () => {
        await repo.save(buildTable({ id: 't2', number: 2, description: null }))

        const results = await repo.findByRestaurantId('r1')
        expect(results.length).toBeGreaterThanOrEqual(2)
    })

    it('should find a table by restaurant id and number', async () => {
        const found = await repo.findByNumber('r1', 2)
        expect(found).not.toBeNull()
        expect(found?.id).toBe('t2')
        expect(found?.description).toBeNull()
    })

    it('should update the status of an existing table', async () => {
        await repo.save(buildTable({ id: 't1', number: 1, status: 'ocupada' }))

        const found = await repo.findById('t1')
        expect(found?.status).toBe('ocupada')
    })

    it('should delete a table', async () => {
        await repo.delete('t2')

        const found = await repo.findById('t2')
        expect(found).toBeNull()
    })

    it('should return null for non-existent table', async () => {
        const found = await repo.findById('non-existent')
        expect(found).toBeNull()
    })
})
