export interface Table {
  id: string
  restaurantId: string
  number: number
  description: string | null
  capacity: number
  status: 'libre' | 'ocupada' | 'reservada'
  reservedAt: string | null
  reservedFor: string | null
  createdAt: string
  updatedAt: string
}
