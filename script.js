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
    attachCooldown();
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

  // ---------- chat rendering ----------
  function addBubble(m, who) {
    const div = document.createElement('div');
    div.className = 'bubble ' + who;
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
      addBubble(m, who);
      if (!firstBatch && m.sender !== myName && m.text) {
        setOrbMood(detectMood(m.text));
        checkCooldownTrigger(m.text, othersRecentNegatives);
      }
    });
    setTimeout(() => { firstBatch = false; }, 800);
  }

  function sendMessage(text, badge, type, media) {
    roomRef.child('messages').push({
      sender: myName, text: text || '', badge: badge || null,
      type: type || 'text', media: media || null, ts: Date.now()
    });
    roomRef.child('typing/' + safeKey(myName)).remove();
    touchLastActivity();
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
      document.querySelectorAll('#doodleColors .swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
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
    ref.set({ name: myName, color: doodleColor, points: currentPoints });
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
    Object.values(allStrokes).forEach(stroke => {
      if (!stroke || !stroke.points || stroke.points.length < 2) return;
      dctx.strokeStyle = stroke.color || '#FF87AB';
      dctx.lineWidth = 4;
      dctx.lineCap = 'round';
      dctx.lineJoin = 'round';
      dctx.beginPath();
      stroke.points.forEach((pt, i) => {
        const x = pt.x * doodleCanvas.width, y = pt.y * doodleCanvas.height;
        if (i === 0) dctx.moveTo(x, y); else dctx.lineTo(x, y);
      });
      dctx.stroke();
    });
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
