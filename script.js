(function () {
  // =========================================================
  // 1. PASTE YOUR FIREBASE CONFIG HERE (see chat instructions)
  // =========================================================
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDMgfeX8HVamnpfDf0nsMUdkTEhkt3ORe0",
    authDomain: "eliathessa.firebaseapp.com",
    databaseURL: "https://eliathessa-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "eliathessa",
    storageBucket: "eliathessa.firebasestorage.app",
    messagingSenderId: "972356523534",
    appId: "1:972356523534:web:5bf06930a0d001df9dce5f"
  };

  const ROOM_CODE = "us-two-glow";
  const PARTNER_NAMES = ["You", "Bae"];

  // Words/phrases treated as "high tone" — combined with ALL-CAPS detection to
  // trigger a brief emotion emote next to the bubble (see feature near addBubble).
  const HIGH_TONE_WORDS = [
    'bodoh','goblok','bego','tolol','sialan','anjing','kampret','muak','benci',
    'diem lu','udah gak usah','capek sama kamu','stress banget sama kamu',
    'shut up','hate you','stupid','leave me alone','fuck you','annoying banget'
  ];

  // Reuse the same word list to detect a heating-up argument (feature 5, cooldown mode).
  const NEGATIVE_WORDS = HIGH_TONE_WORDS;
  // How long the cooldown overlay stays up once triggered.
  const COOLDOWN_MS = 3 * 60 * 1000;

  const MAX_IMAGE_DIM = 900;
  const MAX_VIDEO_BYTES = 8 * 1024 * 1024; // 8MB raw, base64 in Realtime DB

  const SONGS = {
    happy: [{t:'Happy', a:'Pharrell Williams'}, {t:'Sunday Best', a:'Surfaces'}, {t:'Walking On Sunshine', a:'Katrina & The Waves'}],
    love:  [{t:'Perfect', a:'Ed Sheeran'}, {t:'All of Me', a:'John Legend'}, {t:'Sampai Jadi Debu', a:'Banda Neira'}],
    sad:   [{t:'Fix You', a:'Coldplay'}, {t:'Someone Like You', a:'Adele'}, {t:'Hujan Bulan Juni', a:'Ari Reda'}],
    neutral: [{t:'Golden Hour', a:'JVKE'}, {t:'Malibu', a:'Anne-Marie'}, {t:'Sunset Lover', a:'Petit Biscuit'}]
  };

  const RINDU_STAGES = [
    { max: 30 * 60 * 1000, emoji: '🌸', label: 'just talked' },
    { max: 3 * 60 * 60 * 1000, emoji: '🌿', label: 'still fresh' },
    { max: 12 * 60 * 60 * 1000, emoji: '🌱', label: 'starting to miss them' },
    { max: 24 * 60 * 60 * 1000, emoji: '🍂', label: "it's been a while" },
    { max: Infinity, emoji: '🥀', label: 'needs some love, reach out to them!' }
  ];

  // ---------- DOM ----------
  const setupScreen = document.getElementById('setupScreen');
  const setupMissingConfig = document.getElementById('setupMissingConfig');
  const pairButtons = document.getElementById('pairButtons');
  const appScreen = document.getElementById('appScreen');
  const roomTitle = document.getElementById('roomTitle');
  const presenceLine = document.getElementById('presenceLine');
  const shareBtn = document.getElementById('shareBtn');

  const chat = document.getElementById('chat');
  const composer = document.getElementById('composer');
  const input = document.getElementById('msgInput');
  const orb = document.getElementById('orb');
  const orbFace = document.getElementById('orbFace');
  const orbBubble = document.getElementById('orbBubble');
  const weatherBadge = document.getElementById('weatherBadge');
  const loveFill = document.getElementById('loveFill');
  const typingRow = document.getElementById('typingRow');
  const typingLabel = document.getElementById('typingLabel');
  const flash = document.getElementById('flash');
  const firefliesWrap = document.getElementById('fireflies');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');
  const notifyBtn = document.getElementById('notifyBtn');
  const replyPreview = document.getElementById('replyPreview');
  const replyPreviewName = document.getElementById('replyPreviewName');
  const replyPreviewText = document.getElementById('replyPreviewText');
  const replyPreviewCancel = document.getElementById('replyPreviewCancel');

  const attachBtn = document.getElementById('attachBtn');
  const attachBackdrop = document.getElementById('attachBackdrop');
  const attachClose = document.getElementById('attachClose');

  let myName = '';
  let roomCode = '';
  let db = null;
  let roomRef = null;
  let love = 6;
  let milestonesHit = new Set();
  let sawFirstHugSnapshot = false;
  let replyTarget = null;

  // ---------- ambient fireflies ----------
  for (let i = 0; i < 16; i++) {
    const f = document.createElement('div');
    f.className = 'firefly';
    f.style.left = Math.random() * 100 + 'vw';
    f.style.top = Math.random() * 100 + 'vh';
    f.style.animationDuration = (6 + Math.random() * 6) + 's';
    f.style.animationDelay = (Math.random() * 5) + 's';
    firefliesWrap.appendChild(f);
  }

  // ---------- config check ----------
  const hasConfig = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL);
  if (!hasConfig) setupMissingConfig.hidden = false;

  // ---------- pairing buttons ----------
  PARTNER_NAMES.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pair-btn' + (i === 1 ? ' alt' : '');
    btn.textContent = "I'm " + name;
    btn.addEventListener('click', () => {
      if (!hasConfig) return;
      myName = name;
      roomCode = ROOM_CODE;
      enterRoom();
    });
    pairButtons.appendChild(btn);
  });

  const params = new URLSearchParams(window.location.search);
  const meIndex = params.get('me');
  if (hasConfig && meIndex !== null && PARTNER_NAMES[meIndex]) {
    myName = PARTNER_NAMES[meIndex];
    roomCode = ROOM_CODE;
    enterRoom();
  }

  function enterRoom() {
    const myIndex = PARTNER_NAMES.indexOf(myName);
    const url = new URL(window.location.href);
    url.searchParams.set('me', myIndex);
    window.history.replaceState({}, '', url);

    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    roomRef = db.ref('rooms/' + roomCode);

    setupScreen.hidden = true;
    appScreen.hidden = false;
    roomTitle.textContent = 'Glow · ' + roomCode;
    presenceLine.textContent = 'connected as ' + myName;

    attachPresence();
    attachMessages();
    attachTyping();
    attachLove();
    attachHugs();
    attachRindu();
    attachCheckin();
    attachDoodle();
    attachRace();
    attachBingo();
    attachCooldown();
    attachCountdown();
    attachBucket();
    touchLastActivity();

    addSystem('You joined "' + roomCode + '". Anything sent here reaches everyone in this room in real time.');
  }

  shareBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(window.location.href);
    shareBtn.textContent = '✅';
    setTimeout(() => { shareBtn.textContent = '🔗'; }, 1500);
  });

  function otherName() { return PARTNER_NAMES.find(n => n !== myName); }
  function safeKey(name) { return name.replace(/[.#$\[\]\/]/g, '_'); }

  // ---------- notifications ----------
  // Pings a browser notification when they message you while this tab is
  // in the background or unfocused. This only works while the tab/app is
  // still open somewhere (it uses the Notification API, not push from a
  // server) — it won't wake the app up if it's fully closed.
  const canNotify = 'Notification' in window;
  function updateNotifyBtn() {
    if (!canNotify) { notifyBtn.hidden = true; return; }
    const granted = Notification.permission === 'granted';
    notifyBtn.textContent = granted ? '🔔' : '🔕';
    notifyBtn.classList.toggle('on', granted);
    notifyBtn.title = granted ? 'Notifications are on' : 'Turn on notifications';
  }
  notifyBtn?.addEventListener('click', () => {
    if (!canNotify) return;
    if (Notification.permission === 'granted') {
      addSystem('Notifications are already on — you\'ll get a ping when they message you while you\'re away.');
      return;
    }
    if (Notification.permission === 'denied') {
      addSystem('Notifications are blocked for this site. Turn them back on from your browser/site settings.');
      return;
    }
    Notification.requestPermission().then(() => {
      updateNotifyBtn();
      addSystem(Notification.permission === 'granted'
        ? 'Notifications are on — you\'ll get a ping when they message you while you\'re away.'
        : 'Notifications are off.');
    });
  });
  updateNotifyBtn();

  function notifySnippet(m) {
    if (m.type === 'image') return '📷 sent a photo';
    if (m.type === 'video') return '🎥 sent a video';
    if (m.type === 'audio') return '🎤 sent a voice note';
    if (m.badge) return m.badge;
    return m.text || 'sent a message';
  }
  function notifyIncoming(m) {
    if (!canNotify || Notification.permission !== 'granted') return;
    // Only notify when the app isn't actively being looked at.
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    const title = m.sender + ' · Glow';
    const opts = {
      body: notifySnippet(m),
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'glow-message',
      renotify: true
    };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opts)).catch(() => {
        try { new Notification(title, opts); } catch (e) {}
      });
    } else {
      try { new Notification(title, opts); } catch (e) {}
    }
  }

  // ---------- presence ----------
  function attachPresence() {
    const myPresenceRef = roomRef.child('presence/' + safeKey(myName));
    myPresenceRef.set({ online: true, ts: Date.now() });
    myPresenceRef.onDisconnect().remove();

    roomRef.child('presence').on('value', snap => {
      const people = [];
      snap.forEach(child => { people.push(child.key); });
      const others = people.filter(p => p !== safeKey(myName));
      presenceLine.textContent = others.length ? others.join(', ') + ' is online' : 'waiting for them to join...';
    });
  }

  // ---------- mood detection + weather widget (feature 1) ----------
  const MOODS = {
    happy: { emoji: ['😂', '🤣', '😆', '😄'], words: ['haha', 'lol', 'lmao', 'funny', 'hilarious', 'wkwk'] },
    love: { emoji: ['❤️', '😍', '🥰', '💕'], words: ['love', 'miss you', 'babe', 'hug', 'kiss', 'sayang', 'kangen'] },
    sad: { emoji: ['😢', '😭', '😔', ':('], words: ['sad', 'tired', 'exhausted', 'crying', 'stressed', 'sedih', 'capek'] }
  };

  function detectMood(text) {
    const t = text.toLowerCase();
    for (const mood in MOODS) {
      const def = MOODS[mood];
      if (def.emoji.some(e => text.includes(e)) || def.words.some(w => t.includes(w))) return mood;
    }
    return 'neutral';
  }

  const ORB_FACE = { happy: '😄', love: '🥰', sad: '🥺', neutral: '☺' };
  const ORB_LINE = {
    happy: "this is fun, I'm smiling too!",
    love: 'aww, my heart just melted a little',
    sad: "sending you a hug, it'll be okay",
    neutral: "I'm here, keep talking~"
  };
  const WEATHER_ICON = { happy: '☀️', love: '🌸', sad: '🌧️', neutral: '⛅' };

  let orbBubbleTimeout;
  function setOrbMood(mood) {
    orb.classList.remove('mood-happy', 'mood-love', 'mood-sad');
    if (mood !== 'neutral') orb.classList.add('mood-' + mood);
    orbFace.textContent = ORB_FACE[mood];
    orb.classList.remove('bounce');
    void orb.offsetWidth;
    orb.classList.add('bounce');
    orbBubble.textContent = ORB_LINE[mood];
    orbBubble.classList.add('show');
    clearTimeout(orbBubbleTimeout);
    orbBubbleTimeout = setTimeout(() => orbBubble.classList.remove('show'), 2600);
    trackDailyMood(mood);
  }

  function todayKey() { return 'moodcount_' + new Date().toISOString().slice(0, 10); }
  function trackDailyMood(mood) {
    if (mood === 'neutral') return;
    const key = todayKey();
    const counts = JSON.parse(localStorage.getItem(key) || '{}');
    counts[mood] = (counts[mood] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(counts));
    updateWeatherBadge(counts);
  }
  function updateWeatherBadge(counts) {
    counts = counts || JSON.parse(localStorage.getItem(todayKey()) || '{}');
    let top = 'neutral', best = 0;
    for (const m in counts) { if (counts[m] > best) { best = counts[m]; top = m; } }
    weatherBadge.textContent = WEATHER_ICON[top];
  }
  updateWeatherBadge();

  input.addEventListener('input', () => {
    const hasText = input.value.trim().length > 0;
    sendBtn.hidden = !hasText;
    micBtn.hidden = hasText;
    if (input.value.trim().length < 2) return;
    setOrbMood(detectMood(input.value));
    if (roomRef) roomRef.child('typing/' + safeKey(myName)).set(Date.now());
  });

  // ---------- typing indicator ----------
  function attachTyping() {
    roomRef.child('typing').on('value', snap => {
      const now = Date.now();
      let othersTyping = [];
      snap.forEach(child => {
        if (child.key !== safeKey(myName) && now - child.val() < 2500) othersTyping.push(child.key);
      });
      typingRow.hidden = !othersTyping.length;
      if (othersTyping.length) typingLabel.textContent = othersTyping.join(', ') + ' is typing...';
    });
  }

  // ---------- reply-to ----------
  function replySnippet(m) {
    if (m.type === 'image') return '📷 Photo';
    if (m.type === 'video') return '🎥 Video';
    if (m.type === 'audio') return '🎤 Voice note';
    const t = (m.text || '').trim();
    if (!t) return m.badge || 'Message';
    return t.length > 60 ? t.slice(0, 60) + '…' : t;
  }
  function setReplyTarget(key, m) {
    if (!key) return;
    replyTarget = { id: key, sender: m.sender, text: replySnippet(m), type: m.type || 'text' };
    replyPreviewName.textContent = m.sender === myName ? 'You' : m.sender;
    replyPreviewText.textContent = replyTarget.text;
    replyPreview.hidden = false;
    input.focus();
  }
  function clearReplyTarget() {
    replyTarget = null;
    replyPreview.hidden = true;
  }
  replyPreviewCancel.addEventListener('click', clearReplyTarget);
  input.addEventListener('keydown', e => { if (e.key === 'Escape' && replyTarget) clearReplyTarget(); });

  function jumpToMessage(key) {
    if (!key) return;
    const target = chat.querySelector('[data-msg-key="' + CSS.escape(key) + '"]');
    if (!target) { addSystem("that message isn't loaded here anymore."); return; }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.remove('highlight-flash');
    void target.offsetWidth;
    target.classList.add('highlight-flash');
    setTimeout(() => target.classList.remove('highlight-flash'), 1200);
  }

  // ---------- chat rendering ----------
  function addBubble(m, who, key) {
    const div = document.createElement('div');
    div.className = 'bubble ' + who;
    if (key) div.dataset.msgKey = key;

    if (m.replyTo) {
      const q = document.createElement('div');
      q.className = 'reply-quote';
      const qName = document.createElement('span');
      qName.className = 'reply-quote-name';
      qName.textContent = m.replyTo.sender === myName ? 'You' : m.replyTo.sender;
      const qText = document.createElement('span');
      qText.className = 'reply-quote-text';
      qText.textContent = m.replyTo.text || '...';
      q.appendChild(qName);
      q.appendChild(qText);
      q.addEventListener('click', ev => { ev.stopPropagation(); jumpToMessage(m.replyTo.id); });
      div.appendChild(q);
    }

    if (m.badge) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = m.badge;
      div.appendChild(b);
    }
    if (m.type === 'image' && m.media) {
      const img = document.createElement('img');
      img.className = 'msg-media';
      img.src = m.media;
      div.appendChild(img);
    } else if (m.type === 'video' && m.media) {
      const vid = document.createElement('video');
      vid.className = 'msg-media';
      vid.src = m.media;
      vid.controls = true;
      div.appendChild(vid);
    } else if (m.type === 'audio' && m.media) {
      const aud = document.createElement('audio');
      aud.className = 'msg-media';
      aud.src = m.media;
      aud.controls = true;
      div.appendChild(aud);
    } else if (m.text) {
      const span = document.createElement('span');
      span.textContent = m.text;
      div.appendChild(span);
    }

    if (who !== 'system' && key) {
      const replyBtn = document.createElement('button');
      replyBtn.type = 'button';
      replyBtn.className = 'reply-btn';
      replyBtn.setAttribute('aria-label', 'Reply');
      replyBtn.textContent = '↩';
      replyBtn.addEventListener('click', ev => { ev.stopPropagation(); setReplyTarget(key, m); });
      div.appendChild(replyBtn);
    }

    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    if (m.type === 'text' || (!m.type && m.text)) maybeShowEmotionFlash(div, m.text);
    return div;
  }

  // ---------- capslock / high-tone detector -> quick 3s emote next to bubble ----------
  const HIGH_TONE_EMOTES = ['😳', '😠', '😬', '😥'];
  function isHighTone(text) {
    if (!text) return false;
    const letters = text.replace(/[^A-Za-z]/g, '');
    const isAllCaps = letters.length >= 4 && letters === letters.toUpperCase();
    const lower = text.toLowerCase();
    const hasHighToneWord = HIGH_TONE_WORDS.some(w => lower.includes(w));
    return isAllCaps || hasHighToneWord;
  }
  function maybeShowEmotionFlash(bubbleDiv, text) {
    if (!isHighTone(text)) return;
    const badge = document.createElement('span');
    badge.className = 'emotion-flash';
    badge.textContent = HIGH_TONE_EMOTES[Math.floor(Math.random() * HIGH_TONE_EMOTES.length)];
    bubbleDiv.appendChild(badge);
    setTimeout(() => badge.remove(), 3000);
  }

  function addSystem(text) {
    const div = document.createElement('div');
    div.className = 'bubble system';
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  // ---------- messages ----------
  function attachMessages() {
    let firstBatch = true;
    roomRef.child('messages').limitToLast(100).on('child_added', snap => {
      const m = snap.val();
      if (!m) return;
      const who = m.sender === myName ? 'me' : 'dia';
      addBubble(m, who, snap.key);
      if (!firstBatch && m.sender !== myName) {
        if (m.text) {
          setOrbMood(detectMood(m.text));
          checkCooldownTrigger(m.text, othersRecentNegatives);
        }
        notifyIncoming(m);
      }
    });
    setTimeout(() => { firstBatch = false; }, 800);
  }

  function sendMessage(text, badge, type, media) {
    const payload = {
      sender: myName, text: text || '', badge: badge || null,
      type: type || 'text', media: media || null, ts: Date.now()
    };
    if (replyTarget) payload.replyTo = replyTarget;
    roomRef.child('messages').push(payload);
    roomRef.child('typing/' + safeKey(myName)).remove();
    touchLastActivity();
    clearReplyTarget();
  }

  composer.addEventListener('submit', e => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val || !roomRef) return;
    setOrbMood(detectMood(val));
    sendMessage(val);
    checkOwnNegative(val);
    bumpLove(4);
    input.value = '';
    sendBtn.hidden = true;
    micBtn.hidden = false;
  });

  // ---------- love meter ----------
  function attachLove() {
    roomRef.child('love').on('value', snap => {
      const val = snap.val();
      love = typeof val === 'number' ? val : 6;
      loveFill.style.width = love + '%';
      [25, 50, 75, 100].forEach(m => {
        if (love >= m && !milestonesHit.has(m)) {
          milestonesHit.add(m);
          if (val !== null) celebrateMilestone(m);
        }
      });
    });
  }
  function bumpLove(amount) {
    roomRef.child('love').transaction(current => Math.min(100, (current || 6) + amount));
  }
  function celebrateMilestone(m) {
    const lines = { 25: 'closeness is growing! 🌱', 50: 'halfway to a full meter~ 💫', 75: 'getting closer and closer 🐣', 100: 'meter is full! you two are solid 🎉' };
    addSystem(lines[m]);
    confetti(m === 100 ? 46 : 22);
  }
  function confetti(count) {
    const colors = ['#FFC96B', '#FF87AB', '#8CE0C9', '#B7ACD9'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDuration = (2 + Math.random() * 1.5) + 's';
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 3800);
    }
  }
  loveFill.style.width = love + '%';

  // ---------- attach sheet ----------
  function openSheet(backdrop) { backdrop.hidden = false; }
  function closeSheet(backdrop) { backdrop.hidden = true; }
  attachBtn.addEventListener('click', () => openSheet(attachBackdrop));
  attachClose.addEventListener('click', () => closeSheet(attachBackdrop));
  attachBackdrop.addEventListener('click', e => { if (e.target === attachBackdrop) closeSheet(attachBackdrop); });

  // ---------- cheesy line generator ----------
  const GOMBALAN = [
    "are you a parking ticket? because you've got fine written all over you",
    "do you have a map? I keep getting lost in your eyes",
    "if you were a vegetable, you'd be a cute-cumber",
    "I was going to say something sweet, but you already stole my heart so it's just quiet in here",
    "is your name Google? because you have everything I've been searching for"
  ];
  document.getElementById('btnGombal').addEventListener('click', () => {
    if (!roomRef) return;
    const g = GOMBALAN[Math.floor(Math.random() * GOMBALAN.length)];
    sendMessage(g, 'random cheesy line 😏');
    bumpLove(3);
    closeSheet(attachBackdrop);
  });

  // ---------- hug button ----------
  const hugBtn = document.getElementById('btnHug');
  const hugRing = document.getElementById('hugRing');
  let hugTimer = null, hugProgress = 0, hugActive = false;

  function startHug(e) {
    if (e) e.preventDefault();
    if (!roomRef) return;
    hugActive = true;
    hugProgress = 0;
    hugTimer = setInterval(() => {
      hugProgress += 4;
      hugRing.style.background = 'conic-gradient(var(--pink) ' + (hugProgress * 3.6) + 'deg, transparent 0deg)';
      if (hugProgress >= 100) finishHug(true);
    }, 40);
  }
  function stopHug() {
    if (!hugActive) return;
    hugActive = false;
    clearInterval(hugTimer);
    if (hugProgress < 100) finishHug(false);
  }
  function finishHug(success) {
    clearInterval(hugTimer);
    hugActive = false;
    hugRing.style.background = 'conic-gradient(var(--pink) 0deg, transparent 0deg)';
    hugProgress = 0;
    if (success) {
      roomRef.child('hugs').push({ from: myName, ts: Date.now() });
      addSystem('you sent a hug 🤗');
      bumpLove(10);
      touchLastActivity();
      closeSheet(attachBackdrop);
    } else {
      addSystem('hold a little longer to send the hug 🤏');
    }
  }
  function burstHearts() {
    const rect = hugBtn.getBoundingClientRect();
    const hearts = ['❤️', '💕', '💛', '✨'];
    for (let i = 0; i < 14; i++) {
      const h = document.createElement('div');
      h.className = 'heart-burst';
      h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      h.style.left = (rect.left + rect.width / 2 + (Math.random() * 60 - 30)) + 'px';
      h.style.top = (rect.top + (Math.random() * 10)) + 'px';
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1400);
    }
  }
  function attachHugs() {
    roomRef.child('hugs').limitToLast(1).on('child_added', snap => {
      if (!sawFirstHugSnapshot) { sawFirstHugSnapshot = true; return; }
      const hug = snap.val();
      burstHearts();
      flash.classList.add('on');
      setTimeout(() => flash.classList.remove('on'), 700);
      if (hug.from !== myName) {
        addSystem(hug.from + ' sent you a hug 🤗');
        setOrbMood('love');
      }
    });
  }
  hugBtn.addEventListener('mousedown', startHug);
  hugBtn.addEventListener('touchstart', startHug, { passive: false });
  ['mouseup', 'mouseleave'].forEach(ev => hugBtn.addEventListener(ev, stopHug));
  hugBtn.addEventListener('touchend', stopHug);

  // ---------- time capsule ----------
  const capsuleBackdrop = document.getElementById('capsuleBackdrop');
  const capsuleText = document.getElementById('capsuleText');
  const capsuleDelay = document.getElementById('capsuleDelay');
  document.getElementById('btnCapsule').addEventListener('click', () => {
    closeSheet(attachBackdrop);
    openSheet(capsuleBackdrop);
  });
  document.getElementById('capsuleCancel').addEventListener('click', () => {
    closeSheet(capsuleBackdrop);
    capsuleText.value = '';
  });
  document.getElementById('capsuleSend').addEventListener('click', () => {
    const msg = capsuleText.value.trim();
    if (!msg || !roomRef) return;
    const delay = parseInt(capsuleDelay.value, 10);
    const label = capsuleDelay.options[capsuleDelay.selectedIndex].text;
    addSystem('message buried, it will surface in ' + label + ' (keep this tab open)');
    capsuleText.value = '';
    closeSheet(capsuleBackdrop);
    bumpLove(5);
    setTimeout(() => sendMessage(msg, 'time capsule opened 🕰️'), delay);
  });

  // ---------- feature 7: "thinking of you" ping ----------
  document.getElementById('btnMikirin').addEventListener('click', () => {
    if (!roomRef) return;
    sendMessage('', 'just thinking about you 💭', 'ping');
    bumpLove(2);
    burstHearts();
    closeSheet(attachBackdrop);
  });
  // ---------- feature 8: conversation playlist ----------
  const playlistBackdrop = document.getElementById('playlistBackdrop');
  const playlistList = document.getElementById('playlistList');
  const playlistMoodLine = document.getElementById('playlistMoodLine');
  document.getElementById('btnPlaylist').addEventListener('click', () => {
    const counts = JSON.parse(localStorage.getItem(todayKey()) || '{}');
    let top = 'neutral', best = 0;
    for (const m in counts) { if (counts[m] > best) { best = counts[m]; top = m; } }
    const moodNames = { happy: 'ceria 😄', love: 'lovey-dovey 🥰', sad: 'butuh dipeluk 🥺', neutral: 'santai ⛅' };
    playlistMoodLine.textContent = "today's dominant mood: " + moodNames[top];
    playlistList.innerHTML = '';
    SONGS[top].forEach(s => {
      const a = document.createElement('a');
      a.className = 'playlist-item';
      a.target = '_blank';
      a.rel = 'noopener';
      a.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(s.t + ' ' + s.a);
      a.innerHTML = '<div>' + s.t + '<small>' + s.a + '</small></div><span class="go">▶</span>';
      playlistList.appendChild(a);
    });
    closeSheet(attachBackdrop);
    openSheet(playlistBackdrop);
  });
  document.getElementById('playlistClose').addEventListener('click', () => closeSheet(playlistBackdrop));

  // ---------- feature 2: "missing you" distance meter ----------
  const rinduChip = document.getElementById('rinduChip');
  const rinduBackdrop = document.getElementById('rinduBackdrop');
  const rinduPlantEmoji = document.getElementById('rinduPlantEmoji');
  const rinduLabel = document.getElementById('rinduLabel');
  const rinduSub = document.getElementById('rinduSub');
  let otherLastActivity = null;

  function touchLastActivity() {
    if (!roomRef) return;
    roomRef.child('lastActivity/' + safeKey(myName)).set(Date.now());
  }

  function rinduStageFor(ms) {
    return RINDU_STAGES.find(s => ms <= s.max) || RINDU_STAGES[RINDU_STAGES.length - 1];
  }

  function renderRindu() {
    if (otherLastActivity == null) {
      rinduChip.textContent = '🌱';
      return;
    }
    const diff = Date.now() - otherLastActivity;
    const stage = rinduStageFor(diff);
    rinduChip.textContent = stage.emoji;
    rinduPlantEmoji.textContent = stage.emoji;
    rinduLabel.textContent = stage.label;
    const mins = Math.floor(diff / 60000);
    let ago;
    if (mins < 1) ago = 'just now';
    else if (mins < 60) ago = mins + ' minutes ago';
    else if (mins < 1440) ago = Math.floor(mins / 60) + ' hours ago';
    else ago = Math.floor(mins / 1440) + ' days ago';
    rinduSub.textContent = 'last contact from ' + otherName() + ': ' + ago;
  }

  function attachRindu() {
    roomRef.child('lastActivity/' + safeKey(otherName())).on('value', snap => {
      otherLastActivity = snap.val();
      renderRindu();
    });
    setInterval(renderRindu, 60000);
  }

  rinduChip.addEventListener('click', () => { renderRindu(); openSheet(rinduBackdrop); });
  document.getElementById('rinduClose').addEventListener('click', () => closeSheet(rinduBackdrop));
  document.getElementById('rinduHugBtn').addEventListener('click', () => {
    if (!roomRef) return;
    roomRef.child('hugs').push({ from: myName, ts: Date.now() });
    addSystem('you sent a hug 🤗');
    bumpLove(10);
    touchLastActivity();
    closeSheet(rinduBackdrop);
  });

  // ---------- feature: countdown bareng ----------
  const countdownChip = document.getElementById('countdownChip');
  const countdownLine = document.getElementById('countdownLine');
  const countdownBackdrop = document.getElementById('countdownBackdrop');
  const countdownTitleInput = document.getElementById('countdownTitleInput');
  const countdownDateInput = document.getElementById('countdownDateInput');
  const countdownPreview = document.getElementById('countdownPreview');
  let currentCountdown = null;
  let countdownCelebratedFor = null;

  function daysUntil(dateISO) {
    const target = new Date(dateISO + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }
  function countdownText(cd) {
    if (!cd || !cd.dateISO) return '';
    const d = daysUntil(cd.dateISO);
    if (d > 1) return '⏳ ' + d + ' hari lagi ke ' + cd.title;
    if (d === 1) return '⏳ besok: ' + cd.title + '!';
    if (d === 0) return '🎉 hari ini: ' + cd.title + '!';
    return '💫 ' + cd.title + ' — ' + Math.abs(d) + ' hari yang lalu';
  }
  function renderCountdown() {
    if (!currentCountdown || !currentCountdown.dateISO) {
      countdownLine.hidden = true;
      countdownPreview.textContent = '';
      return;
    }
    const text = countdownText(currentCountdown);
    countdownLine.textContent = text;
    countdownLine.hidden = false;
    countdownPreview.textContent = text;
    const d = daysUntil(currentCountdown.dateISO);
    if (d === 0 && countdownCelebratedFor !== currentCountdown.dateISO) {
      countdownCelebratedFor = currentCountdown.dateISO;
      confetti(40);
    }
  }
  function attachCountdown() {
    roomRef.child('countdown').on('value', snap => {
      currentCountdown = snap.val();
      if (currentCountdown) {
        countdownTitleInput.value = currentCountdown.title || '';
        countdownDateInput.value = currentCountdown.dateISO || '';
      }
      renderCountdown();
    });
    setInterval(renderCountdown, 60 * 60 * 1000);
  }
  countdownChip.addEventListener('click', () => {
    renderCountdown();
    openSheet(countdownBackdrop);
  });
  document.getElementById('countdownClose').addEventListener('click', () => closeSheet(countdownBackdrop));
  countdownBackdrop.addEventListener('click', e => { if (e.target === countdownBackdrop) closeSheet(countdownBackdrop); });
  document.getElementById('countdownSave').addEventListener('click', () => {
    if (!roomRef) return;
    const title = countdownTitleInput.value.trim() || 'momen spesial kita';
    const dateISO = countdownDateInput.value;
    if (!dateISO) { addSystem('pilih tanggalnya dulu ya.'); return; }
    countdownCelebratedFor = null;
    roomRef.child('countdown').set({ title, dateISO, setBy: myName });
    bumpLove(3);
    touchLastActivity();
    closeSheet(countdownBackdrop);
  });
  document.getElementById('countdownRemove').addEventListener('click', () => {
    if (!roomRef) return;
    roomRef.child('countdown').remove();
    countdownTitleInput.value = '';
    countdownDateInput.value = '';
    closeSheet(countdownBackdrop);
  });

  // ---------- feature: shared bucket list ----------
  const bucketBackdrop = document.getElementById('bucketBackdrop');
  const bucketInput = document.getElementById('bucketInput');
  const bucketListEl = document.getElementById('bucketList');
  const bucketProgress = document.getElementById('bucketProgress');
  let bucketItems = {};

  function renderBucket() {
    const entries = Object.entries(bucketItems).sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
    bucketListEl.innerHTML = '';
    let done = 0;
    entries.forEach(([key, item]) => {
      if (item.done) done++;
      const row = document.createElement('div');
      row.className = 'bucket-item' + (item.done ? ' done' : '');
      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'bucket-check';
      check.textContent = '✓';
      check.addEventListener('click', () => toggleBucketItem(key, item));
      const text = document.createElement('span');
      text.className = 'bucket-item-text';
      text.textContent = item.text;
      row.appendChild(check);
      row.appendChild(text);
      if (item.done && item.doneBy) {
        const by = document.createElement('span');
        by.className = 'bucket-item-by';
        by.textContent = 'by ' + (item.doneBy === myName ? 'you' : item.doneBy);
        row.appendChild(by);
      }
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'bucket-item-del';
      del.textContent = '✕';
      del.setAttribute('aria-label', 'Remove');
      del.addEventListener('click', () => { if (roomRef) roomRef.child('bucketlist/' + key).remove(); });
      row.appendChild(del);
      bucketListEl.appendChild(row);
    });
    bucketProgress.textContent = entries.length ? done + ' dari ' + entries.length + ' udah dicentang' : 'belum ada rencana, tambahin yuk';
  }
  function toggleBucketItem(key, item) {
    if (!roomRef) return;
    const nowDone = !item.done;
    roomRef.child('bucketlist/' + key).update({ done: nowDone, doneBy: nowDone ? myName : null });
    if (nowDone) { bumpLove(4); burstHearts(); }
    touchLastActivity();
  }
  function attachBucket() {
    roomRef.child('bucketlist').on('value', snap => {
      bucketItems = snap.val() || {};
      renderBucket();
    });
  }
  document.getElementById('btnBucket').addEventListener('click', () => {
    closeSheet(attachBackdrop);
    renderBucket();
    openSheet(bucketBackdrop);
  });
  document.getElementById('bucketClose').addEventListener('click', () => closeSheet(bucketBackdrop));
  bucketBackdrop.addEventListener('click', e => { if (e.target === bucketBackdrop) closeSheet(bucketBackdrop); });
  function addBucketItem() {
    const text = bucketInput.value.trim();
    if (!text || !roomRef) return;
    roomRef.child('bucketlist').push({ text, done: false, doneBy: null, createdBy: myName, ts: Date.now() });
    bucketInput.value = '';
    touchLastActivity();
  }
  document.getElementById('bucketAdd').addEventListener('click', addBucketItem);
  bucketInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBucketItem(); } });

  // ---------- feature 9: daily check-in sticker ----------
  const checkinChip = document.getElementById('checkinChip');
  const checkinBackdrop = document.getElementById('checkinBackdrop');
  const checkinToday = document.getElementById('checkinToday');
  let todayCheckins = {};

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function renderCheckinToday() {
    const mine = todayCheckins[safeKey(myName)];
    const theirs = todayCheckins[safeKey(otherName())];
    checkinChip.classList.toggle('pulse', !mine);
    document.querySelectorAll('#checkinGrid .checkin-emoji').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.emoji === mine);
    });
    checkinToday.innerHTML =
      '<div class="checkin-person"><div class="checkin-person-emoji">' + (mine || '❔') + '</div><div class="checkin-person-name">You</div></div>' +
      '<div class="checkin-person"><div class="checkin-person-emoji">' + (theirs || '❔') + '</div><div class="checkin-person-name">' + otherName() + '</div></div>';
  }

  function attachCheckin() {
    roomRef.child('checkins/' + todayKey()).on('value', snap => {
      todayCheckins = snap.val() || {};
      renderCheckinToday();
    });
  }

  document.querySelectorAll('#checkinGrid .checkin-emoji').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!roomRef) return;
      roomRef.child('checkins/' + todayKey() + '/' + safeKey(myName)).set(btn.dataset.emoji);
      bumpLove(2);
      touchLastActivity();
    });
  });

  checkinChip.addEventListener('click', () => { renderCheckinToday(); openSheet(checkinBackdrop); });
  document.getElementById('checkinClose').addEventListener('click', () => closeSheet(checkinBackdrop));
  checkinBackdrop.addEventListener('click', e => { if (e.target === checkinBackdrop) closeSheet(checkinBackdrop); });

  // ---------- feature 6: shared doodle canvas ----------
  const doodleBackdrop = document.getElementById('doodleBackdrop');
  const doodleCanvas = document.getElementById('doodleCanvas');
  const dctx = doodleCanvas.getContext('2d');
  let doodleColor = '#FF87AB';
  let doodleErasing = false;
  let drawing = false;
  let currentStrokeKey = null;
  let currentPoints = [];
  let lastPushTs = 0;
  let allStrokes = {};

  document.getElementById('btnDoodle').addEventListener('click', () => {
    closeSheet(attachBackdrop);
    openSheet(doodleBackdrop);
    requestAnimationFrame(fitDoodleCanvas);
  });
  document.getElementById('doodleClose2').addEventListener('click', () => closeSheet(doodleBackdrop));
  doodleBackdrop.addEventListener('click', e => { if (e.target === doodleBackdrop) closeSheet(doodleBackdrop); });

  document.querySelectorAll('#doodleColors .swatch').forEach((sw, i) => {
    if (i === 0) sw.classList.add('active');
    sw.addEventListener('click', () => {
      doodleColor = sw.dataset.color;
      doodleErasing = false;
      document.querySelectorAll('#doodleColors .swatch, #doodleEraser').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });

  const doodleEraserBtn = document.getElementById('doodleEraser');
  doodleEraserBtn.addEventListener('click', () => {
    doodleErasing = !doodleErasing;
    document.querySelectorAll('#doodleColors .swatch').forEach(s => s.classList.remove('active'));
    doodleEraserBtn.classList.toggle('active', doodleErasing);
  });

  function fitDoodleCanvas() {
    const rect = doodleCanvas.getBoundingClientRect();
    doodleCanvas.width = rect.width;
    doodleCanvas.height = rect.height;
    redrawDoodle();
  }

  function canvasPoint(e) {
    const rect = doodleCanvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x: cx / rect.width, y: cy / rect.height }; // normalized 0..1
  }

  function startDraw(e) {
    e.preventDefault();
    if (!roomRef) return;
    drawing = true;
    const p = canvasPoint(e);
    currentPoints = [p];
    const ref = roomRef.child('doodle/strokes').push();
    currentStrokeKey = ref.key;
    ref.set({ name: myName, color: doodleColor, points: currentPoints, erase: doodleErasing });
  }
  function moveDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = canvasPoint(e);
    currentPoints.push(p);
    const now = Date.now();
    if (now - lastPushTs > 120) {
      lastPushTs = now;
      roomRef.child('doodle/strokes/' + currentStrokeKey).update({ points: currentPoints });
    }
  }
  function endDraw(e) {
    if (!drawing) return;
    drawing = false;
    if (currentStrokeKey) roomRef.child('doodle/strokes/' + currentStrokeKey).update({ points: currentPoints });
    currentStrokeKey = null;
  }
  doodleCanvas.addEventListener('mousedown', startDraw);
  doodleCanvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);
  doodleCanvas.addEventListener('touchstart', startDraw, { passive: false });
  doodleCanvas.addEventListener('touchmove', moveDraw, { passive: false });
  doodleCanvas.addEventListener('touchend', endDraw);

  function redrawDoodle() {
    dctx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
    // sort by key so strokes (and erases) replay in the order they were drawn
    Object.keys(allStrokes).sort().forEach(key => {
      const stroke = allStrokes[key];
      if (!stroke || !stroke.points || stroke.points.length < 2) return;
      dctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
      dctx.strokeStyle = stroke.color || '#FF87AB';
      dctx.lineWidth = stroke.erase ? 20 : 4;
      dctx.lineCap = 'round';
      dctx.lineJoin = 'round';
      dctx.beginPath();
      stroke.points.forEach((pt, i) => {
        const x = pt.x * doodleCanvas.width, y = pt.y * doodleCanvas.height;
        if (i === 0) dctx.moveTo(x, y); else dctx.lineTo(x, y);
      });
      dctx.stroke();
    });
    dctx.globalCompositeOperation = 'source-over';
  }

  function attachDoodle() {
    roomRef.child('doodle/strokes').on('value', snap => {
      allStrokes = snap.val() || {};
      redrawDoodle();
    });
  }
  document.getElementById('doodleClear').addEventListener('click', () => {
    if (!roomRef) return;
    roomRef.child('doodle/strokes').remove();
  });
  document.getElementById('doodleUndo').addEventListener('click', () => {
    if (!roomRef) return;
    const keys = Object.keys(allStrokes).sort();
    if (!keys.length) return;
    // removes the most recent stroke drawn by either person, so it undoes
    // whichever one of you drew last — keeps it simple for a shared canvas
    roomRef.child('doodle/strokes/' + keys[keys.length - 1]).remove();
  });

  // ---------- feature 10: 2048 speed race ----------
  const raceBackdrop = document.getElementById('raceBackdrop');
  const raceBoardEl = document.getElementById('raceBoard');
  const raceStartBtn = document.getElementById('raceStartBtn');
  const raceStatus = document.getElementById('raceStatus');
  const raceTimerEl = document.getElementById('raceTimer');
  const raceMyScoreEl = document.getElementById('raceMyScore');
  const raceTheirScoreEl = document.getElementById('raceTheirScore');
  const raceTheirNameEl = document.getElementById('raceTheirName');
  const RACE_DURATION = 90 * 1000;
  const RACE_COUNTDOWN = 3 * 1000;

  let raceState = null;
  let raceBoard = null;
  let raceScore = 0;
  let lastRaceStartAt = undefined;
  let raceCountdownInterval = null;
  let raceTimerInterval = null;
  let raceTouchStart = null;

  function emptyRaceBoard() { return Array.from({ length: 4 }, () => [0, 0, 0, 0]); }

  function addRandomRaceTile(board) {
    const empties = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (board[r][c] === 0) empties.push([r, c]);
    if (!empties.length) return false;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  function raceBoardsEqual(a, b) {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (a[r][c] !== b[r][c]) return false;
    return true;
  }

  function slideRowLeft(row) {
    let vals = row.filter(v => v !== 0);
    let gained = 0;
    for (let i = 0; i < vals.length - 1; i++) {
      if (vals[i] === vals[i + 1]) {
        vals[i] *= 2;
        gained += vals[i];
        vals.splice(i + 1, 1);
      }
    }
    while (vals.length < 4) vals.push(0);
    return { row: vals, gained };
  }

  function transposeBoard(board) {
    const res = emptyRaceBoard();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) res[c][r] = board[r][c];
    return res;
  }
  function reverseRowsBoard(board) { return board.map(row => row.slice().reverse()); }

  function moveRaceBoard(board, dir) {
    let b = board.map(row => row.slice());
    let gained = 0;
    const applySlide = () => { b = b.map(row => { const res = slideRowLeft(row); gained += res.gained; return res.row; }); };
    if (dir === 'left') {
      applySlide();
    } else if (dir === 'right') {
      b = reverseRowsBoard(b); applySlide(); b = reverseRowsBoard(b);
    } else if (dir === 'up') {
      b = transposeBoard(b); applySlide(); b = transposeBoard(b);
    } else if (dir === 'down') {
      b = transposeBoard(b); b = reverseRowsBoard(b); applySlide(); b = reverseRowsBoard(b); b = transposeBoard(b);
    }
    return { board: b, gained };
  }

  function renderRaceBoard() {
    if (!raceBoard) return;
    raceBoardEl.innerHTML = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const v = raceBoard[r][c];
        const cell = document.createElement('div');
        cell.className = 'race-tile';
        if (v) { cell.textContent = v; cell.dataset.v = v; }
        raceBoardEl.appendChild(cell);
      }
    }
  }

  function isRaceActive() {
    if (!raceState || !raceState.startAt) return false;
    const now = Date.now();
    return now >= raceState.startAt && now < raceState.startAt + raceState.duration;
  }

  function doRaceMove(dir) {
    if (!isRaceActive() || !raceBoard) return;
    const { board, gained } = moveRaceBoard(raceBoard, dir);
    if (raceBoardsEqual(board, raceBoard)) return;
    raceBoard = board;
    raceScore += gained;
    addRandomRaceTile(raceBoard);
    renderRaceBoard();
    raceMyScoreEl.textContent = raceScore;
    if (roomRef) roomRef.child('race2048/scores/' + safeKey(myName)).set(raceScore);
  }

  function updateRaceScoreboard() {
    const scores = (raceState && raceState.scores) || {};
    raceMyScoreEl.textContent = (isRaceActive() || (raceState && raceState.startAt)) ? (scores[safeKey(myName)] || 0) : raceScore;
    raceTheirScoreEl.textContent = scores[safeKey(otherName())] || 0;
    raceTheirNameEl.textContent = otherName();
  }

  function handleRaceStateChange() {
    clearInterval(raceCountdownInterval);
    clearInterval(raceTimerInterval);

    if (!raceState || !raceState.startAt) {
      raceStartBtn.hidden = false;
      raceStartBtn.textContent = 'Start race';
      raceTimerEl.textContent = String(RACE_DURATION / 1000);
      raceStatus.textContent = "Both open this panel, then tap start when ready";
      updateRaceScoreboard();
      return;
    }

    if (raceState.startAt !== lastRaceStartAt) {
      lastRaceStartAt = raceState.startAt;
      raceBoard = emptyRaceBoard();
      addRandomRaceTile(raceBoard);
      addRandomRaceTile(raceBoard);
      raceScore = 0;
      renderRaceBoard();
      if (roomRef) roomRef.child('race2048/scores/' + safeKey(myName)).set(0);
    }

    const now = Date.now();
    if (now < raceState.startAt) {
      raceStartBtn.hidden = true;
      const tick = () => {
        const secs = Math.max(0, Math.ceil((raceState.startAt - Date.now()) / 1000));
        raceStatus.textContent = secs > 0 ? ('starting in ' + secs + '...') : 'go!';
        if (Date.now() >= raceState.startAt) { clearInterval(raceCountdownInterval); handleRaceStateChange(); }
      };
      tick();
      raceCountdownInterval = setInterval(tick, 200);
    } else if (now < raceState.startAt + raceState.duration) {
      raceStartBtn.hidden = true;
      raceStatus.textContent = 'swipe the board to play!';
      const tick = () => {
        const remain = Math.max(0, raceState.startAt + raceState.duration - Date.now());
        raceTimerEl.textContent = String(Math.ceil(remain / 1000));
        if (remain <= 0) { clearInterval(raceTimerInterval); handleRaceStateChange(); }
      };
      tick();
      raceTimerInterval = setInterval(tick, 250);
    } else {
      raceStartBtn.hidden = false;
      raceStartBtn.textContent = 'Race again';
      raceTimerEl.textContent = '0';
      const scores = raceState.scores || {};
      const mine = scores[safeKey(myName)] || 0;
      const theirs = scores[safeKey(otherName())] || 0;
      if (mine > theirs) raceStatus.textContent = 'you won! 🏆 ' + mine + ' vs ' + theirs;
      else if (mine < theirs) raceStatus.textContent = otherName() + ' won this round — ' + theirs + ' vs ' + mine;
      else raceStatus.textContent = "it's a tie — " + mine + ' vs ' + theirs;
    }
    updateRaceScoreboard();
  }

  function attachRace() {
    raceBoard = emptyRaceBoard();
    renderRaceBoard();
    roomRef.child('race2048').on('value', snap => {
      raceState = snap.val() || null;
      handleRaceStateChange();
    });
  }

  raceStartBtn.addEventListener('click', () => {
    if (!roomRef) return;
    roomRef.child('race2048').set({
      startAt: Date.now() + RACE_COUNTDOWN,
      duration: RACE_DURATION,
      scores: {},
      startedBy: myName
    });
  });

  document.getElementById('btnRace').addEventListener('click', () => {
    closeSheet(attachBackdrop);
    openSheet(raceBackdrop);
  });
  document.getElementById('raceClose').addEventListener('click', () => closeSheet(raceBackdrop));
  raceBackdrop.addEventListener('click', e => { if (e.target === raceBackdrop) closeSheet(raceBackdrop); });

  raceBoardEl.addEventListener('touchstart', e => {
    const t = e.touches[0];
    raceTouchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  raceBoardEl.addEventListener('touchend', e => {
    if (!raceTouchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - raceTouchStart.x;
    const dy = t.clientY - raceTouchStart.y;
    raceTouchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) doRaceMove(dx > 0 ? 'right' : 'left');
    else doRaceMove(dy > 0 ? 'down' : 'up');
  });
  document.addEventListener('keydown', e => {
    if (raceBackdrop.hidden) return;
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.key]) { e.preventDefault(); doRaceMove(map[e.key]); }
  });

  // ---------- feature 11: bingo bareng (find-the-number puzzle, solved together) ----------
  const bingoBackdrop = document.getElementById('bingoBackdrop');
  const bingoBoardEl = document.getElementById('bingoBoard');
  const bingoCallBtn = document.getElementById('bingoCallBtn');
  const bingoNewBtn = document.getElementById('bingoNewBtn');
  const bingoStatus = document.getElementById('bingoStatus');
  const bingoCurrentCallEl = document.getElementById('bingoCurrentCall');
  const bingoProgressEl = document.getElementById('bingoProgress');
  let bingoState = null;

  function shuffledRange(n) {
    const arr = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // all 5 rows, 5 columns, and both diagonals on the 5x5 board, as cell indices
  const BINGO_LINES = (() => {
    const lines = [];
    for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map(c => r * 5 + c));
    for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map(r => r * 5 + c));
    lines.push([0, 6, 12, 18, 24]);
    lines.push([4, 8, 12, 16, 20]);
    return lines;
  })();

  function bingoLitCells(marks) {
    const lit = new Set();
    BINGO_LINES.forEach(line => {
      if (line.every(i => marks[i])) line.forEach(i => lit.add(i));
    });
    return lit;
  }

  function renderBingo() {
    if (!bingoState || !bingoState.board) {
      bingoBoardEl.innerHTML = '';
      bingoCurrentCallEl.textContent = '-';
      bingoProgressEl.textContent = '0/25 dipanggil';
      bingoStatus.textContent = 'Tap "Kartu baru" untuk mulai main bareng';
      bingoCallBtn.disabled = true;
      return;
    }
    const board = bingoState.board;
    const callOrder = bingoState.callOrder || [];
    const calledCount = bingoState.calledCount || 0;
    const marks = bingoState.marks || {};
    const currentCall = calledCount > 0 ? callOrder[calledCount - 1] : null;

    bingoCurrentCallEl.textContent = currentCall != null ? currentCall : '-';
    bingoProgressEl.textContent = calledCount + '/25 dipanggil';

    const markedCount = Object.keys(marks).length;
    const litCells = bingoLitCells(marks);

    bingoBoardEl.innerHTML = '';
    board.forEach((num, i) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bingo-cell';
      if (marks[i]) cell.classList.add('marked');
      if (litCells.has(i)) cell.classList.add('lit');
      cell.textContent = num;
      cell.addEventListener('click', () => bingoTapCell(i));
      bingoBoardEl.appendChild(cell);
    });

    if (markedCount === 25) {
      bingoStatus.textContent = 'FULL HOUSE! kalian menyelesaikannya bareng 🎉💖';
      bingoCallBtn.disabled = true;
    } else if (calledCount >= 25) {
      bingoStatus.textContent = 'semua angka sudah dipanggil, tinggal cari sisanya di papan!';
      bingoCallBtn.disabled = true;
    } else {
      bingoCallBtn.disabled = false;
      bingoStatus.textContent = currentCall != null
        ? ('cari & ketuk angka ' + currentCall + ' di papan!')
        : 'sama-sama cari angkanya di papan, lalu ketuk!';
    }
  }

  function bingoTapCell(index) {
    if (!roomRef || !bingoState || !bingoState.board) return;
    const board = bingoState.board;
    const callOrder = bingoState.callOrder || [];
    const calledCount = bingoState.calledCount || 0;
    const marks = bingoState.marks || {};
    if (calledCount === 0 || marks[index]) return;
    const currentCall = callOrder[calledCount - 1];
    if (board[index] !== currentCall) return;
    roomRef.child('bingo/marks/' + index).set(true);
    bumpLove(2);
  }

  bingoCallBtn.addEventListener('click', () => {
    if (!roomRef || !bingoState) return;
    roomRef.child('bingo/calledCount').transaction(cur => {
      const n = cur || 0;
      return n < 25 ? n + 1 : n;
    });
    touchLastActivity();
  });

  bingoNewBtn.addEventListener('click', () => {
    if (!roomRef) return;
    roomRef.child('bingo').set({
      board: shuffledRange(25),
      callOrder: shuffledRange(25),
      calledCount: 0,
      marks: {},
      startedBy: myName,
      startedAt: Date.now()
    });
    touchLastActivity();
  });

  function attachBingo() {
    roomRef.child('bingo').on('value', snap => {
      bingoState = snap.val() || null;
      renderBingo();
    });
  }

  document.getElementById('btnBingo').addEventListener('click', () => {
    closeSheet(attachBackdrop);
    openSheet(bingoBackdrop);
  });
  document.getElementById('bingoClose').addEventListener('click', () => closeSheet(bingoBackdrop));
  bingoBackdrop.addEventListener('click', e => { if (e.target === bingoBackdrop) closeSheet(bingoBackdrop); });

  // ---------- feature 5: argument cooldown mode ----------
  const cooldownOverlay = document.getElementById('cooldownOverlay');
  const cooldownTimer = document.getElementById('cooldownTimer');
  const cooldownSkip = document.getElementById('cooldownSkip');
  let cooldownInterval = null;

  function isNegative(text) {
    const t = (text || '').toLowerCase();
    return NEGATIVE_WORDS.some(w => t.includes(w));
  }
  let myRecentNegatives = [];
  let othersRecentNegatives = [];

  function checkCooldownTrigger(text, othersBuffer) {
    if (!isNegative(text)) return;
    othersBuffer.push(Date.now());
    while (othersBuffer.length && Date.now() - othersBuffer[0] > 3 * 60 * 1000) othersBuffer.shift();
    if (othersBuffer.length >= 2) triggerCooldown();
  }
  function checkOwnNegative(text) {
    if (!isNegative(text)) return;
    myRecentNegatives.push(Date.now());
    while (myRecentNegatives.length && Date.now() - myRecentNegatives[0] > 3 * 60 * 1000) myRecentNegatives.shift();
    if (myRecentNegatives.length >= 2) triggerCooldown();
  }
  function triggerCooldown() {
    if (!roomRef) return;
    roomRef.child('cooldown').set({ active: true, until: Date.now() + COOLDOWN_MS, by: myName });
  }
  function attachCooldown() {
    roomRef.child('cooldown').on('value', snap => {
      const c = snap.val();
      if (c && c.active && c.until > Date.now()) {
        showCooldown(c.until);
      } else {
        hideCooldown();
        // clean up stale/expired state so it doesn't linger for the next person who opens the app
        if (c && c.active) roomRef.child('cooldown').set({ active: false });
      }
    });
  }
  function showCooldown(until) {
    cooldownOverlay.hidden = false;
    cooldownSkip.disabled = true;
    clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
      const remain = until - Date.now();
      if (remain <= 0) {
        cooldownTimer.textContent = '00:00';
        cooldownSkip.disabled = false;
        clearInterval(cooldownInterval);
        return;
      }
      const mm = String(Math.floor(remain / 60000)).padStart(2, '0');
      const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, '0');
      cooldownTimer.textContent = mm + ':' + ss;
    }, 250);
  }
  function hideCooldown() {
    cooldownOverlay.hidden = true;
    clearInterval(cooldownInterval);
  }
  cooldownSkip.addEventListener('click', () => {
    if (roomRef) roomRef.child('cooldown').set({ active: false });
    hideCooldown();
  });

  // ---------- photo / video upload ----------
  const photoInput = document.getElementById('photoInput');
  const videoInput = document.getElementById('videoInput');
  document.getElementById('btnPhoto').addEventListener('click', () => { closeSheet(attachBackdrop); photoInput.click(); });
  document.getElementById('btnVideo').addEventListener('click', () => { closeSheet(attachBackdrop); videoInput.click(); });

  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    photoInput.value = '';
    if (!file) return;
    compressImage(file, MAX_IMAGE_DIM, dataUrl => {
      sendMessage('', null, 'image', dataUrl);
      bumpLove(3);
    });
  });

  videoInput.addEventListener('change', () => {
    const file = videoInput.files[0];
    videoInput.value = '';
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      addSystem('video too large (max ~8MB for this demo). Try a shorter video.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      sendMessage('', null, 'video', reader.result);
      bumpLove(3);
    };
    reader.readAsDataURL(file);
  });

  function compressImage(file, maxDim, cb) {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.65));
    };
    reader.readAsDataURL(file);
  }

  // ---------- feature: sticker maker (trace + cut a photo) ----------
  const stickerBackdrop = document.getElementById('stickerBackdrop');
  const stickerCanvas = document.getElementById('stickerCanvas');
  const sctx = stickerCanvas.getContext('2d');
  const stickerPhotoInput = document.getElementById('stickerPhotoInput');
  let stickerImg = null;
  let stickerDrawRect = null; // where the image sits inside the canvas (letterboxed)
  let stickerPoints = [];
  let stickerDrawing = false;
  let stickerCut = false;

  document.getElementById('btnSticker').addEventListener('click', () => {
    closeSheet(attachBackdrop);
    stickerPhotoInput.click();
  });
  stickerPhotoInput.addEventListener('change', () => {
    const file = stickerPhotoInput.files[0];
    stickerPhotoInput.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        stickerImg = img;
        stickerPoints = [];
        stickerCut = false;
        openSheet(stickerBackdrop);
        requestAnimationFrame(fitStickerCanvas);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  function fitStickerCanvas() {
    const rect = stickerCanvas.getBoundingClientRect();
    stickerCanvas.width = rect.width;
    stickerCanvas.height = rect.height;
    drawStickerBase();
  }
  function drawStickerBase() {
    sctx.clearRect(0, 0, stickerCanvas.width, stickerCanvas.height);
    if (!stickerImg) return;
    const cw = stickerCanvas.width, ch = stickerCanvas.height;
    const scale = Math.min(cw / stickerImg.width, ch / stickerImg.height);
    const w = stickerImg.width * scale, h = stickerImg.height * scale;
    const x = (cw - w) / 2, y = (ch - h) / 2;
    stickerDrawRect = { x, y, w, h };
    sctx.drawImage(stickerImg, x, y, w, h);
    drawStickerLasso();
  }
  function drawStickerLasso() {
    if (stickerPoints.length < 2) return;
    sctx.save();
    sctx.strokeStyle = '#FF87AB';
    sctx.lineWidth = 3;
    sctx.lineJoin = 'round';
    sctx.lineCap = 'round';
    sctx.setLineDash([7, 5]);
    sctx.beginPath();
    stickerPoints.forEach((p, i) => { if (i === 0) sctx.moveTo(p.x, p.y); else sctx.lineTo(p.x, p.y); });
    sctx.stroke();
    sctx.restore();
  }
  function stickerPoint(e) {
    const rect = stickerCanvas.getBoundingClientRect();
    return {
      x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
      y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    };
  }
  function stickerStart(e) {
    if (!stickerImg || stickerCut) return;
    e.preventDefault();
    stickerDrawing = true;
    stickerPoints = [stickerPoint(e)];
  }
  function stickerMove(e) {
    if (!stickerDrawing) return;
    e.preventDefault();
    stickerPoints.push(stickerPoint(e));
    drawStickerBase();
  }
  function stickerEnd() { stickerDrawing = false; }
  stickerCanvas.addEventListener('mousedown', stickerStart);
  stickerCanvas.addEventListener('mousemove', stickerMove);
  window.addEventListener('mouseup', stickerEnd);
  stickerCanvas.addEventListener('touchstart', stickerStart, { passive: false });
  stickerCanvas.addEventListener('touchmove', stickerMove, { passive: false });
  stickerCanvas.addEventListener('touchend', stickerEnd);

  document.getElementById('stickerCut').addEventListener('click', () => {
    if (!stickerImg || stickerPoints.length < 3) { addSystem('gambar garis ngelilingin objeknya dulu ya.'); return; }
    const cw = stickerCanvas.width, ch = stickerCanvas.height;
    // 1) build a mask shaped like the lasso path
    const mask = document.createElement('canvas');
    mask.width = cw; mask.height = ch;
    const mctx = mask.getContext('2d');
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    stickerPoints.forEach((p, i) => { if (i === 0) mctx.moveTo(p.x, p.y); else mctx.lineTo(p.x, p.y); });
    mctx.closePath();
    mctx.fill();
    // 2) draw a thick white "sticker" outline along that same path
    sctx.clearRect(0, 0, cw, ch);
    sctx.save();
    sctx.strokeStyle = '#ffffff';
    sctx.lineWidth = 10;
    sctx.lineJoin = 'round';
    sctx.beginPath();
    stickerPoints.forEach((p, i) => { if (i === 0) sctx.moveTo(p.x, p.y); else sctx.lineTo(p.x, p.y); });
    sctx.closePath();
    sctx.stroke();
    sctx.restore();
    // 3) cut the photo to the lasso shape and lay it on top of the outline
    const cutout = document.createElement('canvas');
    cutout.width = cw; cutout.height = ch;
    const cutctx = cutout.getContext('2d');
    cutctx.drawImage(mask, 0, 0);
    cutctx.globalCompositeOperation = 'source-in';
    cutctx.drawImage(stickerImg, stickerDrawRect.x, stickerDrawRect.y, stickerDrawRect.w, stickerDrawRect.h);
    sctx.drawImage(cutout, 0, 0);
    stickerCut = true;
  });
  document.getElementById('stickerUndo').addEventListener('click', () => {
    stickerPoints = [];
    stickerCut = false;
    drawStickerBase();
  });
  document.getElementById('stickerSend').addEventListener('click', () => {
    if (!roomRef || !stickerImg) return;
    const dataUrl = stickerCanvas.toDataURL('image/png');
    sendMessage('', '✂️ sticker', 'image', dataUrl);
    bumpLove(3);
    closeSheet(stickerBackdrop);
  });
  document.getElementById('stickerClose').addEventListener('click', () => closeSheet(stickerBackdrop));
  stickerBackdrop.addEventListener('click', e => { if (e.target === stickerBackdrop) closeSheet(stickerBackdrop); });

  // ---------- feature: photobooth strip ----------
  const photoboothBackdrop = document.getElementById('photoboothBackdrop');
  const photoboothCanvas = document.getElementById('photoboothCanvas');
  const pbctx = photoboothCanvas.getContext('2d');
  const photoboothInput = document.getElementById('photoboothInput');
  const photoboothCaption = document.getElementById('photoboothCaption');
  let photoboothImages = [];
  let photoboothColor = '#FF87AB';

  document.getElementById('btnPhotobooth').addEventListener('click', () => {
    closeSheet(attachBackdrop);
    photoboothImages = [];
    photoboothCaption.value = '';
    drawPhotobooth();
    openSheet(photoboothBackdrop);
  });
  document.getElementById('photoboothPick').addEventListener('click', () => photoboothInput.click());
  photoboothInput.addEventListener('change', () => {
    const files = Array.from(photoboothInput.files || []).slice(0, 4);
    photoboothInput.value = '';
    if (!files.length) return;
    Promise.all(files.map(loadImageFile)).then(imgs => {
      photoboothImages = imgs;
      drawPhotobooth();
    });
  });
  function loadImageFile(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  document.querySelectorAll('#photoboothColors .swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      photoboothColor = sw.dataset.color;
      document.querySelectorAll('#photoboothColors .swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      drawPhotobooth();
    });
  });
  photoboothCaption.addEventListener('input', drawPhotobooth);

  function drawPhotobooth() {
    const W = 240, CAP_H = 40, PAD = 12;
    const n = Math.max(photoboothImages.length, 1);
    const cellH = 200;
    const H = PAD * (n + 1) + cellH * n + CAP_H;
    photoboothCanvas.width = W;
    photoboothCanvas.height = H;
    pbctx.fillStyle = photoboothColor;
    pbctx.fillRect(0, 0, W, H);
    if (!photoboothImages.length) {
      pbctx.fillStyle = 'rgba(0,0,0,0.35)';
      pbctx.font = '13px sans-serif';
      pbctx.textAlign = 'center';
      pbctx.fillText('pilih 2–4 foto', W / 2, H / 2);
    } else {
      photoboothImages.forEach((img, i) => {
        const cellW = W - PAD * 2;
        const cx = PAD, cy = PAD + i * (cellH + PAD);
        const scale = Math.max(cellW / img.width, cellH / img.height);
        const w = img.width * scale, h = img.height * scale;
        const dx = cx - (w - cellW) / 2, dy = cy - (h - cellH) / 2;
        pbctx.save();
        pbctx.beginPath();
        pbctx.rect(cx, cy, cellW, cellH);
        pbctx.clip();
        pbctx.fillStyle = '#150C2E';
        pbctx.fillRect(cx, cy, cellW, cellH);
        pbctx.drawImage(img, dx, dy, w, h);
        pbctx.restore();
      });
    }
    pbctx.fillStyle = 'rgba(21,12,46,0.9)';
    pbctx.font = "600 13px 'Fredoka', sans-serif";
    pbctx.textAlign = 'center';
    pbctx.fillText(photoboothCaption.value.trim() || 'glow · just us two', W / 2, H - CAP_H / 2 + 4);
  }
  document.getElementById('photoboothSend').addEventListener('click', () => {
    if (!roomRef || !photoboothImages.length) { addSystem('pilih foto dulu ya, minimal 2.'); return; }
    const dataUrl = photoboothCanvas.toDataURL('image/jpeg', 0.85);
    sendMessage('', '🎞️ photobooth', 'image', dataUrl);
    bumpLove(4);
    closeSheet(photoboothBackdrop);
  });
  document.getElementById('photoboothDownload').addEventListener('click', () => {
    if (!photoboothImages.length) { addSystem('pilih foto dulu ya, minimal 2.'); return; }
    const a = document.createElement('a');
    a.download = 'glow-photobooth.png';
    a.href = photoboothCanvas.toDataURL('image/png');
    a.click();
  });
  document.getElementById('photoboothClose').addEventListener('click', () => closeSheet(photoboothBackdrop));
  photoboothBackdrop.addEventListener('click', e => { if (e.target === photoboothBackdrop) closeSheet(photoboothBackdrop); });

  // ---------- voice notes (hold mic to record) ----------
  // Uses the browser's built-in microphone + recording APIs (MediaRecorder).
  // This is a free, standard browser feature — no paid service is involved.
  // It does require the page to be served over HTTPS (or localhost); most
  // free static hosts like GitHub Pages, Netlify, and Vercel provide this
  // automatically. If the browser doesn't support recording at all, the mic
  // button is hidden instead of showing a broken control.
  let mediaRecorder = null;
  let audioChunks = [];
  let recStream = null;
  let recordingMimeType = 'audio/webm';

  const canRecordAudio = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  if (!canRecordAudio) {
    micBtn.hidden = true;
  } else {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    const supported = candidates.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    if (supported) recordingMimeType = supported;
  }

  function startRecording(e) {
    if (e) e.preventDefault();
    if (!roomRef || !canRecordAudio) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      recStream = stream;
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: recordingMimeType });
      mediaRecorder.ondataavailable = ev => { if (ev.data && ev.data.size > 0) audioChunks.push(ev.data); };
      mediaRecorder.onstop = () => {
        if (!audioChunks.length) { recStream.getTracks().forEach(t => t.stop()); return; }
        const blob = new Blob(audioChunks, { type: recordingMimeType });
        const reader = new FileReader();
        reader.onload = () => {
          sendMessage('', '🎤 voice note', 'audio', reader.result);
          bumpLove(3);
        };
        reader.readAsDataURL(blob);
        recStream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      micBtn.classList.add('recording');
    }).catch(err => {
      if (err && err.name === 'NotAllowedError') {
        addSystem("microphone access was blocked. Allow mic permission in your browser settings to send voice notes.");
      } else if (err && err.name === 'NotFoundError') {
        addSystem('no microphone was found on this device.');
      } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        addSystem('voice notes need this page to be opened over HTTPS.');
      } else {
        addSystem("couldn't access the microphone.");
      }
    });
  }
  function stopRecording() {
    micBtn.classList.remove('recording');
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }
  micBtn.addEventListener('mousedown', startRecording);
  micBtn.addEventListener('touchstart', startRecording, { passive: false });
  ['mouseup', 'mouseleave'].forEach(ev => micBtn.addEventListener(ev, stopRecording));
  micBtn.addEventListener('touchend', stopRecording);



  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
