export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export interface Table {
  id: string
  restaurantId: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  reservedAt: string | null
  reservedFor: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTableDto {
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  reservedAt: string | null
  reservedFor: string | null
}
