import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TableController } from './table.controller.js'
import type { TableService } from '@services/table.service.js'
import type { Table } from '@models/table.model.js'
import { TableNotFoundError } from '@errors/DomainErrors.js'

const baseTable: Table = {
    id: 't1',
    restaurantId: 'rest-1',
    number: 5,
    description: 'Mesa junto a la ventana',
    capacity: 4,
    status: 'libre',
    reservedAt: null,
    reservedFor: null,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z'
}

const buildRes = (): any => {
    const res: any = {}
    res.status = vi.fn().mockReturnValue(res)
    res.json = vi.fn().mockReturnValue(res)
    res.send = vi.fn().mockReturnValue(res)
    return res
}

describe('TableController (CRUD)', () => {
    let controller: TableController
    let service: Record<string, any>
    let res: any
    let next: any

    const reqFor = (params: Record<string, string> = {}, body: Record<string, unknown> = {}): any => ({
        params: { restaurantId: 'rest-1', ...params },
        body
    })

    beforeEach(() => {
        service = {
            create: vi.fn().mockResolvedValue(baseTable),
            update: vi.fn().mockResolvedValue({ ...baseTable, capacity: 6 }),
            getById: vi.fn().mockResolvedValue(baseTable),
            listByRestaurant: vi.fn().mockResolvedValue([baseTable]),
            delete: vi.fn().mockResolvedValue(undefined)
        }
        controller = new TableController(service as unknown as TableService)
        res = buildRes()
        next = vi.fn()
    })

    it('should respond 201 with the created table', async () => {
        await controller.create(reqFor({}, { number: 5, capacity: 4, description: 'Mesa junto a la ventana' }), res, next)

        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.json).toHaveBeenCalledWith({
            id: 't1',
            restaurantId: 'rest-1',
            number: 5,
            description: 'Mesa junto a la ventana',
            capacity: 4,
            status: 'libre',
            reservedAt: null,
            reservedFor: null,
            createdAt: '2026-11-20T10:00:00.000Z',
            updatedAt: '2026-11-20T10:00:00.000Z'
        })
        expect(next).not.toHaveBeenCalled()
    })

    it('should respond 200 with all tables of the restaurant', async () => {
        await controller.getAll(reqFor(), res, next)

        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith([
            expect.objectContaining({ id: 't1', restaurantId: 'rest-1' })
        ])
        expect(next).not.toHaveBeenCalled()
    })

    it('should respond 200 with one table', async () => {
        await controller.getById(reqFor({ tableId: 't1' }), res, next)

        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
        expect(next).not.toHaveBeenCalled()
    })

    it('should respond 200 with the updated table', async () => {
        await controller.update(reqFor({ tableId: 't1' }, { number: 5, capacity: 6, status: 'libre' }), res, next)

        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', capacity: 6 }))
        expect(next).not.toHaveBeenCalled()
    })

    it('should respond 204 for delete', async () => {
        await controller.delete(reqFor({ tableId: 't1' }), res, next)

        expect(res.status).toHaveBeenCalledWith(204)
        expect(res.send).toHaveBeenCalled()
        expect(res.json).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
    })

    it('should delegate service errors to next', async () => {
        service.getById.mockRejectedValueOnce(new TableNotFoundError())

        await controller.getById(reqFor({ tableId: 't1' }), res, next)

        expect(next).toHaveBeenCalledWith(expect.any(TableNotFoundError))
        expect(res.status).not.toHaveBeenCalled()
        expect(res.json).not.toHaveBeenCalled()
    })
})
