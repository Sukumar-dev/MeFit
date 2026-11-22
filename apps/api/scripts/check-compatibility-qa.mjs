import { pathToFileURL } from 'node:url'

export function validQaConfiguration(env) {
  try {
    const database = new URL(env.QA_DISPOSABLE_DATABASE_URL)
    const supabase = new URL(env.SUPABASE_URL)
    const keycloak = new URL(env.OIDC_ISSUER)
    const frontend = new URL(env.WEB_ORIGIN)
    const service = new URL(env.RENDER_EXTERNAL_URL)
    const cleanHttps = (url) => url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
    return database.protocol === 'postgresql:' && /^dpg-[a-z0-9-]+$/.test(database.hostname) &&
      database.hostname === env.QA_EXPECTED_DATABASE_HOST &&
      !Object.keys(env).some((key) => /^PG[A-Z]/.test(key)) &&
      ['', '5432'].includes(database.port) && database.pathname === '/mefit_compatibility_qa' &&
      database.username === 'mefit_compatibility_qa' && Boolean(database.password) && !database.search && !database.hash &&
      cleanHttps(service) && service.hostname === 'mefit-compatibility-qa-sukumar.onrender.com' &&
      cleanHttps(supabase) && /^[a-z0-9]{20}\.supabase\.co$/.test(supabase.hostname) &&
      !['rhvzbhlnoimvkzpyrgyn.supabase.co', 'vudfodfzvzsjhnjbyzch.supabase.co'].includes(supabase.hostname) &&
      supabase.pathname === '/' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(env.SUPABASE_PUBLISHABLE_KEY ?? '') &&
      cleanHttps(keycloak) && keycloak.pathname === '/realms/mefit-compatibility-qa' &&
      !keycloak.hostname.startsWith('mefit-auth-') &&
      keycloak.origin !== supabase.origin && env.OIDC_AUDIENCE === 'mefit-compatibility-qa' &&
      env.SUPABASE_JWT_AUDIENCE === 'authenticated' && !env.SUPABASE_JWT_ISSUER && !env.SUPABASE_JWKS_URL &&
      cleanHttps(frontend) && frontend.pathname === '/' &&
      frontend.hostname !== 'mefit-fitness-planner.vercel.app' && env.AUTH_PROVIDER === 'dual'
  } catch {
    return false
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && !validQaConfiguration(process.env)) {
  console.error('QA startup refused. Check the dedicated service, database binding and QA identity configuration.')
  process.exitCode = 1
}
