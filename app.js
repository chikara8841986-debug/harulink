// ============================================================
// HaruLink - スタッフ用フロントエンド
// ============================================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxDjkUXCAxHeyKH-j0iNwB2OoWEAizP094vrUynWOyW9TOUFNqXdPeDCZ2AqNzz0F4Swg/exec';

// ============================================================
// 状態管理
// ============================================================
var currentUser = null;   // { id, name, role, dept }
var appData = {
  messages: [], broadcasts: [], visits: [], suspends: [],
  residents: [], families: [], caremanagers: [], staff: []
};

// ============================================================
// API通信
// ============================================================
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

function showLoading() { document.getElementById('loading-overlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

// ============================================================
// トースト通知
// ============================================================
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

  callAPI('loginStaff', { id: id, password: pass })
    .then(function(data) {
      hideLoading();
      if (data.success && data.user) {
        currentUser = data.user;
        initApp();
      } else {
        errEl.style.display = 'block';
      }
    })
    .catch(function() {
      hideLoading();
      errEl.style.display = 'block';
    });
});

function initApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  // スタッフ情報を表示
  document.getElementById('staff-name-display').textContent = currentUser.name;
  document.getElementById('staff-avatar').textContent = currentUser.name ? currentUser.name[0] : 'S';
  var roleBadge = document.getElementById('staff-role-badge');
  roleBadge.textContent = currentUser.role;
  if (currentUser.role === '管理者') roleBadge.classList.add('admin');

  // ロールに応じて管理者専用メニューを制御
  applyRoleUI();

  // 日付・挨拶
  updateDateTime();
  setInterval(updateDateTime, 60000);

  // データ読み込み
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
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-id').value = '';
  document.getElementById('login-pass').value = '';
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
  // モバイルでサイドバーを閉じる
  document.getElementById('sidebar').classList.remove('mobile-open');
}

// ============================================================
// サイドバー開閉
// ============================================================
function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

