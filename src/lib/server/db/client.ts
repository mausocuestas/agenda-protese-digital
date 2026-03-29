import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { DATABASE_URL } from '$env/static/private'
import * as schema from './index'
import * as relations from './relations'

const sql = neon(DATABASE_URL)

// Schema inclui tabelas + relações para habilitar db.query.*
export const db = drizzle(sql, { schema: { ...schema, ...relations } })
