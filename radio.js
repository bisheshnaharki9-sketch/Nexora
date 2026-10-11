/* radio.js — real walkie-talkie.
   Mic input drives the waveform. AI speaks back via speechSynthesis.
   Firefox can't do speech recognition, so the AI doesn't parse your
   words — it reacts to the fact that you transmitted. */

(function () {
  const canvas = document.getElementById('radio-wave');
  const btn = document.getElementById('radio-btn');
  const status = document.getElementById('radio-status');
  const feed = document.getElementById('feed');
  if (!canvas || !btn) return;

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
  let micReady = false;

  async function initAudio() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (actx.state === 'suspended') await actx.resume();

    if (micReady) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      const src = actx.createMediaStreamSource(stream);
      analyser = actx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      data = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
      // do NOT connect to destination — that causes feedback howl
      micReady = true;
    } catch (err) {
      micReady = false;
      console.warn('mic denied:', err.message);
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
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.08);
    src.connect(bp).connect(gain).connect(actx.destination);
    src.start(now);
    src.stop(now + 0.12);
  }

  let staticSrc = null;
  let staticGain = null;

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

  /* ---------- AI voice ---------- */

  const LINES = [
    'Copy that, command.',
    'Affirmative. Holding position.',
    'Moving to grid reference seven.',
    'Understood. Eyes on target.',
    'Recon reports negative contact.',
    'Copy. Adjusting heading.',
    'Waiting on your next call.',
    'Solid copy. Over.'
  ];

  function aiRespond() {
    const line = LINES[Math.floor(Math.random() * LINES.length)];

    if (feed) {
      const li = document.createElement('li');
      li.className = 'hot';
      li.textContent =
        new Date().toLocaleTimeString('en-GB', { hour12: false }) +
        '  KESTREL: ' + line;
      feed.prepend(li);
      while (feed.children.length > 40) feed.lastChild.remove();
    }

    if (!('speechSynthesis' in window)) return;

    startStatic();

    const u = new SpeechSynthesisUtterance(line);
    u.rate = 0.82;
    u.pitch = 0.4;
    u.volume = 0.7;

    const voices = speechSynthesis.getVoices();
    const pick =
      voices.find(v => /^en/i.test(v.lang) && /male|david|daniel|alex|fred/i.test(v.name)) ||
      voices.find(v => /^en/i.test(v.lang));
    if (pick) u.voice = pick;

    u.onend = () => stopStatic();

    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* ---------- transmit state ---------- */

  let transmitting = false;

  async function startTX() {
    if (transmitting) return;
    transmitting = true;
    await initAudio();
    squelch();
    setTimeout(startStatic, 40);

    status.textContent = 'TX';
    status.className = 'tx';
    btn.classList.add('tx');
    btn.textContent = 'TRANSMITTING';
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

    // brief delay, then the AI answers
    setTimeout(() => {
      squelch();
      setTimeout(aiRespond, 120);
    }, 400);
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
      // real microphone waveform
      analyser.getByteTimeDomainData(data);

      g.strokeStyle = 'rgba(127,255,203,0.95)';
      g.lineWidth = 1.4;
      g.beginPath();

      const step = Math.floor(data.length / w);
      for (let x = 0; x < w; x++) {
        const v = (data[x * step] - 128) / 128;   // -1 .. 1
        const y = mid + v * (mid - 6);
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();

      // soft glow
      g.strokeStyle = 'rgba(127,255,203,0.18)';
      g.lineWidth = 5;
      g.stroke();
    } else if (transmitting) {
      // mic denied — synthetic fallback
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

  /* ---------- input ---------- */

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