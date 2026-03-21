// ============================================================
// HaruLink - 家族向けポータル
// ============================================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxDjkUXCAxHeyKH-j0iNwB2OoWEAizP094vrUynWOyW9TOUFNqXdPeDCZ2AqNzz0F4Swg/exec';

var currentFamily = null;
var familyData = { messages: [], visits: [], notices: [] };

function callAPI(action, params) {
  var qs = 'action=' + encodeURIComponent(action);
  var p = params || {};
  Object.keys(p).forEach(function(k) {
    qs += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(p[k]);
  });
  return fetch(GAS_URL + '?' + qs)
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

  callAPI('loginFamily', { password: pass })
    .then(function(data) {
      if (data.success && data.user) {
        currentFamily = data.user;
        initFamilyApp();
      } else {
        errEl.style.display = 'block';
      }
    })
    .catch(function() { errEl.style.display = 'block'; });
});

function initFamilyApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('family-name-display').textContent = currentFamily.name + ' 様';
  document.getElementById('family-avatar').textContent = currentFamily.name ? currentFamily.name[0] : '家';
  var staffEl = document.getElementById('staff-name-display');
  if (staffEl) staffEl.textContent = currentFamily.staffName || '担当スタッフ';

  // 最低希望日を明日に設定
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('v-date').min = tomorrow.toISOString().slice(0,10);
  document.getElementById('v-date').value = tomorrow.toISOString().slice(0,10);

  loadFamilyData();
  setInterval(loadFamilyData, 30000);
}

function logout() {
  currentFamily = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-pass').value = '';
}

