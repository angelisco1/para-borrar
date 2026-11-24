import { describe, it, expect } from 'vitest'
import { normalizeTableStatus } from './table.model.js'
import { InvalidTableStatusError } from '@errors/DomainErrors.js'

describe('normalizeTableStatus', () => {
    it('should normalize spaces and uppercase letters', () => {
        expect(normalizeTableStatus(' LIBRE ')).toBe('libre')
    })

    it('should accept ocupada and reservada', () => {
        expect(normalizeTableStatus('ocupada')).toBe('ocupada')
        expect(normalizeTableStatus('reservada')).toBe('reservada')
    })

    it('should throw InvalidTableStatusError for an unknown status', () => {
        expect(() => normalizeTableStatus('pausada')).toThrow(InvalidTableStatusError)
    })
})
