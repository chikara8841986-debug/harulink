// ============================================================
// HaruLink - スタッフ用フロントエンド（Firebase版）
// ============================================================

// ============================================================
// 状態管理
// ============================================================
var currentUser = null;   // { id, name, role, dept, email }
var appData = {
  messages: [], broadcasts: [], visits: [], suspends: [],
  residents: [], families: [], caremanagers: [], staff: []
};

// ============================================================
// ユーティリティ
// ============================================================
function showLoading() { document.getElementById('loading-overlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

function showToast(msg, type) {
  var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
  var t = type || 'success';
  var el = document.createElement('div');
  el.className = 'toast toast-' + t;
  el.innerHTML = '<i class="fa ' + (icons[t] || icons.success) + '"></i><span>' + msg + '</span>';
  document.getElementById('toast-container').appendChild(el);
  setTimeout(function() {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all .3s ease';
    setTimeout(function() { el.remove(); }, 300);
  }, 3200);
}

function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function nowTimestamp() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

function fmtDate(ts) {
  if (!ts) return '';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') +
         ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

// ============================================================
// ログイン・ログアウト
// ============================================================
document.getElementById('login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var id = document.getElementById('login-id').value.trim();
  var pass = document.getElementById('login-pass').value;
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  showLoading();

  // Firestoreでスタッフを検索してメールアドレスを取得
  db.collection(COLLECTIONS.STAFF).where('staffId', '==', id).limit(1).get()
    .then(function(snapshot) {
      if (snapshot.empty) {
        hideLoading();
        errEl.style.display = 'block';
        return;
      }
      var doc = snapshot.docs[0];
      var staffData = doc.data();
      var email = staffData.email;
      if (!email) throw new Error('メールアドレスが未設定です');
      // Firebase Authでログイン
      return auth.signInWithEmailAndPassword(email, pass)
        .then(function() {
          currentUser = {
            id: doc.id,
            staffId: staffData.staffId,
            name: staffData.name,
            role: staffData.role,
            dept: staffData.dept,
            email: email
          };
          hideLoading();
          initApp();
        });
    })
    .catch(function(err) {
      hideLoading();
      console.error('Login error:', err);
      errEl.style.display = 'block';
    });
});

function initApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  document.getElementById('staff-name-display').textContent = currentUser.name;
  document.getElementById('staff-avatar').textContent = currentUser.name ? currentUser.name[0] : 'S';
  var roleBadge = document.getElementById('staff-role-badge');
  roleBadge.textContent = currentUser.role;
  if (currentUser.role === '管理者') roleBadge.classList.add('admin');

  applyRoleUI();
  updateDateTime();
  setInterval(updateDateTime, 60000);
  loadAll();
}

function applyRoleUI() {
  var isAdmin = currentUser.role === '管理者';
  document.querySelectorAll('.nav-admin-only').forEach(function(el) {
    if (!isAdmin) el.classList.add('grayed');
    else el.classList.remove('grayed');
  });
}

function logout() {
  auth.signOut().then(function() {
    currentUser = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-id').value = '';
    document.getElementById('login-pass').value = '';
  });
}

// ============================================================
// 日時・挨拶
// ============================================================
function updateDateTime() {
  var now = new Date();
  var days = ['日','月','火','水','木','金','土'];
  document.getElementById('topbar-date').textContent =
    now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日（' + days[now.getDay()] + '）';
  var h = now.getHours();
  var greeting = h < 12 ? 'おはようございます' : h < 18 ? 'こんにちは' : 'お疲れさまです';
  var greetEl = document.getElementById('dashboard-greeting');
  if (greetEl && currentUser) greetEl.textContent = greeting + '、' + currentUser.name + ' さん';
}

// ============================================================
// ページ切り替え
// ============================================================
var pageTitles = {
  dashboard: 'ダッシュボード', messages: 'メッセージ', visits: '面会予約管理',
  broadcast: '一斉通知', suspend: '面会中止設定', 'caremanager-msg': 'ケアマネ連絡',
  residents: '利用者管理', families: '家族管理', caremanagers: 'ケアマネ管理', staff: 'スタッフ管理'
};

function showPage(name, navEl) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
  if (navEl) navEl.classList.add('active');
  else {
    var found = document.querySelector('.nav-item[data-page="' + name + '"]');
    if (found) found.classList.add('active');
  }
  document.getElementById('page-title').textContent = pageTitles[name] || name;
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) sidebar.classList.toggle('mobile-open');
  else sidebar.classList.toggle('collapsed');
}

