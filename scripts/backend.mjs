import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const python = resolve(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const envFile = resolve(root, '.env')

if (existsSync(envFile)) process.loadEnvFile(envFile)

if (!existsSync(python)) {
  console.error('Python environment not found. Create .venv and install requirements.txt first; see README.md.')
  process.exit(1)
}

const result = spawnSync(python, [
  'backend/manage.py', 'runserver', '127.0.0.1:8000', ...process.argv.slice(2),
], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DJANGO_DEBUG: process.env.DJANGO_DEBUG ?? 'true' },
})

if (result.error) console.error(`Unable to start Django: ${result.error.message}`)
process.exit(result.status ?? 1)
