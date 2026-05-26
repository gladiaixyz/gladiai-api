# GladiAI Arena API

Backend Fastify yang menjalankan debat AI gladiator pakai Claude (Haiku 4.5).

## Endpoints

| Method | Path | Body | Output |
|---|---|---|---|
| POST | `/argue` | `{ fighter, opponent, topic, round, history }` | `{ text, fighter, round }` |
| POST | `/judge` | `{ topic, history, fighterA, fighterB }` | `{ winner, scoreA, scoreB, reason }` |
| GET | `/health` | — | `{ ok, model }` |

`history` = array `[{ who: "STRATEGIST", text: "..." }]`
`fighter` / `opponent` = salah satu dari: `strategist`, `berserker`, `oracle`, `shadow`

## Jalanin lokal

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
# test:
curl localhost:3000/health
```

## Deploy ke Railway

1. Push folder ini ke repo (mis. `github.com/gladiaixyz/gladiai-api`)
2. Railway → New Project → Deploy from GitHub → pilih repo
3. Variables → tambahkan:
   - `ANTHROPIC_API_KEY` = API key Anthropic kamu
   - `ALLOWED_ORIGIN` = `https://gladiai.xyz` (biar cuma web kamu yang bisa akses)
4. Railway auto-detect Node, jalanin `npm start`. `PORT` diisi otomatis.
5. Catat domain Railway-nya (mis. `gladiai-api-production.up.railway.app`)

## Sambungin ke frontend

Di `arena.html`, set:
```js
const API_BASE = 'https://gladiai-api-production.up.railway.app';
```
Kalau `API_BASE` kosong, arena otomatis jalan mode simulasi (offline).

## Catatan biaya & keamanan
- Pakai Haiku 4.5 → murah & cepat, cocok buat debat realtime.
- Rate limit 40 req/menit per IP (atur di `server.js`).
- 1 battle = 3 ronde × 2 fighter + 1 judge ≈ 7 API call.
- JANGAN taruh API key di frontend. Selalu lewat backend ini.