// ============================================================
// パスワード表示切り替え
// ============================================================
function togglePass(id) {
  var input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ============================================================
// パスワード自動生成
// ============================================================
function generatePass(inputId) {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var pass = '';
  for (var i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById(inputId).value = pass;
}

// ============================================================
// モーダル
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
// オーバーレイクリックで閉じる
document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ============================================================
// データ全件読み込み
// ============================================================
function loadAll() {
  showLoading();
  callAPI('getAllData', {})
    .then(function(data) {
      appData.messages    = data.messages    || [];
      appData.broadcasts  = data.broadcasts  || [];
      appData.visits      = data.visits      || [];
      appData.suspends    = data.suspends    || [];
      appData.residents   = data.residents   || [];
      appData.families    = data.families    || [];
      appData.caremanagers= data.caremanagers|| [];
      appData.staff       = data.staff       || [];
      renderAll();
      hideLoading();
    })
    .catch(function(err) {
      hideLoading();
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
  var unread = appData.messages.filter(function(m) { return !m['既読']; }).length;
  var pendingVisits = appData.visits.filter(function(v) { return v['ステータス'] === '申請中'; }).length;
  var todayStr = new Date().toISOString().slice(0,10);
  var todayVisits = appData.visits.filter(function(v) { return String(v['希望日']).slice(0,10) === todayStr && v['ステータス'] === '承認'; }).length;

  document.getElementById('kpi-unread').textContent = unread;
  document.getElementById('kpi-pending-visits').textContent = pendingVisits;
  document.getElementById('kpi-residents').textContent = appData.residents.length;
  document.getElementById('kpi-today-visits').textContent = todayVisits;

  // バッジ
  var msgBadge = document.getElementById('badge-messages');
  msgBadge.textContent = unread;
  msgBadge.style.display = unread > 0 ? 'inline-block' : 'none';
  var visitBadge = document.getElementById('badge-visits');
  visitBadge.textContent = pendingVisits;
  visitBadge.style.display = pendingVisits > 0 ? 'inline-block' : 'none';

  // 最新メッセージ5件
  var dashMsgs = document.getElementById('dashboard-messages');
  var msgs = appData.messages.slice(-5).reverse();
  if (msgs.length === 0) {
    dashMsgs.innerHTML = '<div class="empty-state"><i class="fa fa-inbox"></i><p>メッセージはありません</p></div>';
  } else {
    dashMsgs.innerHTML = msgs.map(function(m) {
      return '<div class="dash-msg-item">' +
        '<div class="dash-msg-dot ' + (m['既読'] ? 'read' : '') + '"></div>' +
        '<div><div class="dash-msg-sender">' + esc(m['送信者']) + ' → ' + esc(m['受信者']) + '</div>' +
        '<div class="dash-msg-body">' + esc(m['本文']) + '</div>' +
        '<div class="dash-msg-time">' + esc(String(m['送信日時'])) + '</div></div>' +
        '</div>';
    }).join('');
  }

  // 申請中の面会
  var dashVisits = document.getElementById('dashboard-visits');
  var pending = appData.visits.filter(function(v) { return v['ステータス'] === '申請中'; }).slice(0, 5);
  if (pending.length === 0) {
    dashVisits.innerHTML = '<div class="empty-state"><i class="fa fa-calendar"></i><p>申請中の予約はありません</p></div>';
  } else {
    dashVisits.innerHTML = pending.map(function(v) {
      return '<div class="dash-visit-item">' +
        '<span class="badge badge-pending">申請中</span>' +
        '<div><strong>' + esc(v['利用者名']) + '</strong> への面会</div>' +
        '<div style="color:var(--gray-500);font-size:12px">' + esc(v['申請者']) + ' / ' + esc(String(v['希望日'])) + '</div>' +
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
    var read = m['既読'];
    return '<tr>' +
      '<td><span class="badge ' + (read ? 'badge-read' : 'badge-unread') + '">' + (read ? '既読' : '未読') + '</span></td>' +
      '<td>' + esc(m['送信者']) + '</td>' +
      '<td>' + esc(m['受信者']) + '</td>' +
      '<td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(m['本文']) + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + esc(String(m['送信日時'])) + '</td>' +
      '</tr>';
  }).join('');
}

function filterMessages() {
  var q = document.getElementById('msg-search').value.toLowerCase();
  var f = document.getElementById('msg-filter').value;
  var filtered = appData.messages.filter(function(m) {
    var match = !q || (m['送信者']||'').toLowerCase().includes(q) || (m['受信者']||'').toLowerCase().includes(q) || (m['本文']||'').toLowerCase().includes(q);
    var fmatch = !f || (f === '未読' && !m['既読']);
    return match && fmatch;
  });
  renderMessages(filtered);
}

function sendMessage() {
  var receiver = document.getElementById('msg-receiver').value.trim();
  var body = document.getElementById('msg-body').value.trim();
  if (!receiver || !body) { showToast('受信者とメッセージ内容を入力してください', 'warning'); return; }
  showLoading();
  callAPI('sendMessage', { sender: currentUser.name, receiver: receiver, message: body })
    .then(function() {
      closeModal('modal-send-message');
      document.getElementById('msg-receiver').value = '';
      document.getElementById('msg-body').value = '';
      showToast('メッセージを送信しました');
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('送信に失敗しました', 'error'); });
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
    var st = v['ステータス'] || '';
    var badgeClass = st === '申請中' ? 'badge-pending' : st === '承認' ? 'badge-approved' : 'badge-rejected';
    var btns = '';
    if (st === '申請中') {
      btns = '<button class="btn-icon btn-approve" onclick="approveVisit(\'' + v['ID'] + '\',\'承認\')" title="承認"><i class="fa fa-check"></i></button>' +
             '<button class="btn-icon btn-reject" onclick="approveVisit(\'' + v['ID'] + '\',\'却下\')" title="却下"><i class="fa fa-times"></i></button>';
    }
    return '<tr>' +
      '<td><span class="badge ' + badgeClass + '">' + esc(st) + '</span></td>' +
      '<td>' + esc(v['申請者']) + '</td>' +
      '<td>' + esc(v['利用者名']) + '</td>' +
      '<td>' + esc(String(v['希望日'])) + '</td>' +
      '<td>' + esc(v['希望時間']) + '</td>' +
      '<td>' + esc(String(v['人数'])) + '</td>' +
      '<td>' + esc(v['目的']) + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + esc(String(v['申請日時'])) + '</td>' +
      '<td><div style="display:flex;gap:4px">' + btns + '</div></td>' +
      '</tr>';
  }).join('');
}

function filterVisits() {
  var q = document.getElementById('visit-search').value.toLowerCase();
  var f = document.getElementById('visit-filter').value;
  var filtered = appData.visits.filter(function(v) {
    var match = !q || (v['申請者']||'').toLowerCase().includes(q) || (v['利用者名']||'').toLowerCase().includes(q);
    var fmatch = !f || v['ステータス'] === f;
    return match && fmatch;
  });
  renderVisits(filtered);
}

function approveVisit(id, status) {
  showLoading();
  callAPI('approveVisit', { id: id, status: status })
    .then(function() {
      showToast(status === '承認' ? '面会を承認しました' : '面会を却下しました', status === '承認' ? 'success' : 'warning');
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
      '<td><strong>' + esc(b['タイトル']) + '</strong></td>' +
      '<td><span class="badge badge-read">' + esc(b['対象']) + '</span></td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + esc(String(b['送信日時'])) + '</td>' +
      '<td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(b['本文']) + '</td>' +
      '</tr>';
  }).join('');
}

function sendBroadcast() {
  var title = document.getElementById('bc-title').value.trim();
  var body = document.getElementById('bc-body').value.trim();
  var target = document.getElementById('bc-target').value;
  if (!title || !body) { showToast('タイトルと本文を入力してください', 'warning'); return; }
  showLoading();
  callAPI('sendBroadcast', { title: title, message: body, target: target, sender: currentUser.name })
    .then(function() {
      closeModal('modal-broadcast');
      document.getElementById('bc-title').value = '';
      document.getElementById('bc-body').value = '';
      showToast('一斉通知を送信しました');
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('送信に失敗しました', 'error'); });
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
      '<td>' + esc(String(s['開始日'])) + '</td>' +
      '<td>' + esc(String(s['終了日'])) + '</td>' +
      '<td>' + esc(s['理由']) + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + esc(String(s['設定日時'])) + '</td>' +
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
  callAPI('setSuspendPeriod', { startDate: start, endDate: end, reason: reason, setter: currentUser.name })
    .then(function() {
      closeModal('modal-suspend');
      document.getElementById('suspend-start').value = '';
      document.getElementById('suspend-end').value = '';
      document.getElementById('suspend-reason').value = '';
      showToast('面会中止期間を設定しました');
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('設定に失敗しました', 'error'); });
}

// ============================================================
// ケアマネ連絡
// ============================================================
function renderCareManagerMsgs(data) {
  var rows = data || appData.messages.filter(function(m) { return m['種別'] === 'ケアマネ'; });
  var tbody = document.getElementById('caremanager-msg-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">ケアマネへの連絡はありません</td></tr>';
    return;
  }
  tbody.innerHTML = rows.slice().reverse().map(function(m) {
    var read = m['既読'];
    return '<tr>' +
      '<td><span class="badge ' + (read ? 'badge-read' : 'badge-unread') + '">' + (read ? '既読' : '未読') + '</span></td>' +
      '<td>' + esc(m['受信者']) + '</td>' +
      '<td>' + esc(m['件名'] || '') + '</td>' +
      '<td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(m['本文']) + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + esc(String(m['送信日時'])) + '</td>' +
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
  callAPI('sendCareManagerMessage', { sender: currentUser.name, receiver: target, subject: subject, message: body })
    .then(function() {
      closeModal('modal-caremanager-msg');
      document.getElementById('cm-msg-subject').value = '';
      document.getElementById('cm-msg-body').value = '';
      showToast('ケアマネへ連絡を送信しました');
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('送信に失敗しました', 'error'); });
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
      '<td style="color:var(--gray-400);font-size:12px">' + esc(String(r['ID']||'')) + '</td>' +
      '<td><strong>' + esc(r['氏名']) + '</strong></td>' +
      '<td>' + esc(r['部屋番号']) + '</td>' +
      '<td style="color:var(--gray-500);font-size:12px">' + esc(String(r['入居日']||'')) + '</td>' +
      '<td>' + esc(r['担当スタッフ']||'') + '</td>' +
      '<td><button class="btn-icon btn-delete" onclick="deleteResident(\'' + r['ID'] + '\')" title="削除"><i class="fa fa-trash"></i></button></td>' +
      '</tr>';
  }).join('');
}

function filterResidents() {
  var q = document.getElementById('resident-search').value.toLowerCase();
  renderResidents(appData.residents.filter(function(r) {
    return !q || (r['氏名']||'').toLowerCase().includes(q) || (String(r['部屋番号'])||'').toLowerCase().includes(q);
  }));
}

function addResident() {
  var name = document.getElementById('res-name').value.trim();
  var room = document.getElementById('res-room').value.trim();
  var date = document.getElementById('res-date').value;
  var staff = document.getElementById('res-staff').value;
  if (!name || !room) { showToast('氏名と部屋番号は必須です', 'warning'); return; }
  showLoading();
  callAPI('addResident', { name: name, room: room, date: date, staff: staff })
    .then(function() {
      closeModal('modal-add-resident');
      document.getElementById('res-name').value = '';
      document.getElementById('res-room').value = '';
      document.getElementById('res-date').value = '';
      showToast('利用者を登録しました');
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('登録に失敗しました', 'error'); });
}

function deleteResident(id) {
  if (!confirm('この利用者を削除しますか？')) return;
  showLoading();
  callAPI('deleteRecord', { sheet: '入居者情報', id: id })
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
      '<td style="color:var(--gray-400);font-size:12px">' + esc(String(f['ID']||'')) + '</td>' +
      '<td><strong>' + esc(f['氏名']) + '</strong></td>' +
      '<td>' + esc(f['続柄']) + '</td>' +
      '<td>' + esc(f['利用者名']||'') + '</td>' +
      '<td style="font-size:12px">' + esc(f['メール']||f['メールアドレス']||'') + '</td>' +
      '<td><span class="badge badge-read" style="font-family:monospace">' + esc(f['パスワード']||'') + '</span></td>' +
      '<td><button class="btn-icon btn-delete" onclick="deleteFamily(\'' + f['ID'] + '\')" title="削除"><i class="fa fa-trash"></i></button></td>' +
      '</tr>';
  }).join('');
}

function filterFamilies() {
  var q = document.getElementById('family-search').value.toLowerCase();
  renderFamilies(appData.families.filter(function(f) {
    return !q || (f['氏名']||'').toLowerCase().includes(q) || (f['利用者名']||'').toLowerCase().includes(q);
  }));
}

function addFamily() {
  var name = document.getElementById('fam-name').value.trim();
  var relation = document.getElementById('fam-relation').value;
  var resident = document.getElementById('fam-resident').value;
  var pass = document.getElementById('fam-pass').value.trim();
  var email = document.getElementById('fam-email').value.trim();
  if (!name || !resident || !pass) { showToast('氏名・対象利用者・パスワードは必須です', 'warning'); return; }
  showLoading();
  callAPI('addFamily', { name: name, relation: relation, residentId: resident, password: pass, email: email })
    .then(function() {
      closeModal('modal-add-family');
      document.getElementById('fam-name').value = '';
      document.getElementById('fam-pass').value = '';
      document.getElementById('fam-email').value = '';
      showToast('家族を登録しました');
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('登録に失敗しました', 'error'); });
}

function deleteFamily(id) {
  if (!confirm('この家族を削除しますか？')) return;
  showLoading();
  callAPI('deleteRecord', { sheet: '家族マスタ', id: id })
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
      '<td style="color:var(--gray-400);font-size:12px">' + esc(String(c['ID']||'')) + '</td>' +
      '<td><strong>' + esc(c['氏名']) + '</strong></td>' +
      '<td>' + esc(c['所属']) + '</td>' +
      '<td style="font-size:12px">' + esc(c['メール']||c['メールアドレス']||'') + '</td>' +
      '<td><span class="badge badge-read" style="font-family:monospace">' + esc(c['パスワード']||'') + '</span></td>' +
      '<td><button class="btn-icon btn-delete" onclick="deleteCareManager(\'' + c['ID'] + '\')" title="削除"><i class="fa fa-trash"></i></button></td>' +
      '</tr>';
  }).join('');
}

