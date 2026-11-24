// Generates one ElevenLabs mp3 per scene line in voiceover.json.
// Usage: ELEVENLABS_API_KEY=... npm run voice      (or put it in apps/promo/.env)
// Optional: ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// tiny .env loader (apps/promo/.env)
const envFile = join(root, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const key = process.env.ELEVENLABS_API_KEY
if (!key) {
  console.error('Missing ELEVENLABS_API_KEY. Set it in your shell or in apps/promo/.env')
  process.exit(1)
}
const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'
const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
const only = process.argv.slice(2) // optional: scene ids to regenerate

const lines = JSON.parse(readFileSync(join(root, 'voiceover.json'), 'utf8'))
const outDir = join(root, 'public', 'voice')
mkdirSync(outDir, { recursive: true })

const manifestPath = join(outDir, 'manifest.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}

const BYTES_PER_SEC = 16000 // mp3_44100_128

for (const [id, text] of Object.entries(lines)) {
  if (only.length && !only.includes(id)) continue
  process.stdout.write(`${id}: generating... `)
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true },
    }),
  })
  if (!res.ok) {
    console.error(`\nElevenLabs error ${res.status}: ${await res.text()}`)
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(join(outDir, `${id}.mp3`), buf)
  manifest[id] = Math.round((buf.length / BYTES_PER_SEC) * 100) / 100
  console.log(`${manifest[id]}s`)
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log('Done. Scene lengths will now follow the voice. Run: npm run studio')
