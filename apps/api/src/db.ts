import './env.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL must be configured')

const adapter = new PrismaPg({ connectionString, max: 10, connectionTimeoutMillis: 5000 })
export const prisma = new PrismaClient({ adapter })