function togglePass(id) {
  var input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function generatePass(inputId) {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var pass = '';
  for (var i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById(inputId).value = pass;
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ============================================================
// データ全件読み込み（Firestore）
// ============================================================
function loadAll() {
  showLoading();
  var loads = [
    db.collection(COLLECTIONS.MESSAGES).orderBy('createdAt', 'asc').get(),
    db.collection(COLLECTIONS.BROADCASTS).orderBy('createdAt', 'desc').get(),
    db.collection(COLLECTIONS.VISITS).orderBy('createdAt', 'desc').get(),
    db.collection(COLLECTIONS.SUSPENDS).orderBy('createdAt', 'desc').get(),
    db.collection(COLLECTIONS.RESIDENTS).orderBy('name', 'asc').get(),
    db.collection(COLLECTIONS.FAMILIES).orderBy('name', 'asc').get(),
    db.collection(COLLECTIONS.CAREMANAGERS).orderBy('name', 'asc').get(),
    db.collection(COLLECTIONS.STAFF).orderBy('name', 'asc').get()
  ];

  Promise.all(loads)
    .then(function(results) {
      appData.messages     = results[0].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      appData.broadcasts   = results[1].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      appData.visits       = results[2].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      appData.suspends     = results[3].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      appData.residents    = results[4].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      appData.families     = results[5].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      appData.caremanagers = results[6].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      appData.staff        = results[7].docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
      renderAll();
      hideLoading();
    })
    .catch(function(err) {
      hideLoading();
      console.error('loadAll error:', err);
      showToast('データの読み込みに失敗しました', 'error');
      renderAll();
    });
}

function renderAll() {
  renderDashboard();
  renderMessages();
  renderVisits();
  renderBroadcasts();
  renderSuspends();
  renderCareManagerMsgs();
  renderResidents();
  renderFamilies();
  renderCareManagers();
  renderStaff();
  populateSelects();
}

// ============================================================
// ダッシュボード
// ============================================================
function renderDashboard() {
  var unread = appData.messages.filter(function(m) { return !m.isRead; }).length;
  var pendingVisits = appData.visits.filter(function(v) { return v.status === '申請中'; }).length;
  var todayStr = new Date().toISOString().slice(0,10);
  var todayVisits = appData.visits.filter(function(v) {
    var d = v.visitDate ? v.visitDate.slice(0,10) : '';
    return d === todayStr && v.status === '承認';
  }).length;

  document.getElementById('kpi-unread').textContent = unread;
  document.getElementById('kpi-pending-visits').textContent = pendingVisits;
  document.getElementById('kpi-residents').textContent = appData.residents.length;
  document.getElementById('kpi-today-visits').textContent = todayVisits;

  var msgBadge = document.getElementById('badge-messages');
  msgBadge.textContent = unread;
  msgBadge.style.display = unread > 0 ? 'inline-block' : 'none';
  var visitBadge = document.getElementById('badge-visits');
  visitBadge.textContent = pendingVisits;
  visitBadge.style.display = pendingVisits > 0 ? 'inline-block' : 'none';

  var dashMsgs = document.getElementById('dashboard-messages');
  var msgs = appData.messages.slice(-5).reverse();
  if (msgs.length === 0) {
    dashMsgs.innerHTML = '<div class="empty-state"><i class="fa fa-inbox"></i><p>メッセージはありません</p></div>';
  } else {
    dashMsgs.innerHTML = msgs.map(function(m) {
      return '<div class="dash-msg-item">' +
        '<div class="dash-msg-dot ' + (m.isRead ? 'read' : '') + '"></div>' +
        '<div><div class="dash-msg-sender">' + esc(m.sender) + ' → ' + esc(m.receiver) + '</div>' +
        '<div class="dash-msg-body">' + esc(m.body) + '</div>' +
        '<div class="dash-msg-time">' + fmtDate(m.createdAt) + '</div></div>' +
        '</div>';
    }).join('');
  }

  var dashVisits = document.getElementById('dashboard-visits');
  var pending = appData.visits.filter(function(v) { return v.status === '申請中'; }).slice(0, 5);
  if (pending.length === 0) {
    dashVisits.innerHTML = '<div class="empty-state"><i class="fa fa-calendar"></i><p>申請中の予約はありません</p></div>';
  } else {
    dashVisits.innerHTML = pending.map(function(v) {
      return '<div class="dash-visit-item">' +
        '<span class="badge badge-pending">申請中</span>' +
        '<div><strong>' + esc(v.residentName) + '</strong> への面会</div>' +
        '<div style="color:var(--gray-500);font-size:12px">' + esc(v.applicantName) + ' / ' + esc(v.visitDate) + '</div>' +
        '</div>';
    }).join('');
  }
}

// ============================================================
// メッセージ
// ============================================================
function renderMessages(data) {
  var rows = data || appData.messages;
  var tbody = document.getElementById('messages-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty"><i class="fa fa-inbox" style="font-size:24px;display:block;margin-bottom:8px"></i>メッセージはありません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.slice().reverse().map(function(m) {
    return '<tr>' +
      '<td><span class="badge ' + (m.isRead ? 'badge-read' : 'badge-unread') + '">' + (m.isRead ? '既読' : '未読') + '</span></td>' +
      '<td>' + esc(m.sender) + '</td>' +
      '<td>' + esc(m.receiver) + '</td>' +
      '<td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(m.body) + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + fmtDate(m.createdAt) + '</td>' +
      '</tr>';
  }).join('');
}

function filterMessages() {
  var q = document.getElementById('msg-search').value.toLowerCase();
  var f = document.getElementById('msg-filter').value;
  var filtered = appData.messages.filter(function(m) {
    var match = !q || (m.sender||'').toLowerCase().includes(q) || (m.receiver||'').toLowerCase().includes(q) || (m.body||'').toLowerCase().includes(q);
    var fmatch = !f || (f === '未読' && !m.isRead);
    return match && fmatch;
  });
  renderMessages(filtered);
}

function sendMessage() {
  var receiver = document.getElementById('msg-receiver').value.trim();
  var body = document.getElementById('msg-body').value.trim();
  if (!receiver || !body) { showToast('受信者とメッセージ内容を入力してください', 'warning'); return; }
  showLoading();
  db.collection(COLLECTIONS.MESSAGES).add({
    sender: currentUser.name,
    receiver: receiver,
    body: body,
    isRead: false,
    type: 'スタッフ',
    createdAt: nowTimestamp()
  }).then(function() {
    closeModal('modal-send-message');
    document.getElementById('msg-receiver').value = '';
    document.getElementById('msg-body').value = '';
    showToast('メッセージを送信しました');
    loadAll();
  }).catch(function() { hideLoading(); showToast('送信に失敗しました', 'error'); });
}

// ============================================================
// 面会予約
// ============================================================
function renderVisits(data) {
  var rows = data || appData.visits;
  var tbody = document.getElementById('visits-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">面会予約はありません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.slice().reverse().map(function(v) {
    var st = v.status || '';
    var badgeClass = st === '申請中' ? 'badge-pending' : st === '承認' ? 'badge-approved' : st === 'キャンセル' ? 'badge-cancel' : 'badge-rejected';
    var btns = '';
    if (st === '申請中') {
      btns = '<button class="btn-icon btn-approve" onclick="approveVisit(\'' + v.id + '\',\'承認\')" title="承認"><i class="fa fa-check"></i></button>' +
             '<button class="btn-icon btn-reject" onclick="approveVisit(\'' + v.id + '\',\'却下\')" title="却下"><i class="fa fa-times"></i></button>' +
             '<button class="btn-icon btn-cancel" onclick="cancelVisit(\'' + v.id + '\')" title="キャンセル" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0"><i class="fa fa-ban"></i></button>';
    } else if (st === '承認') {
      btns = '<button class="btn-icon btn-cancel" onclick="cancelVisit(\'' + v.id + '\')" title="キャンセル" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0"><i class="fa fa-ban"></i></button>';
    }
    return '<tr>' +
      '<td><span class="badge ' + badgeClass + '">' + esc(st) + '</span></td>' +
      '<td>' + esc(v.applicantName) + '</td>' +
      '<td>' + esc(v.residentName) + '</td>' +
      '<td>' + esc(v.visitDate) + '</td>' +
      '<td>' + esc(v.visitTime) + '</td>' +
      '<td>' + esc(String(v.numPeople||'')) + '</td>' +
      '<td>' + esc(v.purpose||'') + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + fmtDate(v.createdAt) + '</td>' +
      '<td><div style="display:flex;gap:4px">' + btns + '</div></td>' +
      '</tr>';
  }).join('');
}

function filterVisits() {
  var q = document.getElementById('visit-search').value.toLowerCase();
  var f = document.getElementById('visit-filter').value;
  var filtered = appData.visits.filter(function(v) {
    var match = !q || (v.applicantName||'').toLowerCase().includes(q) || (v.residentName||'').toLowerCase().includes(q);
    var fmatch = !f || v.status === f;
    return match && fmatch;
  });
  renderVisits(filtered);
}

function approveVisit(id, status) {
  showLoading();
  db.collection(COLLECTIONS.VISITS).doc(id).update({ status: status, updatedAt: nowTimestamp() })
    .then(function() {
      var msg = status === '承認' ? '面会を承認しました' : '面会を却下しました';
      var type = status === '承認' ? 'success' : 'warning';
      showToast(msg, type);
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('操作に失敗しました', 'error'); });
}

function cancelVisit(id) {
  if (!confirm('この面会予約をキャンセルしますか？\n（ご家族にはお電話でご連絡ください）')) return;
  showLoading();
  db.collection(COLLECTIONS.VISITS).doc(id).update({ status: 'キャンセル', updatedAt: nowTimestamp() })
    .then(function() {
      showToast('面会予約をキャンセルしました', 'warning');
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('操作に失敗しました', 'error'); });
}

// ============================================================
// 一斉通知
// ============================================================
function renderBroadcasts(data) {
  var rows = data || appData.broadcasts;
  var tbody = document.getElementById('broadcast-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">一斉通知はありません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.slice().reverse().map(function(b) {
    return '<tr>' +
      '<td><strong>' + esc(b.title) + '</strong></td>' +
      '<td><span class="badge badge-read">' + esc(b.target) + '</span></td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + fmtDate(b.createdAt) + '</td>' +
      '<td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(b.body) + '</td>' +
      '</tr>';
  }).join('');
}

