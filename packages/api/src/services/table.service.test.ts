import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
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

describe('TableService', () => {
    let repo: MockTableRepository
    let service: TableService

    const validDTO = {
        restaurantId: 'rest-1',
        number: 5,
        description: 'Mesa junto a la ventana',
        capacity: 4
    }

    beforeEach(() => {
        repo = new MockTableRepository()
        service = new TableService(repo)
    })

    describe('create', () => {
        it('should create a table with status libre by default', async () => {
            const result = await service.create(validDTO)

            expect(result.id).toBeDefined()
            expect(result.status).toBe('libre')
            expect(result.reservedAt).toBeNull()
            expect(result.reservedFor).toBeNull()

            const saved = await repo.findById(result.id)
            expect(saved).not.toBeNull()
        })

        it('should trim the description', async () => {
            const result = await service.create({ ...validDTO, description: '  Mesa junto a la ventana  ' })
            expect(result.description).toBe('Mesa junto a la ventana')
        })

        it('should store null for a blank description', async () => {
            const result = await service.create({ ...validDTO, description: '   ' })
            expect(result.description).toBeNull()
        })

        it('should throw InvalidTableNumberError for a non-positive number', async () => {
            await expect(service.create({ ...validDTO, number: 0 }))
                .rejects.toThrow(InvalidTableNumberError)
        })

        it('should throw InvalidTableCapacityError for a non-positive capacity', async () => {
            await expect(service.create({ ...validDTO, capacity: 0 }))
                .rejects.toThrow(InvalidTableCapacityError)
        })

        it('should throw DuplicatedTableNumberError when the number already exists in the restaurant', async () => {
            await service.create(validDTO)

            await expect(service.create(validDTO))
                .rejects.toThrow(DuplicatedTableNumberError)
        })
    })

    describe('update', () => {
        it('should update an existing table', async () => {
            const created = await service.create(validDTO)

            const result = await service.update(created.id, {
                number: 5,
                description: 'Mesa junto a la ventana (reformada)',
                capacity: 6,
                status: 'libre'
            })

            expect(result.description).toBe('Mesa junto a la ventana (reformada)')
            expect(result.capacity).toBe(6)
            expect(result.createdAt).toBe(created.createdAt)
        })

        it('should throw TableNotFoundError for a non-existent id', async () => {
            await expect(service.update('non-existent', { number: 5, description: null, capacity: 4, status: 'libre' }))
                .rejects.toThrow(TableNotFoundError)
        })

        it('should throw DuplicatedTableNumberError when moving to a number of another table', async () => {
            await service.create(validDTO)
            const other = await service.create({ ...validDTO, number: 6 })

            await expect(service.update(other.id, { number: 5, description: null, capacity: 4, status: 'libre' }))
                .rejects.toThrow(DuplicatedTableNumberError)
        })

        it('should allow updating a table keeping its own number', async () => {
            const created = await service.create(validDTO)

            const result = await service.update(created.id, {
                number: 5,
                description: null,
                capacity: 2,
                status: 'libre'
            })

            expect(result.capacity).toBe(2)
        })
    })

    describe('getById', () => {
        it('should get a table by id', async () => {
            const created = await service.create(validDTO)

            const result = await service.getById(created.id)
            expect(result.number).toBe(5)
        })

        it('should throw TableNotFoundError for a non-existent id', async () => {
            await expect(service.getById('non-existent'))
                .rejects.toThrow(TableNotFoundError)
        })
    })

    describe('listByRestaurant', () => {
        it('should list the tables of a restaurant sorted by number', async () => {
            await service.create({ ...validDTO, number: 3 })
            await service.create({ ...validDTO, number: 1 })

            const results = await service.listByRestaurant('rest-1')
            expect(results).toHaveLength(2)
            expect(results.map(t => t.number)).toEqual([1, 3])
        })

        it('should not list tables of other restaurants', async () => {
            await service.create(validDTO)

            const results = await service.listByRestaurant('rest-2')
            expect(results).toHaveLength(0)
        })

        it('should filter by status when provided', async () => {
            await service.create({ ...validDTO, number: 1 })
            await service.create({ ...validDTO, number: 2, status: 'ocupada' })

            const results = await service.listByRestaurant('rest-1', 'OCUPADA')

            expect(results).toHaveLength(1)
            expect(results[0]?.number).toBe(2)
        })

        it('should throw InvalidTableStatusError for an unknown status filter', async () => {
            await expect(service.listByRestaurant('rest-1', 'pausada'))
                .rejects.toThrow(InvalidTableStatusError)
        })
    })

    describe('delete', () => {
        it('should delete an existing table', async () => {
            const created = await service.create(validDTO)

            await service.delete(created.id)

            const found = await repo.findById(created.id)
            expect(found).toBeNull()
        })

        it('should throw TableNotFoundError for a non-existent id', async () => {
            await expect(service.delete('non-existent'))
                .rejects.toThrow(TableNotFoundError)
        })
    })

    describe('listAvailable', () => {
        it('should list only free tables with enough capacity', async () => {
            await service.create({ ...validDTO, number: 1, capacity: 2 })
            await service.create({ ...validDTO, number: 2, capacity: 4 })
            await service.create({ ...validDTO, number: 3, capacity: 4, status: 'ocupada' })
            await service.create({ ...validDTO, number: 4, capacity: 8, status: 'reservada' })

            const results = await service.listAvailable('rest-1', 3)

            expect(results).toHaveLength(1)
            expect(results[0]?.number).toBe(2)
        })

        it('should list every free table when minCapacity is 1', async () => {
            await service.create({ ...validDTO, number: 1, capacity: 2 })
            await service.create({ ...validDTO, number: 2, capacity: 4 })
            await service.create({ ...validDTO, number: 3, capacity: 4, status: 'ocupada' })

            const results = await service.listAvailable('rest-1', 1)

            expect(results).toHaveLength(2)
        })

        it('should throw InvalidTableCapacityError for a non-positive minCapacity', async () => {
            await expect(service.listAvailable('rest-1', 0))
                .rejects.toThrow(InvalidTableCapacityError)
        })
    })

    describe('occupy', () => {
        it('should mark a free table as ocupada', async () => {
            const created = await service.create(validDTO)

            const result = await service.occupy(created.id, 4)

            expect(result.status).toBe('ocupada')
            const saved = await repo.findById(created.id)
            expect(saved?.status).toBe('ocupada')
        })

        it('should throw TableNotFoundError for a non-existent table', async () => {
            await expect(service.occupy('non-existent', 2))
                .rejects.toThrow(TableNotFoundError)
        })

        it('should throw TableNotAvailableError when the table is not free', async () => {
            const created = await service.create({ ...validDTO, status: 'ocupada' })

            await expect(service.occupy(created.id, 2))
                .rejects.toThrow(TableNotAvailableError)
        })

        it('should throw TableCapacityExceededError when partySize exceeds capacity', async () => {
            const created = await service.create(validDTO)

            await expect(service.occupy(created.id, 5))
                .rejects.toThrow(TableCapacityExceededError)
        })

        it('should throw InvalidPartySizeError for a non-positive partySize', async () => {
            const created = await service.create(validDTO)

            await expect(service.occupy(created.id, 0))
                .rejects.toThrow(InvalidPartySizeError)
        })
    })

    describe('changeStatus', () => {
        it('should normalize and change the status of a table', async () => {
            const created = await service.create(validDTO)

            const result = await service.changeStatus(created.id, { status: ' OCUPADA ' })

            expect(result.status).toBe('ocupada')
        })

        it('should throw InvalidTableStatusError for an unknown status', async () => {
            const created = await service.create(validDTO)

            await expect(service.changeStatus(created.id, { status: 'pausada' }))
                .rejects.toThrow(InvalidTableStatusError)
        })

        it('should throw TableNotFoundError for a non-existent table', async () => {
            await expect(service.changeStatus('non-existent', { status: 'libre' }))
                .rejects.toThrow(TableNotFoundError)
        })

        it('should store reservation data when the status is reservada', async () => {
            const created = await service.create(validDTO)

            const result = await service.changeStatus(created.id, {
                status: 'reservada',
                reservedAt: '2026-11-24T20:30:00.000Z',
                reservedFor: 'Ana Ruiz · 600123456'
            })

            expect(result.status).toBe('reservada')
            expect(result.reservedAt).toBe('2026-11-24T20:30:00.000Z')
            expect(result.reservedFor).toBe('Ana Ruiz · 600123456')
        })

        it('should throw InvalidReservationDataError for an invalid reservedAt', async () => {
            const created = await service.create(validDTO)

            await expect(service.changeStatus(created.id, {
                status: 'reservada',
                reservedAt: '24-11-2026 20:30'
            }))
                .rejects.toThrow(InvalidReservationDataError)
        })

        it('should clear reservation data when moving away from reservada', async () => {
            const created = await service.create(validDTO)
            await service.changeStatus(created.id, {
                status: 'reservada',
                reservedAt: '2026-11-24T20:30:00.000Z',
                reservedFor: 'Ana Ruiz · 600123456'
            })

            const result = await service.changeStatus(created.id, { status: 'libre' })

            expect(result.status).toBe('libre')
            expect(result.reservedAt).toBeNull()
            expect(result.reservedFor).toBeNull()
        })
    })

    describe('reservation data on create and update (D6)', () => {
        it('should keep reservation data when creating a table as reservada', async () => {
            const result = await service.create({
                ...validDTO,
                status: 'reservada',
                reservedAt: '2026-11-24T20:30:00.000Z',
                reservedFor: 'Ana Ruiz · 600123456'
            })

            expect(result.reservedAt).toBe('2026-11-24T20:30:00.000Z')
            expect(result.reservedFor).toBe('Ana Ruiz · 600123456')
        })

        it('should ignore reservation data when the status is not reservada', async () => {
            const result = await service.create({
                ...validDTO,
                status: 'libre',
                reservedAt: '2026-11-24T20:30:00.000Z',
                reservedFor: 'Ana Ruiz · 600123456'
            })

            expect(result.status).toBe('libre')
            expect(result.reservedAt).toBeNull()
            expect(result.reservedFor).toBeNull()
        })

        it('should clear reservation data when updating a table to a non-reservada status', async () => {
            const created = await service.create({
                ...validDTO,
                status: 'reservada',
                reservedAt: '2026-11-24T20:30:00.000Z',
                reservedFor: 'Ana Ruiz · 600123456'
            })

            const result = await service.update(created.id, { number: 5, description: null, capacity: 4, status: 'libre' })

            expect(result.reservedAt).toBeNull()
            expect(result.reservedFor).toBeNull()
        })
    })
})