function filterCareManagers() {
  var q = document.getElementById('cm-search').value.toLowerCase();
  renderCareManagers(appData.caremanagers.filter(function(c) {
    return !q || (c['氏名']||'').toLowerCase().includes(q) || (c['所属']||'').toLowerCase().includes(q);
  }));
}

function addCareManager() {
  var name = document.getElementById('cm-name').value.trim();
  var org = document.getElementById('cm-org').value.trim();
  var pass = document.getElementById('cm-pass').value.trim();
  var email = document.getElementById('cm-email').value.trim();
  if (!name || !org || !pass) { showToast('氏名・所属・パスワードは必須です', 'warning'); return; }
  showLoading();
  callAPI('addCareManager', { name: name, org: org, password: pass, email: email })
    .then(function() {
      closeModal('modal-add-caremanager');
      document.getElementById('cm-name').value = '';
      document.getElementById('cm-org').value = '';
      document.getElementById('cm-pass').value = '';
      document.getElementById('cm-email').value = '';
      showToast('ケアマネを登録しました');
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('登録に失敗しました', 'error'); });
}

function deleteCareManager(id) {
  if (!confirm('このケアマネを削除しますか？')) return;
  showLoading();
  callAPI('deleteRecord', { sheet: 'ケアマネマスタ', id: id })
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
    var isAdmin = s['権限'] === '管理者';
    return '<tr>' +
      '<td style="font-family:monospace;font-size:12px">' + esc(s['スタッフID']||s['ID']||'') + '</td>' +
      '<td><strong>' + esc(s['氏名']) + '</strong></td>' +
      '<td><span class="badge ' + (isAdmin ? 'badge-approved' : 'badge-read') + '">' + esc(s['権限']) + '</span></td>' +
      '<td>' + esc(s['担当部門']||'') + '</td>' +
      '<td><button class="btn-icon btn-delete" onclick="deleteStaff(\'' + (s['スタッフID']||s['ID']) + '\')" title="削除"><i class="fa fa-trash"></i></button></td>' +
      '</tr>';
  }).join('');
}