function sendBroadcast() {
  var title = document.getElementById('bc-title').value.trim();
  var body = document.getElementById('bc-body').value.trim();
  var target = document.getElementById('bc-target').value;
  if (!title || !body) { showToast('タイトルと本文を入力してください', 'warning'); return; }
  showLoading();
  db.collection(COLLECTIONS.BROADCASTS).add({
    title: title,
    body: body,
    target: target,
    sender: currentUser.name,
    createdAt: nowTimestamp()
  }).then(function() {
    closeModal('modal-broadcast');
    document.getElementById('bc-title').value = '';
    document.getElementById('bc-body').value = '';
    showToast('一斉通知を送信しました');
    loadAll();
  }).catch(function() { hideLoading(); showToast('送信に失敗しました', 'error'); });
}

// ============================================================
// 面会中止設定
// ============================================================
function renderSuspends(data) {
  var rows = data || appData.suspends;
  var tbody = document.getElementById('suspend-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">面会中止設定はありません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.slice().reverse().map(function(s) {
    return '<tr>' +
      '<td>' + esc(s.startDate) + '</td>' +
      '<td>' + esc(s.endDate) + '</td>' +
      '<td>' + esc(s.reason) + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + fmtDate(s.createdAt) + '</td>' +
      '</tr>';
  }).join('');
}

