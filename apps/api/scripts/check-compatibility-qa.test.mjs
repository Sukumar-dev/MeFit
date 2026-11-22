import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test, after } from 'node:test'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('../../../', import.meta.url))
const root = mkdtempSync(join(tmpdir(), 'mefit-guard-'))
const log = join(root, 'log')
after(() => rmSync(root, { recursive: true, force: true }))
// Put a fake npm first on PATH and omit the caller's environment.
writeFileSync(join(root, 'npm'), '#!/bin/sh\nprintf "%s %s\\n" "$4" "$DATABASE_URL" >> "$LOG"\nif [ "$4" = db:deploy ]; then exit "${MIGRATION_RESULT:-0}"; fi\n', {mode: 0o700})
const qa = { PATH: root + ':' + process.env.PATH, LOG: log, QA_DISPOSABLE_DATABASE_URL:'postgresql://mefit_compatibility_qa:fixture@dpg-test-a:5432/mefit_compatibility_qa', QA_EXPECTED_DATABASE_HOST:'dpg-test-a', DATABASE_URL:'postgresql://ignored:fixture@dpg-existing/db', SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co', OIDC_ISSUER:'https://qa-keycloak.invalid/realms/mefit-compatibility-qa', WEB_ORIGIN:'https://qa-web.invalid', RENDER_EXTERNAL_URL:'https://mefit-compatibility-qa-sukumar.onrender.com', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture', OIDC_AUDIENCE:'mefit-compatibility-qa', SUPABASE_JWT_AUDIENCE:'authenticated', AUTH_PROVIDER:'dual' }
const run = (delta) => spawnSync('/bin/sh',['apps/api/scripts/start-compatibility-qa.sh'],{cwd: repository, env: { ...qa, ...delta }, encoding: 'utf8'})
const rejectedConfigurations = [
  {QA_DISPOSABLE_DATABASE_URL:''}, {QA_EXPECTED_DATABASE_HOST:''}, {QA_EXPECTED_DATABASE_HOST:'dpg-test-b'},
  {QA_DISPOSABLE_DATABASE_URL:'postgresql://mefit_compatibility_qa:fixture@dpg-existing/mefit_compatibility_qa'},
  {QA_DISPOSABLE_DATABASE_URL:'postgresql://postgres:fixture@dpg-test-a/mefit'},
  {QA_DISPOSABLE_DATABASE_URL:'postgresql://postgres:fixture@aws.pooler.supabase.com/postgres'},
  {SUPABASE_URL:'https://rhvzbhlnoimvkzpyrgyn.supabase.co'}, {SUPABASE_URL:'https://vudfodfzvzsjhnjbyzch.supabase.co'},
  {OIDC_ISSUER:'https://mefit-auth-sukumar.onrender.com/realms/mefit'}, {OIDC_AUDIENCE:'mefit-api'},
  {SUPABASE_JWKS_URL:'https://other.invalid/jwks'}, {SUPABASE_JWT_ISSUER:'https://other.invalid'},
  {SUPABASE_PUBLISHABLE_KEY:'sb_secret_fixture'}, {PGOPTIONS:'-c search_path=other'},
  {WEB_ORIGIN:'https://mefit-fitness-planner.vercel.app'}, {RENDER_EXTERNAL_URL:'https://mefit-api-sukumar.onrender.com'}
]
for (const [index, delta] of rejectedConfigurations.entries()) {
  test(`rejects ${Object.keys(delta).join(', ')} fixture ${index + 1} before npm`, () => {
    const result = run(delta)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /QA startup refused/)
    assert.equal(existsSync(log), false)
  })
}

test('a migration failure prevents API startup', () => {
  assert.equal(run({ MIGRATION_RESULT: '9' }).status, 9)
  assert.equal(readFileSync(log, 'utf8'), `db:deploy ${qa.QA_DISPOSABLE_DATABASE_URL}\n`)
})

test('migration and API startup use the same verified binding', () => {
  writeFileSync(log, '')
  assert.equal(run({}).status, 0)
  assert.equal(readFileSync(log, 'utf8'), `db:deploy ${qa.QA_DISPOSABLE_DATABASE_URL}\nstart ${qa.QA_DISPOSABLE_DATABASE_URL}\n`)
})
