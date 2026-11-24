import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

const JWT_SECRET = 'super-secret-resttek-key'

const tokenFor = (role: string): string => jwt.sign({ id: 'u1', role }, JWT_SECRET)

describe('table routes (middlewares)', () => {
    it('should respond 401 when no token is provided', async () => {
        const response = await request(app).get('/api/v1/restaurants/rest-1/tables')

        expect(response.status).toBe(401)
        expect(response.body).toEqual({ error: 'Unauthorized: No token provided' })
    })

    it('should respond 403 when a cliente tries to change the status of a table', async () => {
        const response = await request(app)
            .patch('/api/v1/restaurants/rest-1/tables/t1/status')
            .set('Authorization', `Bearer ${tokenFor('cliente')}`)
            .send({ status: 'libre' })

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ error: 'Forbidden: Insufficient permissions' })
    })

    it('should respond 403 when a cliente tries to create a table', async () => {
        const response = await request(app)
            .post('/api/v1/restaurants/rest-1/tables')
            .set('Authorization', `Bearer ${tokenFor('cliente')}`)
            .send({ number: 9, capacity: 4 })

        expect(response.status).toBe(403)
        expect(response.body).toEqual({ error: 'Forbidden: Insufficient permissions' })
    })
})