function showPortalPage(name, el) {
  document.querySelectorAll('.portal-page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.portal-nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('portal-page-' + name).classList.add('active');
  if (el) el.classList.add('active');
}

function loadFamilyData() {
  callAPI('getFamilyData', { familyId: currentFamily.id })
    .then(function(data) {
      familyData.messages = data.messages || [];
      familyData.visits   = data.visits   || [];
      familyData.notices  = data.notices  || [];
      renderFamilyChat();
      renderFamilyVisits();
      renderFamilyNotices();
    })
    .catch(function() {});
}

function renderFamilyChat() {
  var wrap = document.getElementById('family-chat-wrap');
  if (familyData.messages.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><i class="fa fa-comment"></i><p>メッセージはありません</p></div>';
    return;
  }
  wrap.innerHTML = familyData.messages.map(function(m) {
    var isMine = m['送信者'] === currentFamily.name;
    return '<div class="chat-bubble ' + (isMine ? 'mine' : '') + '">' +
      '<div class="chat-avatar">' + (isMine ? esc(currentFamily.name[0]) : 'S') + '</div>' +
      '<div class="chat-content">' +
      '<div class="chat-name">' + esc(m['送信者']) + '</div>' +
      '<div class="chat-text">' + esc(m['本文']).replace(/\n/g,'<br>') + '</div>' +
      '<div class="chat-time">' + esc(String(m['送信日時'])) + '</div>' +
      '</div></div>';
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

function familySendMessage() {
  var body = document.getElementById('family-msg-input').value.trim();
  if (!body) return;
  callAPI('postMessage', {
    sender: currentFamily.name,
    receiver: currentFamily.staffName || '担当スタッフ',
    message: body,
    familyId: currentFamily.id
  })
  .then(function() {
    document.getElementById('family-msg-input').value = '';
    showToast('メッセージを送信しました');
    loadFamilyData();
  })
  .catch(function() { showToast('送信に失敗しました', 'error'); });
}

function renderFamilyVisits() {
  var el = document.getElementById('family-visits-list');
  if (familyData.visits.length === 0) {
    el.innerHTML = '<div class="empty-state"><i class="fa fa-calendar"></i><p>予約履歴はありません</p></div>';
    return;
  }
  var listHtml = familyData.visits.slice().reverse().map(function(v) {
    var st = v['ステータス'] || '';
    var badgeClass = st === '申請中' ? 'badge-pending'
                   : st === '承認'   ? 'badge-approved'
                   : st === 'キャンセル' ? 'badge-cancel'
                   : 'badge-rejected';
    return '<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100)">' +
      '<span class="badge ' + badgeClass + '">' + esc(st) + '</span>' +
      '<div style="flex:1">' +
        '<div style="font-weight:600;font-size:14px">' + formatDate(v['希望日']) + ' ' + esc(v['希望時間']) + '</div>' +
        '<div style="font-size:12px;color:var(--gray-500)">' + esc(v['目的'] || v['備考'] || '') + ' / ' + esc(String(v['人数'] || '')) + '名</div>' +
      '</div>' +
      '</div>';
  }).join('');

  // キャンセルのご案内
  var cancelNote = '<div style="margin-top:16px;padding:12px 14px;background:#fff8e1;border-left:4px solid #f59e0b;border-radius:6px;font-size:13px;color:#92400e;">' +
    '<i class="fa fa-phone" style="margin-right:6px"></i>' +
    '<strong>予約のキャンセルは施設へお電話ください。</strong><br>' +
    '<span style="font-size:12px;margin-top:4px;display:block">ご来院できなくなった場合は、お早めにご連絡いただけますと助かります。</span>' +
    '</div>';

  el.innerHTML = listHtml + cancelNote;
}

function familyRequestVisit() {
  var date = document.getElementById('v-date').value;
  var time = document.getElementById('v-time').value;
  var people = document.getElementById('v-people').value;
  var purpose = document.getElementById('v-purpose').value;
  if (!date) { showToast('希望日を選択してください', 'warning'); return; }

  // 確認ダイアログを表示
  var d = new Date(date);
  var dateStr = d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
  document.getElementById('confirm-date').textContent    = dateStr;
  document.getElementById('confirm-time').textContent    = time;
  document.getElementById('confirm-people').textContent  = people + '名';
  document.getElementById('confirm-purpose').textContent = purpose;
  document.getElementById('confirm-resident').textContent = currentFamily.residentName || '';
  document.getElementById('visit-confirm-modal').style.display = 'flex';

  // OKボタンに送信処理をセット
  document.getElementById('confirm-ok-btn').onclick = function() {
    document.getElementById('visit-confirm-modal').style.display = 'none';
    callAPI('requestVisit', {
      applicant: currentFamily.name,
      residentName: currentFamily.residentName,
      familyId: currentFamily.id,
      date: date, time: time, people: people, purpose: purpose
    })
    .then(function() {
      showVisitComplete(dateStr, time, people, purpose);
      loadFamilyData();
    })
    .catch(function() { showToast('申請に失敗しました', 'error'); });
  };
}

function closeVisitConfirm() {
  document.getElementById('visit-confirm-modal').style.display = 'none';
}

function showVisitComplete(dateStr, time, people, purpose) {
  document.getElementById('complete-date').textContent    = dateStr;
  document.getElementById('complete-time').textContent    = time;
  document.getElementById('complete-people').textContent  = people + '名';
  document.getElementById('complete-purpose').textContent = purpose;
  document.getElementById('visit-complete-modal').style.display = 'flex';
}

function closeVisitComplete() {
  document.getElementById('visit-complete-modal').style.display = 'none';
}

function renderFamilyNotices() {
  var el = document.getElementById('family-notices-list');
  if (familyData.notices.length === 0) {
    el.innerHTML = '<div class="empty-state"><i class="fa fa-bell-slash"></i><p>お知らせはありません</p></div>';
    return;
  }
  el.innerHTML = familyData.notices.slice().reverse().map(function(n) {
    return '<div class="notice-item">' +
      '<div class="notice-title">' + esc(n['タイトル']) + '</div>' +
      '<div class="notice-meta">' + esc(String(n['送信日時'])) + '</div>' +
      '<div class="notice-body">' + esc(n['本文']).replace(/\n/g,'<br>') + '</div>' +
      '</div>';
  }).join('');
}

function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(val) {
  if (!val) return '';
  var d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
}
