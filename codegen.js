/* codegen.js — INTEL panel.
   Ask anything military: doctrine, equipment, history, tactics theory.
   Answers via Groq. Same key as radio.js. */

(function () {
  const input = document.getElementById('forge-prompt');
  const btn = document.getElementById('forge-btn');
  const out = document.getElementById('forge-out');
  const status = document.getElementById('forge-status');
  if (!input || !btn || !out) return;

  const GROQ_KEY = window.GROQ_KEY || '';
  const GROQ = 'https://api.groq.com/openai/v1';

  const SYSTEM =
    'You are INTEL, a military knowledge assistant inside a tactical dashboard. ' +
    'You answer questions about military topics: doctrine, tactics theory, ' +
    'equipment specs, aircraft and vehicles, unit organization, military history, ' +
    'ranks and structure, logistics, strategy, and defense technology. ' +
    'Rules: ' +
    '1. Answer accurately and factually. Cite dates, specs, and names when relevant. ' +
    '2. Reply in 3-6 short sentences unless the user asks for more detail. ' +
    '3. Use plain language, not jargon dumps. ' +
    '4. If you do not know something or it is classified, say so plainly. ' +
    '5. Never give operational instructions for real-world harm, weapons construction, ' +
    'or targeting. Redirect to public knowledge instead. ' +
    '6. Stay on military topics. If asked something unrelated, politely redirect.';

  const history = [];

  async function ask(prompt) {
    history.push({ role: 'user', content: prompt });
    // keep last 8 turns so we don't blow the token budget
    while (history.length > 16) history.shift();

    const r = await fetch(GROQ + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + GROQ_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.5,
        max_tokens: 600,
        messages: [{ role: 'system', content: SYSTEM }, ...history]
      })
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120));
    }
    const j = await r.json();
    const reply = j.choices[0].message.content.trim();
    history.push({ role: 'assistant', content: reply });
    return reply;
  }

  let busy = false;

  async function run() {
    if (busy) return;
    const prompt = input.value.trim();
    if (!prompt) return;
    if (!GROQ_KEY) {
      out.textContent = 'Groq key missing. Add key.js.';
      return;
    }

    busy = true;
    btn.disabled = true;
    btn.textContent = 'QUERYING...';
    status.textContent = 'BUSY';
    status.className = 'busy';

    const prev = out.textContent;
    out.textContent = prev + '\n\n> ' + prompt + '\n\n...';

    try {
      const reply = await ask(prompt);
      out.textContent = prev + '\n\n> ' + prompt + '\n\n' + reply;
      out.scrollTop = out.scrollHeight;
      status.textContent = 'DONE';
      status.className = 'done';
      input.value = '';
    } catch (err) {
      out.textContent = prev + '\n\n> ' + prompt + '\n\n[error] ' + err.message;
      status.textContent = 'ERR';
      status.className = 'err';
    } finally {
      busy = false;
      btn.disabled = false;
      btn.textContent = 'ASK';
    }
  }

  btn.addEventListener('click', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run();
    }
  });

  const copyBtn = document.getElementById('forge-copy');
  if (copyBtn) {
    copyBtn.textContent = 'CLEAR';
    copyBtn.addEventListener('click', () => {
      out.textContent = '// awaiting query';
      history.length = 0;
    });
  }
})();