// ============================================================
// HaruLink - 家族向けポータル（Firebase版）
// ============================================================

var currentFamily = null;  // { id, name, residentName, residentId, staffName, email }
var familyData = { messages: [], visits: [], notices: [], photos: [] };

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

function formatDate(val) {
  if (!val) return '';
  var d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
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
    : document.getElementById('login-pass').getAttribute('data-email') || '';
  var pass = document.getElementById('login-pass').value;
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  // メールアドレスフィールドがない場合（パスワードのみ入力の旧UI対応）
  // Firestoreからemailを逆引き
  if (!email) {
    // パスワードでFirestore検索（family側はemail必須なので、ここではpassからの逆引きは行わない）
    errEl.style.display = 'block';
    return;
  }

  auth.signInWithEmailAndPassword(email, pass)
    .then(function(userCred) {
      var uid = userCred.user.uid;
      // Firestoreから家族情報を取得
      return db.collection(COLLECTIONS.FAMILIES).where('email', '==', email).limit(1).get();
    })
    .then(function(snapshot) {
      if (snapshot.empty) throw new Error('家族情報が見つかりません');
      var doc = snapshot.docs[0];
      var data = doc.data();
      currentFamily = {
        id: doc.id,
        name: data.name,
        residentName: data.residentName || '',
        residentId: data.residentId || '',
        staffName: data.staffName || '担当スタッフ',
        email: data.email
      };
      initFamilyApp();
    })
    .catch(function(err) {
      console.error('Family login error:', err);
      errEl.style.display = 'block';
    });
});

function initFamilyApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('family-name-display').textContent = currentFamily.name + ' 様';
  document.getElementById('family-avatar').textContent = currentFamily.name ? currentFamily.name[0] : '家';
  var staffEl = document.getElementById('staff-name-display');
  if (staffEl) staffEl.textContent = currentFamily.staffName || '担当スタッフ';

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('v-date').min = tomorrow.toISOString().slice(0,10);
  document.getElementById('v-date').value = tomorrow.toISOString().slice(0,10);

  showPortalPage('notices', document.querySelector('.portal-nav-item[data-page="notices"]'));
  loadFamilyData();
  setInterval(loadFamilyData, 30000);
}

function logout() {
  auth.signOut().then(function() {
    currentFamily = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-pass').value = '';
    var emailEl = document.getElementById('login-email');
    if (emailEl) emailEl.value = '';
  });
}

