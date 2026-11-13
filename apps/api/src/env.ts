import dotenv from 'dotenv'
import { resolve } from 'node:path'

// Workspace scripts run with apps/api as cwd; local secrets live in the repository root.
// In production, the platform injects environment variables and this file is absent.
dotenv.config({ path: resolve(process.cwd(), '../../.env') })