function setSuspend() {
  var start = document.getElementById('suspend-start').value;
  var end = document.getElementById('suspend-end').value;
  var reason = document.getElementById('suspend-reason').value.trim();
  if (!start || !end) { showToast('開始日と終了日を入力してください', 'warning'); return; }
  if (start > end) { showToast('開始日は終了日より前にしてください', 'warning'); return; }
  showLoading();
  db.collection(COLLECTIONS.SUSPENDS).add({
    startDate: start,
    endDate: end,
    reason: reason,
    setter: currentUser.name,
    createdAt: nowTimestamp()
  }).then(function() {
    closeModal('modal-suspend');
    document.getElementById('suspend-start').value = '';
    document.getElementById('suspend-end').value = '';
    document.getElementById('suspend-reason').value = '';
    showToast('面会中止期間を設定しました');
    loadAll();
  }).catch(function() { hideLoading(); showToast('設定に失敗しました', 'error'); });
}

// ============================================================
// ケアマネ連絡
// ============================================================
function renderCareManagerMsgs(data) {
  var rows = data || appData.messages.filter(function(m) { return m.type === 'ケアマネ'; });
  var tbody = document.getElementById('caremanager-msg-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">ケアマネへの連絡はありません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.slice().reverse().map(function(m) {
    return '<tr>' +
      '<td><span class="badge ' + (m.isRead ? 'badge-read' : 'badge-unread') + '">' + (m.isRead ? '既読' : '未読') + '</span></td>' +
      '<td>' + esc(m.receiver) + '</td>' +
      '<td>' + esc(m.subject||'') + '</td>' +
      '<td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(m.body) + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + fmtDate(m.createdAt) + '</td>' +
      '</tr>';
  }).join('');
}

