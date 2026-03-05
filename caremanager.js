// ============================================================
// HaruLink - ケアマネ向けポータル
// ============================================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxDjkUXCAxHeyKH-j0iNwB2OoWEAizP094vrUynWOyW9TOUFNqXdPeDCZ2AqNzz0F4Swg/exec';

var currentCM = null;
var cmMessages = [];

function callAPI(action, params) {
  return fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: action, params: params || {} })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error);
    return data;
  });
}

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

// ログイン
document.getElementById('login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var pass = document.getElementById('login-pass').value;
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  callAPI('loginCareManager', { password: pass })
    .then(function(data) {
      if (data.success && data.user) {
        currentCM = data.user;
        initCMApp();
      } else {
        errEl.style.display = 'block';
      }
    })
    .catch(function() { errEl.style.display = 'block'; });
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
  currentCM = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-pass').value = '';
}

function loadCMData() {
  callAPI('getCareManagerData', { careManagerId: currentCM.id })
    .then(function(data) {
      cmMessages = data.messages || [];
      renderCMChat();
      var updated = document.getElementById('cm-last-updated');
      if (updated) updated.textContent = '最終更新: ' + new Date().toLocaleTimeString('ja-JP');
    })
    .catch(function() {});
}

function renderCMChat() {
  var wrap = document.getElementById('cm-chat-wrap');
  if (cmMessages.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><i class="fa fa-comment"></i><p>まだメッセージはありません。<br>施設管理者から連絡があればここに表示されます。</p></div>';
    return;
  }
  wrap.innerHTML = cmMessages.map(function(m) {
    var isMine = m['送信者'] === currentCM.name;
    return '<div class="chat-bubble ' + (isMine ? 'mine' : '') + '">' +
      '<div class="chat-avatar">' + (isMine ? esc(currentCM.name[0]) : '施') + '</div>' +
      '<div class="chat-content">' +
      '<div class="chat-name">' + esc(m['送信者']) + (m['件名'] ? '　' + esc(m['件名']) : '') + '</div>' +
      '<div class="chat-text">' + esc(m['本文']).replace(/\n/g,'<br>') + '</div>' +
      '<div class="chat-time">' + esc(String(m['送信日時'])) + '</div>' +
      '</div></div>';
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

function cmSendMessage() {
  var body = document.getElementById('cm-msg-input').value.trim();
  if (!body) return;
  callAPI('sendCareManagerMessage', {
    sender: currentCM.name,
    receiver: '施設管理者',
    message: body,
    careManagerId: currentCM.id,
    kind: 'ケアマネから'
  })
  .then(function() {
    document.getElementById('cm-msg-input').value = '';
    showToast('送信しました');
    loadCMData();
  })
  .catch(function() { showToast('送信に失敗しました', 'error'); });
}

// Enterキーで送信（Shift+Enterは改行）
document.getElementById('cm-msg-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    cmSendMessage();
  }
});

function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
