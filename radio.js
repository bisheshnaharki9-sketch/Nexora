/* radio.js — real AI comms with neural voice.
   Whisper for transcription, gpt-oss-120b for replies, Groq PlayAI for voice. */

(function () {
  const canvas = document.getElementById('radio-wave');
  const btn = document.getElementById('radio-btn');
  const status = document.getElementById('radio-status');
  const feed = document.getElementById('feed');
  if (!canvas || !btn) return;

  const GROQ_KEY = window.GROQ_KEY || '';
  const GROQ = 'https://api.groq.com/openai/v1';
  const VOICE = 'Fritz-PlayAI';   // deep male. try: Arista-PlayAI, Atlas-PlayAI, Celeste-PlayAI

  const g = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---------- audio context + mic ---------- */

  let actx = null;
  let analyser = null;
  let data = null;
  let stream = null;

  async function initAudio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') await actx.resume();
    if (stream) return true;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      const src = actx.createMediaStreamSource(stream);
      analyser = actx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      data = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
      return true;
    } catch (err) {
      console.warn('mic denied:', err.message);
      return false;
    }
  }

  /* ---------- radio sound effects ---------- */

  let noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const len = actx.sampleRate * 2;
    noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function squelch() {
    if (!actx) return;
    const now = actx.currentTime;
    const src = actx.createBufferSource();
    src.buffer = getNoise();
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 3;
    const gain = actx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.09);
    src.connect(bp).connect(gain).connect(actx.destination);
    src.start(now);
    src.stop(now + 0.12);
  }

  let staticSrc = null, staticGain = null;

  function startStatic() {
    if (!actx || staticSrc) return;
    staticSrc = actx.createBufferSource();
    staticSrc.buffer = getNoise();
    staticSrc.loop = true;
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.2;
    staticGain = actx.createGain();
    staticGain.gain.value = 0.006;
    staticSrc.connect(bp).connect(staticGain).connect(actx.destination);
    staticSrc.start();
  }

  function stopStatic() {
    if (!staticSrc) return;
    const now = actx.currentTime;
    staticGain.gain.cancelScheduledValues(now);
    staticGain.gain.setValueAtTime(staticGain.gain.value, now);
    staticGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.1);
    staticSrc.stop(now + 0.15);
    staticSrc = null;
    staticGain = null;
  }

  function rogerBeep() {
    if (!actx) return;
    const now = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1400;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /* ---------- groq: transcribe ---------- */

  async function transcribe(blob) {
    const fd = new FormData();
    fd.append('file', blob, 'transmission.webm');
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('language', 'en');
    fd.append('response_format', 'json');

    const r = await fetch(GROQ + '/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + GROQ_KEY },
      body: fd
    });
    if (!r.ok) throw new Error('whisper ' + r.status);
    const j = await r.json();
    return (j.text || '').trim();
  }

  /* ---------- groq: respond ---------- */

  async function respond(userText) {
    const r = await fetch(GROQ + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + GROQ_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.7,
        max_tokens: 250,
        messages: [
          {
            role: 'system',
            content:
              'You are KESTREL, a radio operator on a tactical net. ' +
              'Answer ANY question the user asks — science, math, history, coding, geography, ' +
              'everyday stuff, anything. Be helpful, accurate, and direct. ' +
              'Reply in 2-5 short sentences. Use plain language. ' +
              'Start with "Copy" or "Roger" occasionally and end with "Over" or "Out" occasionally, ' +
              'but always answer the actual question. If you do not know something, say so. ' +
              'Never refuse a reasonable question.'
          },
          { role: 'user', content: userText }
        ]
      })
    });
    if (!r.ok) throw new Error('llm ' + r.status);
    const j = await r.json();
    return j.choices[0].message.content.trim();
  }

  /* ---------- groq: TTS ---------- */

  async function tts(text) {
    const r = await fetch(GROQ + '/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + GROQ_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'playai-tts',
        voice: VOICE,
        input: text,
        response_format: 'wav'
      })
    });
    if (!r.ok) throw new Error('tts ' + r.status);
    return await r.arrayBuffer();
  }

  /* ---------- feed ---------- */

  function logLine(who, text, hot) {
    if (!feed) return;
    const li = document.createElement('li');
    if (hot) li.className = 'hot';
    li.textContent =
      new Date().toLocaleTimeString('en-GB', { hour12: false }) +
      '  ' + who + ': ' + text;
    feed.prepend(li);
    while (feed.children.length > 40) feed.lastChild.remove();
  }

  /* ---------- speak via groq TTS, fall back to speechSynthesis ---------- */

  async function speak(text) {
    startStatic();

    try {
      const buf = await tts(text);
      if (!actx) throw new Error('no actx');
      const decoded = await actx.decodeAudioData(buf.slice(0));
      const src = actx.createBufferSource();
      src.buffer = decoded;

      // route TTS through a bandpass to give it a radio quality
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.7;

      const hp = actx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 400;

      const gain = actx.createGain();
      gain.gain.value = 0.95;

      src.connect(bp).connect(hp).connect(gain).connect(actx.destination);
      src.onended = () => {
        stopStatic();
        setTimeout(rogerBeep, 120);
      };
      src.start();
      return;
    } catch (err) {
      console.warn('groq tts failed, falling back:', err.message);
    }

    // fallback: browser TTS
    if (!('speechSynthesis' in window)) {
      stopStatic();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 0.3;
    u.volume = 0.8;
    u.onend = () => { stopStatic(); setTimeout(rogerBeep, 120); };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* ---------- respond flow ---------- */

  async function aiRespond(userText) {
    logLine('YOU', userText);

    if (!GROQ_KEY) {
      logLine('KESTREL', 'Radio offline. Groq key missing.', true);
      return;
    }

    logLine('KESTREL', '...');

    try {
      const reply = await respond(userText);
      if (feed && feed.firstChild) feed.firstChild.remove();
      logLine('KESTREL', reply, true);
      squelch();
      setTimeout(() => speak(reply), 120);
    } catch (err) {
      if (feed && feed.firstChild) feed.firstChild.remove();
      logLine('KESTREL', 'Comms failure: ' + err.message, true);
    }
  }

  /* ---------- transmit ---------- */

  let transmitting = false;
  let recorder = null;
  let chunks = [];

  async function startTX() {
    if (transmitting) return;
    transmitting = true;

    const ok = await initAudio();
    squelch();
    setTimeout(startStatic, 40);

    status.textContent = 'TX';
    status.className = 'tx';
    btn.classList.add('tx');
    btn.textContent = 'TRANSMITTING';

    if (!ok || !window.MediaRecorder) return;

    chunks = [];
    try {
      recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      recorder.start();
    } catch (err) {
      console.warn('recorder failed:', err.message);
    }
  }

  function endTX() {
    if (!transmitting) return;
    transmitting = false;

    squelch();
    stopStatic();

    status.textContent = 'RX';
    status.className = 'rx';
    btn.classList.remove('tx');
    btn.textContent = 'HOLD TO TRANSMIT';

    if (!recorder || recorder.state === 'inactive') return;

    const rec = recorder;
    recorder = null;

    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      chunks = [];
      if (blob.size < 2000) {
        logLine('SYS', 'transmission too short', true);
        return;
      }
      try {
        const text = await transcribe(blob);
        if (!text) {
          logLine('SYS', 'no speech detected', true);
          return;
        }
        aiRespond(text);
      } catch (err) {
        logLine('SYS', 'STT failed: ' + err.message, true);
      }
    };

    rec.stop();
  }

  /* ---------- draw ---------- */

  function draw() {
    requestAnimationFrame(draw);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const mid = h / 2;

    g.clearRect(0, 0, w, h);

    g.strokeStyle = 'rgba(127,255,203,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(w, mid);
    g.stroke();

    if (transmitting && analyser && data) {
      analyser.getByteTimeDomainData(data);
      g.strokeStyle = 'rgba(127,255,203,0.95)';
      g.lineWidth = 1.4;
      g.beginPath();
      const step = Math.floor(data.length / w);
      for (let x = 0; x < w; x++) {
        const v = (data[x * step] - 128) / 128;
        const y = mid + v * (mid - 6);
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.strokeStyle = 'rgba(127,255,203,0.18)';
      g.lineWidth = 5;
      g.stroke();
    } else if (transmitting) {
      const now = performance.now();
      g.strokeStyle = 'rgba(127,255,203,0.6)';
      g.lineWidth = 1.4;
      g.beginPath();
      for (let x = 0; x <= w; x++) {
        const p = x / w;
        const taper = Math.sin(p * Math.PI);
        const wave = Math.sin(p * Math.PI * 14 + now * 0.005) * 0.6;
        const y = mid + wave * (mid - 6) * taper;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }

  btn.addEventListener('mousedown', (e) => { e.preventDefault(); startTX(); });
  btn.addEventListener('mouseup', endTX);
  btn.addEventListener('mouseleave', endTX);
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); startTX(); });
  btn.addEventListener('touchend', (e) => { e.preventDefault(); endTX(); });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyV' && !e.repeat) { e.preventDefault(); startTX(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyV') { e.preventDefault(); endTX(); }
  });

  draw();
})();