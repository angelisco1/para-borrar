import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import {
    TableNotFoundError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    DuplicatedTableNumberError
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
})