function sendCareManagerMsg() {
  var target = document.getElementById('cm-msg-target').value;
  var subject = document.getElementById('cm-msg-subject').value.trim();
  var body = document.getElementById('cm-msg-body').value.trim();
  if (!target) { showToast('送信先ケアマネを選択してください', 'warning'); return; }
  if (!subject || !body) { showToast('件名と本文を入力してください', 'warning'); return; }
  showLoading();
  db.collection(COLLECTIONS.MESSAGES).add({
    sender: currentUser.name,
    receiver: target,
    subject: subject,
    body: body,
    type: 'ケアマネ',
    isRead: false,
    createdAt: nowTimestamp()
  }).then(function() {
    closeModal('modal-caremanager-msg');
    document.getElementById('cm-msg-subject').value = '';
    document.getElementById('cm-msg-body').value = '';
    showToast('ケアマネへ連絡を送信しました');
    loadAll();
  }).catch(function() { hideLoading(); showToast('送信に失敗しました', 'error'); });
}

// ============================================================
// 利用者管理
// ============================================================
function renderResidents(data) {
  var rows = data || appData.residents;
  var tbody = document.getElementById('residents-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">利用者が登録されていません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(r) {
    return '<tr>' +
      '<td style="color:var(--gray-400);font-size:12px">' + esc(r.id) + '</td>' +
      '<td><strong>' + esc(r.name) + '</strong></td>' +
      '<td>' + esc(r.room) + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + esc(r.admissionDate||'') + '</td>' +
      '<td>' + esc(r.assignedStaff||'') + '</td>' +
      '<td><div style="display:flex;gap:4px">' +
        '<button class="btn-icon" onclick="openPhotoUpload(\'' + esc(r.id) + '\',\'' + esc(r.name) + '\')" title="写真追加" style="background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe"><i class="fa fa-camera"></i></button>' +
        '<button class="btn-icon btn-delete" onclick="deleteResident(\'' + r.id + '\')" title="削除"><i class="fa fa-trash"></i></button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

function filterResidents() {
  var q = document.getElementById('resident-search').value.toLowerCase();
  renderResidents(appData.residents.filter(function(r) {
    return !q || (r.name||'').toLowerCase().includes(q) || (String(r.room)||'').toLowerCase().includes(q);
  }));
}

function addResident() {
  var name = document.getElementById('res-name').value.trim();
  var room = document.getElementById('res-room').value.trim();
  var date = document.getElementById('res-date').value;
  var staff = document.getElementById('res-staff').value;
  if (!name || !room) { showToast('氏名と部屋番号は必須です', 'warning'); return; }
  showLoading();
  db.collection(COLLECTIONS.RESIDENTS).add({
    name: name, room: room, admissionDate: date, assignedStaff: staff, createdAt: nowTimestamp()
  }).then(function() {
    closeModal('modal-add-resident');
    document.getElementById('res-name').value = '';
    document.getElementById('res-room').value = '';
    document.getElementById('res-date').value = '';
    showToast('利用者を登録しました');
    loadAll();
  }).catch(function() { hideLoading(); showToast('登録に失敗しました', 'error'); });
}

function deleteResident(id) {
  if (!confirm('この利用者を削除しますか？')) return;
  showLoading();
  db.collection(COLLECTIONS.RESIDENTS).doc(id).delete()
    .then(function() { showToast('削除しました'); loadAll(); })
    .catch(function() { hideLoading(); showToast('削除に失敗しました', 'error'); });
}

// ============================================================
// 家族管理
// ============================================================
function renderFamilies(data) {
  var rows = data || appData.families;
  var tbody = document.getElementById('families-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">家族が登録されていません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(f) {
    return '<tr>' +
      '<td style="color:var(--gray-400);font-size:12px">' + esc(f.id) + '</td>' +
      '<td><strong>' + esc(f.name) + '</strong></td>' +
      '<td>' + esc(f.relation) + '</td>' +
      '<td>' + esc(f.residentName||'') + '</td>' +
      '<td style="font-size:12px">' + esc(f.email||'') + '</td>' +
      '<td><span class="badge badge-read" style="font-family:monospace">' + esc(f.displayPassword||'（非表示）') + '</span></td>' +
      '<td><button class="btn-icon btn-delete" onclick="deleteFamily(\'' + f.id + '\')" title="削除"><i class="fa fa-trash"></i></button></td>' +
      '</tr>';
  }).join('');
}

function filterFamilies() {
  var q = document.getElementById('family-search').value.toLowerCase();
  renderFamilies(appData.families.filter(function(f) {
    return !q || (f.name||'').toLowerCase().includes(q) || (f.residentName||'').toLowerCase().includes(q);
  }));
}

function addFamily() {
  var name = document.getElementById('fam-name').value.trim();
  var relation = document.getElementById('fam-relation').value;
  var residentId = document.getElementById('fam-resident').value;
  var pass = document.getElementById('fam-pass').value.trim();
  var email = document.getElementById('fam-email').value.trim();
  if (!name || !residentId || !pass) { showToast('氏名・対象利用者・パスワードは必須です', 'warning'); return; }
  if (!email) { showToast('メールアドレスは必須です（ログインに使用します）', 'warning'); return; }
  showLoading();
  var resident = appData.residents.find(function(r) { return r.id === residentId; });
  var residentName = resident ? resident.name : '';

  // Firebase Authでユーザー作成（管理者権限が必要なため、Firestoreにのみ保存。実際の認証アカウントは別途作成が必要）
  db.collection(COLLECTIONS.FAMILIES).add({
    name: name,
    relation: relation,
    residentId: residentId,
    residentName: residentName,
    email: email,
    displayPassword: pass,  // 表示用（実際のパスワードはFirebase Authに保存）
    createdAt: nowTimestamp()
  }).then(function() {
    closeModal('modal-add-family');
    document.getElementById('fam-name').value = '';
    document.getElementById('fam-pass').value = '';
    document.getElementById('fam-email').value = '';
    showToast('家族を登録しました（Authアカウントは別途作成してください）');
    loadAll();
  }).catch(function() { hideLoading(); showToast('登録に失敗しました', 'error'); });
}

function deleteFamily(id) {
  if (!confirm('この家族を削除しますか？')) return;
  showLoading();
  db.collection(COLLECTIONS.FAMILIES).doc(id).delete()
    .then(function() { showToast('削除しました'); loadAll(); })
    .catch(function() { hideLoading(); showToast('削除に失敗しました', 'error'); });
}

// ============================================================
// ケアマネ管理
// ============================================================
function renderCareManagers(data) {
  var rows = data || appData.caremanagers;
  var tbody = document.getElementById('caremanagers-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">ケアマネが登録されていません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(c) {
    return '<tr>' +
      '<td style="color:var(--gray-400);font-size:12px">' + esc(c.id) + '</td>' +
      '<td><strong>' + esc(c.name) + '</strong></td>' +
      '<td>' + esc(c.org) + '</td>' +
      '<td style="font-size:12px">' + esc(c.email||'') + '</td>' +
      '<td><span class="badge badge-read" style="font-family:monospace">' + esc(c.displayPassword||'（非表示）') + '</span></td>' +
      '<td><button class="btn-icon btn-delete" onclick="deleteCareManager(\'' + c.id + '\')" title="削除"><i class="fa fa-trash"></i></button></td>' +
      '</tr>';
  }).join('');
}

