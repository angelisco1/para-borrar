import type { Request, Response, NextFunction } from 'express'
import type { TableService } from '@services/table.service.js'
import type { Table } from '@models/table.model.js'

export class TableController {
    constructor(private readonly tableService: TableService) {}

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.create({
                restaurantId: req.params.restaurantId as string,
                number: req.body.number,
                description: req.body.description ?? null,
                capacity: req.body.capacity,
                status: req.body.status,
                reservedAt: req.body.reservedAt ?? null,
                reservedFor: req.body.reservedFor ?? null
            })
            res.status(201).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const status = req.query.status as string | undefined
            const tables = await this.tableService.listByRestaurant(req.params.restaurantId as string, status)
            res.status(200).json(tables.map(t => this.toJSON(t)))
        } catch (error) {
            next(error)
        }
    }

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.getById(req.params.tableId as string)
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.update(req.params.tableId as string, {
                number: req.body.number,
                description: req.body.description ?? null,
                capacity: req.body.capacity,
                status: req.body.status,
                reservedAt: req.body.reservedAt ?? null,
                reservedFor: req.body.reservedFor ?? null
            })
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.tableService.delete(req.params.tableId as string)
            res.status(204).send()
        } catch (error) {
            next(error)
        }
    }

    changeStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.changeStatus(req.params.tableId as string, {
                status: req.body.status,
                reservedAt: req.body.reservedAt ?? null,
                reservedFor: req.body.reservedFor ?? null
            })
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    occupy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.occupy(req.params.tableId as string, req.body.partySize)
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    getAvailable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const minCapacity = Number(req.query.minCapacity ?? 1)
            const tables = await this.tableService.listAvailable(req.params.restaurantId as string, minCapacity)
            res.status(200).json(tables.map(t => this.toJSON(t)))
        } catch (error) {
            next(error)
        }
    }

    private toJSON(table: Table) {
        return {
            id: table.id,
            restaurantId: table.restaurantId,
            number: table.number,
            description: table.description,
            capacity: table.capacity,
            status: table.status,
            reservedAt: table.reservedAt,
            reservedFor: table.reservedFor,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt
        }
    }
}
