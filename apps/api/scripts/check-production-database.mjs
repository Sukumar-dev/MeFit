// Verify the project encoded in the Supabase session pooler username.
// Never print the connection string, even when parsing fails.
let valid = false
try {
  const url = new URL(process.env.DATABASE_URL)
  const [role, project] = decodeURIComponent(url.username).split('.')
  valid = ['postgres:', 'postgresql:'].includes(url.protocol)
    && url.hostname.endsWith('.pooler.supabase.com')
    && url.port === '5432'
    && url.pathname === '/postgres'
    && Boolean(role && url.password)
    && project === 'rhvzbhlnoimvkzpyrgyn'
    && ['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))
} catch {
  // Report the same safe error for malformed or missing URLs.
}
if (!valid) {
  console.error('Set DATABASE_URL to the production MeFit Supabase Session pooler URI on port 5432 with sslmode=require.')
  process.exitCode = 1
}