function filterCareManagers() {
  var q = document.getElementById('cm-search').value.toLowerCase();
  renderCareManagers(appData.caremanagers.filter(function(c) {
    return !q || (c.name||'').toLowerCase().includes(q) || (c.org||'').toLowerCase().includes(q);
  }));
}

function addCareManager() {
  var name = document.getElementById('cm-name').value.trim();
  var org = document.getElementById('cm-org').value.trim();
  var pass = document.getElementById('cm-pass').value.trim();
  var email = document.getElementById('cm-email').value.trim();
  if (!name || !org || !pass) { showToast('氏名・所属・パスワードは必須です', 'warning'); return; }
  showLoading();
  db.collection(COLLECTIONS.CAREMANAGERS).add({
    name: name, org: org, email: email, displayPassword: pass, createdAt: nowTimestamp()
  }).then(function() {
    closeModal('modal-add-caremanager');
    document.getElementById('cm-name').value = '';
    document.getElementById('cm-org').value = '';
    document.getElementById('cm-pass').value = '';
    document.getElementById('cm-email').value = '';
    showToast('ケアマネを登録しました');
    loadAll();
  }).catch(function() { hideLoading(); showToast('登録に失敗しました', 'error'); });
}

function deleteCareManager(id) {
  if (!confirm('このケアマネを削除しますか？')) return;
  showLoading();
  db.collection(COLLECTIONS.CAREMANAGERS).doc(id).delete()
    .then(function() { showToast('削除しました'); loadAll(); })
    .catch(function() { hideLoading(); showToast('削除に失敗しました', 'error'); });
}

