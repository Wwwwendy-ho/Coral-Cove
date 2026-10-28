/*
 * Coral Cove's Claude helper: a tiny Cloudflare Worker that lets the Library's tutor, worksheet maker and
 * feedback tools use Claude when the device is online. It keeps your Anthropic API key on Cloudflare, so the
 * key never appears in the public app. Without it (or offline), every Library feature uses its offline version.
 *
 * Setup (about 10 minutes; see README.md, "Claude helper"):
 *   1. Cloudflare dashboard -> Workers & Pages -> Create -> Worker. Paste this whole file and Deploy.
 *   2. Worker -> Settings -> Variables and Secrets, add:
 *        ANTHROPIC_API_KEY  (Secret)  your key from console.anthropic.com
 *        CORAL_CODE         (Secret)  any long passphrase; you type the same one into Coral Cove
 *        MODEL              (Text, optional) defaults to claude-opus-5-5
 *        ALLOW_ORIGIN       (Text, optional) e.g. https://wwwwendy-ho.github.io  (defaults to *)
 *   3. In Coral Cove: Library -> Settings (grown-up maths question) -> paste the worker's URL and the passphrase.
 *
 * Every request costs a little on your Anthropic bill. Replies are kept short (max_tokens below) to keep it low.
 * Written as plain fetch (no SDK) so it can be pasted straight into the Cloudflare dashboard without a build step.
 */

const API = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-5-5';

// Applied to every request, before the app's own instructions for the task.
const SAFETY = [
  'You are Shelly, a warm, patient tutor inside Coral Cove, a learning app for a young child and her family.',
  'Use short sentences and simple words a young child can follow. Be encouraging and kind; never shame a mistake.',
  'Keep everything age-appropriate. Do not ask for or repeat personal details such as full names, addresses, schools or photos of people.',
  'If a question is not suitable for a child, gently say it is a question for a grown-up and offer something related that is fine to talk about.',
  'Do not give medical, legal or safety-critical advice; suggest asking a trusted grown-up.'
].join(' ');

// What each Library tool may ask for: a size cap for the reply and how much thinking effort to spend.
const TASKS = {
  chat:      { max_tokens: 1200, effort: 'low' },
  explain:   { max_tokens: 1200, effort: 'low' },
  worksheet: { max_tokens: 6000, effort: 'medium' },
  feedback:  { max_tokens: 2000, effort: 'medium' },
  photo:     { max_tokens: 4000, effort: 'medium' }
};

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-coral-code',
    'Access-Control-Max-Age': '86400'
  };
}
function reply(env, status, body) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'content-type': 'application/json' }, cors(env)) });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (request.method !== 'POST') return reply(env, 405, { error: 'POST only' });
    if (!env.ANTHROPIC_API_KEY || !env.CORAL_CODE) return reply(env, 500, { error: 'The helper is missing ANTHROPIC_API_KEY or CORAL_CODE.' });
    if (request.headers.get('x-coral-code') !== env.CORAL_CODE) return reply(env, 401, { error: 'Wrong passphrase.' });

    let body;
    try { body = await request.json(); } catch (e) { return reply(env, 400, { error: 'Bad JSON.' }); }
    const task = TASKS[body.task] ? body.task : 'chat';
    const messages = Array.isArray(body.messages) ? body.messages.slice(-24) : [];   // the last few turns are plenty
    if (!messages.length) return reply(env, 400, { error: 'No messages.' });
    // Only text and image content goes through, and only from the user and assistant roles.
    const clean = messages.map(function (m) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      if (typeof m.content === 'string') return { role, content: m.content.slice(0, 8000) };
      const parts = (Array.isArray(m.content) ? m.content : []).filter(function (p) {
        return p && (p.type === 'text' || (p.type === 'image' && p.source && p.source.type === 'base64' && /^image\/(png|jpeg|webp|gif)$/.test(p.source.media_type)));
      }).map(function (p) { return p.type === 'text' ? { type: 'text', text: String(p.text).slice(0, 8000) } : p; });
      return { role, content: parts.length ? parts : '' };
    });

    const req = {
      model: env.MODEL || DEFAULT_MODEL,
      max_tokens: TASKS[task].max_tokens,
      system: SAFETY + (body.system ? '\n\n' + String(body.system).slice(0, 6000) : ''),
      messages: clean,
      output_config: { effort: TASKS[task].effort },
      fallbacks: 'default'   // if a request is declined, the API re-runs it on a fallback model instead of failing
    };
    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2026-10-21',
          'anthropic-beta': 'server-side-fallback-2026-07-01'
        },
        body: JSON.stringify(req)
      });
    } catch (e) {
      return reply(env, 502, { error: 'Could not reach Claude.' });
    }
    const data = await res.json().catch(function () { return null; });
    if (!res.ok || !data) return reply(env, res.status === 429 ? 429 : 502, { error: (data && data.error && data.error.message) || 'Claude returned an error.' });
    if (data.stop_reason === 'refusal') return reply(env, 200, { text: "That's one to ask a grown-up about. Want to try a different question?", refused: true });
    const text = (data.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim();
    return reply(env, 200, { text: text, truncated: data.stop_reason === 'max_tokens' });
  }
};