function addStaff() {
  var id = document.getElementById('st-id').value.trim();
  var name = document.getElementById('st-name').value.trim();
  var role = document.getElementById('st-role').value;
  var dept = document.getElementById('st-dept').value.trim();
  var pass = document.getElementById('st-pass').value.trim();
  if (!id || !name || !pass) { showToast('スタッフID・氏名・パスワードは必須です', 'warning'); return; }
  showLoading();
  callAPI('addStaff', { staffId: id, name: name, role: role, dept: dept, password: pass })
    .then(function() {
      closeModal('modal-add-staff');
      document.getElementById('st-id').value = '';
      document.getElementById('st-name').value = '';
      document.getElementById('st-pass').value = '';
      document.getElementById('st-dept').value = '';
      showToast('スタッフを登録しました');
      loadAll();
    })
    .catch(function() { hideLoading(); showToast('登録に失敗しました', 'error'); });
}

function deleteStaff(id) {
  if (!confirm('このスタッフを削除しますか？')) return;
  showLoading();
  callAPI('deleteRecord', { sheet: 'スタッフマスタ', id: id })
    .then(function() { showToast('削除しました'); loadAll(); })
    .catch(function() { hideLoading(); showToast('削除に失敗しました', 'error'); });
}

// ============================================================
// セレクトボックスの選択肢を動的に設定
// ============================================================
function populateSelects() {
  // 利用者選択（家族登録モーダル）
  var famResidentSel = document.getElementById('fam-resident');
  var curFamRes = famResidentSel.value;
  famResidentSel.innerHTML = '<option value="">選択してください</option>' +
    appData.residents.map(function(r) {
      return '<option value="' + esc(r['ID']) + '">' + esc(r['氏名']) + '（' + esc(r['部屋番号']) + '号室）</option>';
    }).join('');
  famResidentSel.value = curFamRes;

  // 担当スタッフ選択（利用者登録モーダル）
  var resStaffSel = document.getElementById('res-staff');
  var curResStaff = resStaffSel.value;
  resStaffSel.innerHTML = '<option value="">選択してください</option>' +
    appData.staff.map(function(s) {
      return '<option value="' + esc(s['氏名']) + '">' + esc(s['氏名']) + '</option>';
    }).join('');
  resStaffSel.value = curResStaff;

  // ケアマネ選択（連絡モーダル）
  var cmSel = document.getElementById('cm-msg-target');
  var curCm = cmSel.value;
  cmSel.innerHTML = '<option value="">選択してください</option>' +
    appData.caremanagers.map(function(c) {
      return '<option value="' + esc(c['氏名']) + '">' + esc(c['氏名']) + '（' + esc(c['所属']) + '）</option>';
    }).join('');
  cmSel.value = curCm;
}

// ============================================================
// XSSエスケープ
// ============================================================
function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