// ============================================================
// スタッフ管理
// ============================================================
function renderStaff(data) {
  var rows = data || appData.staff;
  var tbody = document.getElementById('staff-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">スタッフが登録されていません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(s) {
    var isAdmin = s.role === '管理者';
    return '<tr>' +
      '<td style="font-family:monospace;font-size:12px">' + esc(s.staffId||s.id||'') + '</td>' +
      '<td><strong>' + esc(s.name) + '</strong></td>' +
      '<td><span class="badge ' + (isAdmin ? 'badge-approved' : 'badge-read') + '">' + esc(s.role) + '</span></td>' +
      '<td>' + esc(s.dept||'') + '</td>' +
      '<td><button class="btn-icon btn-delete" onclick="deleteStaff(\'' + s.id + '\')" title="削除"><i class="fa fa-trash"></i></button></td>' +
      '</tr>';
  }).join('');
}

function addStaff() {
  var staffId = document.getElementById('st-id').value.trim();
  var name = document.getElementById('st-name').value.trim();
  var role = document.getElementById('st-role').value;
  var dept = document.getElementById('st-dept').value.trim();
  var pass = document.getElementById('st-pass').value.trim();
  var email = staffId + '@harulink.local';  // staffIdからメールアドレスを生成
  if (!staffId || !name || !pass) { showToast('スタッフID・氏名・パスワードは必須です', 'warning'); return; }
  showLoading();
  // Firebase Authアカウント作成
  auth.createUserWithEmailAndPassword(email, pass)
    .then(function() {
      return db.collection(COLLECTIONS.STAFF).add({
        staffId: staffId, name: name, role: role, dept: dept, email: email, createdAt: nowTimestamp()
      });
    })
    .then(function() {
      closeModal('modal-add-staff');
      document.getElementById('st-id').value = '';
      document.getElementById('st-name').value = '';
      document.getElementById('st-pass').value = '';
      document.getElementById('st-dept').value = '';
      showToast('スタッフを登録しました');
      loadAll();
    })
    .catch(function(err) {
      hideLoading();
      if (err.code === 'auth/email-already-in-use') {
        showToast('このスタッフIDはすでに使用されています', 'error');
      } else {
        showToast('登録に失敗しました: ' + err.message, 'error');
      }
    });
}