// ============================================================
// ページ切り替え
// ============================================================
function showPortalPage(name, el) {
  document.querySelectorAll('.portal-page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.portal-nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('portal-page-' + name).classList.add('active');
  if (el) el.classList.add('active');
}

// ============================================================
// データ読み込み（Firestore）
// ============================================================
function loadFamilyData() {
  if (!currentFamily) return;

  var loads = [
    // このご家族に関係するメッセージ（送信者または受信者）
    db.collection(COLLECTIONS.MESSAGES)
      .where('familyId', '==', currentFamily.id)
      .orderBy('createdAt', 'asc').get(),
    // この利用者への面会予約
    db.collection(COLLECTIONS.VISITS)
      .where('familyId', '==', currentFamily.id)
      .orderBy('createdAt', 'desc').get(),
    // 全員向けのお知らせ（broadcasts）
    db.collection(COLLECTIONS.BROADCASTS)
      .orderBy('createdAt', 'desc').limit(20).get(),
    // 写真
    db.collection(COLLECTIONS.PHOTOS)
      .where('residentId', '==', currentFamily.residentId)
      .orderBy('createdAt', 'desc').limit(50).get()
  ];

  Promise.all(loads)
    .then(function(results) {
      familyData.messages = results[0].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      familyData.visits   = results[1].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      familyData.notices  = results[2].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      familyData.photos   = results[3].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      renderFamilyChat();
      renderFamilyVisits();
      renderFamilyNotices();
      renderFamilyPhotos();
    })
    .catch(function(err) { console.error('loadFamilyData error:', err); });
}

// ============================================================
// チャット
// ============================================================
function renderFamilyChat() {
  var wrap = document.getElementById('family-chat-wrap');
  if (familyData.messages.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><i class="fa fa-comment"></i><p>メッセージはありません</p></div>';
    return;
  }
  wrap.innerHTML = familyData.messages.map(function(m) {
    var isMine = m.sender === currentFamily.name;
    return '<div class="chat-bubble ' + (isMine ? 'mine' : '') + '">' +
      '<div class="chat-avatar">' + (isMine ? esc(currentFamily.name[0]) : 'S') + '</div>' +
      '<div class="chat-content">' +
      '<div class="chat-name">' + esc(m.sender) + '</div>' +
      '<div class="chat-text">' + esc(m.body).replace(/\n/g,'<br>') + '</div>' +
      '<div class="chat-time">' + fmtDate(m.createdAt) + '</div>' +
      '</div></div>';
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

function familySendMessage() {
  var body = document.getElementById('family-msg-input').value.trim();
  if (!body) return;
  db.collection(COLLECTIONS.MESSAGES).add({
    sender: currentFamily.name,
    receiver: currentFamily.staffName || '担当スタッフ',
    body: body,
    familyId: currentFamily.id,
    isRead: false,
    type: '家族',
    createdAt: nowTimestamp()
  }).then(function() {
    document.getElementById('family-msg-input').value = '';
    showToast('メッセージを送信しました');
    loadFamilyData();
  }).catch(function() { showToast('送信に失敗しました', 'error'); });
}

// ============================================================
// 面会予約
// ============================================================
function renderFamilyVisits() {
  var el = document.getElementById('family-visits-list');
  if (familyData.visits.length === 0) {
    el.innerHTML = '<div class="empty-state"><i class="fa fa-calendar"></i><p>予約履歴はありません</p></div>';
    return;
  }
  var listHtml = familyData.visits.slice().reverse().map(function(v) {
    var st = v.status || '';
    var badgeClass = st === '申請中' ? 'badge-pending' : st === '承認' ? 'badge-approved' : st === 'キャンセル' ? 'badge-cancel' : 'badge-rejected';
    return '<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100)">' +
      '<span class="badge ' + badgeClass + '">' + esc(st) + '</span>' +
      '<div style="flex:1">' +
        '<div style="font-weight:600;font-size:14px">' + formatDate(v.visitDate) + ' ' + esc(v.visitTime) + '</div>' +
        '<div style="font-size:12px;color:var(--gray-500)">' + esc(v.purpose||'') + ' / ' + esc(String(v.numPeople||'')) + '名</div>' +
      '</div>' +
      '</div>';
  }).join('');

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

  var d = new Date(date);
  var dateStr = d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
  document.getElementById('confirm-date').textContent    = dateStr;
  document.getElementById('confirm-time').textContent    = time;
  document.getElementById('confirm-people').textContent  = people + '名';
  document.getElementById('confirm-purpose').textContent = purpose;
  document.getElementById('confirm-resident').textContent = currentFamily.residentName || '';
  document.getElementById('visit-confirm-modal').style.display = 'flex';

  document.getElementById('confirm-ok-btn').onclick = function() {
    document.getElementById('visit-confirm-modal').style.display = 'none';
    db.collection(COLLECTIONS.VISITS).add({
      applicantName: currentFamily.name,
      residentName: currentFamily.residentName,
      residentId: currentFamily.residentId,
      familyId: currentFamily.id,
      visitDate: date,
      visitTime: time,
      numPeople: parseInt(people) || 1,
      purpose: purpose,
      status: '申請中',
      createdAt: nowTimestamp()
    }).then(function() {
      showVisitComplete(dateStr, time, people, purpose);
      loadFamilyData();
    }).catch(function() { showToast('申請に失敗しました', 'error'); });
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

// ============================================================
// お知らせ
// ============================================================
function renderFamilyNotices() {
  var el = document.getElementById('family-notices-list');
  if (familyData.notices.length === 0) {
    el.innerHTML = '<div class="empty-state"><i class="fa fa-bell-slash"></i><p>お知らせはありません</p></div>';
    return;
  }
  el.innerHTML = familyData.notices.map(function(n) {
    return '<div class="notice-item">' +
      '<div class="notice-title">' + esc(n.title) + '</div>' +
      '<div class="notice-meta">' + fmtDate(n.createdAt) + '</div>' +
      '<div class="notice-body">' + esc(n.body).replace(/\n/g,'<br>') + '</div>' +
      '</div>';
  }).join('');
}

// ============================================================
// 写真
// ============================================================
function renderFamilyPhotos() {
  var el = document.getElementById('family-photos-list');
  if (!familyData.photos || familyData.photos.length === 0) {
    el.innerHTML = '<div class="empty-state"><i class="fa fa-image"></i><p>写真はまだありません</p></div>';
    return;
  }
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:4px">';
  familyData.photos.forEach(function(p) {
    var url  = p.dataUrl || p.url || '';
    var date = fmtDate(p.createdAt);
    var memo = p.memo || '';
    if (!url) return;
    html += '<div style="border-radius:10px;overflow:hidden;background:#f8fafc;box-shadow:0 2px 8px rgba(0,0,0,.07);cursor:pointer" onclick="openPhotoModal(\'' + url.substring(0,50).replace(/'/g,"\\'") + '...\',\'' + esc(date) + ' ' + esc(memo) + '\')">' +
      '<div style="width:100%;aspect-ratio:1/1;overflow:hidden">' +
        '<img src="' + url + '" alt="' + esc(memo) + '" style="width:100%;height:100%;object-fit:cover;transition:transform .2s" loading="lazy" onerror="this.parentNode.style.background=\'#e2e8f0\'">' +
      '</div>' +
      '<div style="padding:8px 10px">' +
        '<div style="font-size:11px;color:#64748b">' + esc(date) + '</div>' +
        (memo ? '<div style="font-size:12px;color:#334155;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(memo) + '</div>' : '') +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function openPhotoModal(url, caption) {
  document.getElementById('photo-modal-img').src = url;
  document.getElementById('photo-modal-caption').textContent = caption;
  document.getElementById('photo-modal').style.display = 'flex';
}

function closePhotoModal() {
  document.getElementById('photo-modal').style.display = 'none';
  document.getElementById('photo-modal-img').src = '';
}
