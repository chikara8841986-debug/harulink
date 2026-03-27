// ============================================================
// HaruLink - ケアマネ向けポータル（Firebase版）
// ============================================================

var currentCM = null;  // { id, name, org, email }
var cmMessages = [];

// ============================================================
// ユーティリティ
// ============================================================
function showToast(msg, type) {
  var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
  var t = type || 'success';
  var el = document.createElement('div');
  el.className = 'toast toast-' + t;
  el.innerHTML = '<i class="fa ' + (icons[t]||icons.success) + '"></i><span>' + msg + '</span>';
  document.getElementById('toast-container').appendChild(el);
  setTimeout(function() {
    el.style.opacity = '0'; el.style.transition = 'opacity .3s';
    setTimeout(function() { el.remove(); }, 300);
  }, 3200);
}

function togglePass(id) {
  var input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtDate(ts) {
  if (!ts) return '';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') +
         ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function nowTimestamp() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

// ============================================================
// ログイン
// ============================================================
document.getElementById('login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var email = document.getElementById('login-email')
    ? document.getElementById('login-email').value.trim()
    : '';
  var pass = document.getElementById('login-pass').value;
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!email) {
    errEl.style.display = 'block';
    return;
  }

  auth.signInWithEmailAndPassword(email, pass)
    .then(function() {
      return db.collection(COLLECTIONS.CAREMANAGERS).where('email', '==', email).limit(1).get();
    })
    .then(function(snapshot) {
      if (snapshot.empty) throw new Error('ケアマネ情報が見つかりません');
      var doc = snapshot.docs[0];
      var data = doc.data();
      currentCM = {
        id: doc.id,
        name: data.name,
        org: data.org || '',
        email: data.email
      };
      initCMApp();
    })
    .catch(function(err) {
      console.error('CM login error:', err);
      errEl.style.display = 'block';
    });
});

function initCMApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('cm-name-display').textContent = currentCM.name + ' 様';
  document.getElementById('cm-org-display').textContent = currentCM.org || '';
  document.getElementById('cm-avatar').textContent = currentCM.name ? currentCM.name[0] : 'ケ';
  loadCMData();
  setInterval(loadCMData, 30000);
}

function logout() {
  auth.signOut().then(function() {
    currentCM = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-pass').value = '';
    var emailEl = document.getElementById('login-email');
    if (emailEl) emailEl.value = '';
  });
}

// ============================================================
// データ読み込み（Firestore）
// ============================================================
function loadCMData() {
  if (!currentCM) return;
  db.collection(COLLECTIONS.MESSAGES)
    .where('type', '==', 'ケアマネ')
    .where('careManagerId', '==', currentCM.id)
    .orderBy('createdAt', 'asc')
    .get()
    .then(function(snapshot) {
      // このケアマネ宛 + このケアマネからのメッセージ
      cmMessages = snapshot.docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      renderCMChat();
      var updated = document.getElementById('cm-last-updated');
      if (updated) updated.textContent = '最終更新: ' + new Date().toLocaleTimeString('ja-JP');
    })
    .catch(function(err) { console.error('loadCMData error:', err); });
}

// ============================================================
// チャット表示
// ============================================================
function renderCMChat() {
  var wrap = document.getElementById('cm-chat-wrap');
  if (cmMessages.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><i class="fa fa-comment"></i><p>まだメッセージはありません。<br>施設管理者から連絡があればここに表示されます。</p></div>';
    return;
  }
  wrap.innerHTML = cmMessages.map(function(m) {
    var isMine = m.sender === currentCM.name;
    return '<div class="chat-bubble ' + (isMine ? 'mine' : '') + '">' +
      '<div class="chat-avatar">' + (isMine ? esc(currentCM.name[0]) : '施') + '</div>' +
      '<div class="chat-content">' +
      '<div class="chat-name">' + esc(m.sender) + (m.subject ? '　' + esc(m.subject) : '') + '</div>' +
      '<div class="chat-text">' + esc(m.body).replace(/\n/g,'<br>') + '</div>' +
      '<div class="chat-time">' + fmtDate(m.createdAt) + '</div>' +
      '</div></div>';
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

// ============================================================
// メッセージ送信
// ============================================================
function cmSendMessage() {
  var body = document.getElementById('cm-msg-input').value.trim();
  if (!body) return;
  db.collection(COLLECTIONS.MESSAGES).add({
    sender: currentCM.name,
    receiver: '施設管理者',
    body: body,
    careManagerId: currentCM.id,
    type: 'ケアマネ',
    isRead: false,
    createdAt: nowTimestamp()
  }).then(function() {
    document.getElementById('cm-msg-input').value = '';
    showToast('送信しました');
    loadCMData();
  }).catch(function() { showToast('送信に失敗しました', 'error'); });
}

// Enterキーで送信（Shift+Enterは改行）
document.getElementById('cm-msg-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    cmSendMessage();
  }
});