function deleteStaff(id) {
  if (!confirm('このスタッフを削除しますか？')) return;
  showLoading();
  db.collection(COLLECTIONS.STAFF).doc(id).delete()
    .then(function() { showToast('削除しました'); loadAll(); })
    .catch(function() { hideLoading(); showToast('削除に失敗しました', 'error'); });
}

// ============================================================
// セレクトボックスの選択肢を動的に設定
// ============================================================
function populateSelects() {
  var famResidentSel = document.getElementById('fam-resident');
  if (famResidentSel) {
    var curFamRes = famResidentSel.value;
    famResidentSel.innerHTML = '<option value="">選択してください</option>' +
      appData.residents.map(function(r) {
        return '<option value="' + esc(r.id) + '">' + esc(r.name) + '（' + esc(r.room) + '号室）</option>';
      }).join('');
    famResidentSel.value = curFamRes;
  }

  var resStaffSel = document.getElementById('res-staff');
  if (resStaffSel) {
    var curResStaff = resStaffSel.value;
    resStaffSel.innerHTML = '<option value="">選択してください</option>' +
      appData.staff.map(function(s) {
        return '<option value="' + esc(s.name) + '">' + esc(s.name) + '</option>';
      }).join('');
    resStaffSel.value = curResStaff;
  }

  var cmSel = document.getElementById('cm-msg-target');
  if (cmSel) {
    var curCm = cmSel.value;
    cmSel.innerHTML = '<option value="">選択してください</option>' +
      appData.caremanagers.map(function(c) {
        return '<option value="' + esc(c.name) + '">' + esc(c.name) + '（' + esc(c.org) + '）</option>';
      }).join('');
    cmSel.value = curCm;
  }
}

// ============================================================
// 写真アップロード（Firebase Storageは未設定のため、Firestoreに保存）
// ============================================================
function openPhotoUpload(residentId, residentName) {
  document.getElementById('photo-resident-id').value = residentId;
  document.getElementById('photo-resident-label').textContent = '利用者：' + residentName;
  document.getElementById('photo-file').value = '';
  document.getElementById('photo-memo').value = '';
  document.getElementById('photo-preview-wrap').innerHTML = '';
  document.getElementById('photo-upload-progress').style.display = 'none';
  openModal('modal-upload-photo');
}

document.addEventListener('DOMContentLoaded', function() {
  var fileInput = document.getElementById('photo-file');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      var wrap = document.getElementById('photo-preview-wrap');
      wrap.innerHTML = '';
      Array.from(this.files).forEach(function(file) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var img = document.createElement('img');
          img.src = e.target.result;
          img.style.cssText = 'width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0';
          wrap.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });
  }
});

function uploadPhotos() {
  var residentId = document.getElementById('photo-resident-id').value;
  var memo = document.getElementById('photo-memo').value.trim();
  var files = document.getElementById('photo-file').files;
  if (!files || files.length === 0) { showToast('写真を選択してください', 'warning'); return; }

  var progress = document.getElementById('photo-upload-progress');
  progress.style.display = 'block';

  var promises = Array.from(files).map(function(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var base64 = e.target.result;
        db.collection(COLLECTIONS.PHOTOS).add({
          residentId: residentId,
          fileName: file.name,
          mimeType: file.type,
          dataUrl: base64,
          memo: memo,
          uploader: currentUser.name,
          createdAt: nowTimestamp()
        }).then(resolve).catch(reject);
      };
      reader.readAsDataURL(file);
    });
  });

  Promise.all(promises)
    .then(function() {
      progress.style.display = 'none';
      closeModal('modal-upload-photo');
      showToast('写真をアップロードしました');
    })
    .catch(function() {
      progress.style.display = 'none';
      showToast('アップロードに失敗しました', 'error');
    });
}
