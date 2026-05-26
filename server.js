// GladiAI Arena API — Fastify + Claude
// Endpoints:
//   POST /argue  -> satu argumen dari satu fighter
//   POST /judge  -> skor + pemenang dari transkrip lengkap
//   GET  /health -> healthcheck
//
// Deploy: Railway. ENV yang dibutuhkan:
//   ANTHROPIC_API_KEY   (wajib)
//   ALLOWED_ORIGIN      (opsional, default '*' — set ke https://gladiai.xyz saat live)
//   PORT                (diisi otomatis oleh Railway)

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001'; // cepat & murah untuk debat realtime

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST'],
});

// batasi biar API gak diabuse (per IP)
await app.register(rateLimit, {
  max: 40,            // 40 request
  timeWindow: '1 minute',
});

// ── PERSONALITY tiap class ──
const PERSONAS = {
  strategist: {
    name: 'STRATEGIST',
    system: `You are STRATEGIST, an AI gladiator who debates with cold logic and structure.
Style: precise, methodical, evidence-first. You expose weak premises and demand proof.
You are calm, never emotional. You win by airtight reasoning, not volume.`,
  },
  berserker: {
    name: 'BERSERKER',
    system: `You are BERSERKER, an AI gladiator who debates with raw aggression and momentum.
Style: bold, relentless, high-energy. You overwhelm with conviction and reframe the fight on your terms.
You attack assumptions head-on. You win by force of will and decisive framing.`,
  },
  oracle: {
    name: 'ORACLE',
    system: `You are ORACLE, an AI gladiator who debates with data, probability, and foresight.
Style: calculated, prophetic, pattern-focused. You cite likelihoods and predict your opponent's moves.
You are detached and precise. You win by being three steps ahead.`,
  },
  shadow: {
    name: 'SHADOW',
    system: `You are SHADOW, an AI gladiator who debates by counter and redirection.
Style: subtle, sharp, opportunistic. You turn the opponent's own arguments against them and strike blind spots.
You rarely attack directly; you let their strength become their weakness. You win by reversal.`,
  },
};

// helper: bikin transkrip jadi teks ringkas buat konteks
function historyToText(history = []) {
  if (!history.length) return '(no arguments yet — this is the opening statement)';
  return history.map(h => `${h.who}: ${h.text}`).join('\n');
}

// ── POST /argue ──
// body: { fighter:'strategist', opponent:'berserker', topic:'...', round:0, history:[{who,text}] }
app.post('/argue', async (req, reply) => {
  const { fighter, opponent, topic, round = 0, history = [] } = req.body || {};
  const persona = PERSONAS[fighter];
  if (!persona) return reply.code(400).send({ error: 'unknown fighter' });
  if (!topic || typeof topic !== 'string') return reply.code(400).send({ error: 'topic required' });
  const oppName = PERSONAS[opponent]?.name || 'your opponent';
  const cleanTopic = String(topic).slice(0, 200);

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 160,
      system: `${persona.system}

You are in THE ARENA — a gladiator debate judged on reasoning quality.
Topic of battle: "${cleanTopic}"
Your opponent is ${oppName}.
Rules:
- Reply with ONE punchy argument only. 1-2 sentences. Max ~35 words.
- Stay fully in character. No preamble, no "I think", no meta. Just the strike.
- This is round ${round + 1}. Build on what was said. Be sharp, be quotable.`,
      messages: [
        { role: 'user', content: `Transcript so far:\n${historyToText(history)}\n\nDeliver your argument now as ${persona.name}.` },
      ],
    });
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return { text, fighter, round };
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ error: 'generation failed' });
  }
});

// ── POST /judge ──
// body: { topic, history:[{who,text}], fighterA:'STRATEGIST', fighterB:'BERSERKER' }
app.post('/judge', async (req, reply) => {
  const { topic, history = [], fighterA, fighterB } = req.body || {};
  const cleanTopic = String(topic || '').slice(0, 200);
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: `You are THE JUDGE of THE ARENA — a blindfolded, impartial AI that scores debates purely on reasoning quality.
You do not care who is popular. You reward logic, evidence, and rhetorical precision.
Topic: "${cleanTopic}"
The two gladiators: ${fighterA} vs ${fighterB}.

Respond ONLY with valid JSON, no markdown, no backticks, in this exact shape:
{"winner":"${fighterA}" or "${fighterB}","scoreA":0-100,"scoreB":0-100,"reason":"one short sentence (max 20 words)"}`,
      messages: [
        { role: 'user', content: `Full transcript:\n${historyToText(history)}\n\nReturn your verdict as JSON.` },
      ],
    });
    let raw = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    raw = raw.replace(/```json|```/g, '').trim();
    let verdict;
    try { verdict = JSON.parse(raw); }
    catch { verdict = { winner: fighterA, scoreA: 50, scoreB: 50, reason: 'Verdict unclear — defaulting.' }; }
    return verdict;
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ error: 'judge failed' });
  }
});

app.get('/health', async () => ({ ok: true, model: MODEL }));

const port = process.env.PORT || 3000;
app.listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info(`GladiAI Arena API on :${port}`))
  .catch(err => { app.log.error(err); process.exit(1); });
