#!/usr/bin/env node
// Cross-model consult helper — lets any agent ask Gemini or Hermes for a
// second opinion. Keys come from environment secrets, never from the repo:
//   GEMINI_API_KEY      → Google AI Studio key (aistudio.google.com/apikey)
//   OPENROUTER_API_KEY  → OpenRouter key (openrouter.ai/keys), used for Hermes
// Network policy must allow: generativelanguage.googleapis.com, openrouter.ai
//
// Usage:
//   node tools/llm.mjs gemini "prompt..."            (gemini-2.5-pro)
//   node tools/llm.mjs gemini-flash "prompt..."      (gemini-2.5-flash)
//   node tools/llm.mjs hermes "prompt..."            (nousresearch/hermes-4-405b)
//   echo "long prompt" | node tools/llm.mjs gemini -

const [, , model, ...rest] = process.argv;
let prompt = rest.join(' ');
if (prompt === '-' || !prompt) {
  prompt = await new Promise((res) => {
    let d = '';
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => res(d.trim()));
  });
}
if (!model || !prompt) {
  console.error('usage: node tools/llm.mjs <gemini|gemini-flash|hermes> "prompt" (or - for stdin)');
  process.exit(1);
}

async function gemini(modelId) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set (add it as an environment secret)');
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? JSON.stringify(j);
}

async function openrouter(modelId) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set (add it as an environment secret)');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? JSON.stringify(j);
}

const routes = {
  gemini: () => gemini('gemini-2.5-pro'),
  'gemini-flash': () => gemini('gemini-2.5-flash'),
  hermes: () => openrouter('nousresearch/hermes-4-405b'),
};

const run = routes[model];
if (!run) {
  console.error(`unknown model "${model}" — use one of: ${Object.keys(routes).join(', ')}`);
  process.exit(1);
}
try {
  console.log(await run());
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}
