// =============================================
// HaruLink フロントエンド
// GASのURLをここに設定してください
// =============================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxDjkUXCAxHeyKH-j0iNwB2OoWEAizP094vrUynWOyW9TOUFNqXdPeDCZ2AqNzz0F4Swg/exec';

// =============================================
// ページ切り替え
// =============================================
document.querySelectorAll('.nav-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var page = btn.getAttribute('data-page');
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
    document.getElementById('page-' + page).classList.add('active');
    btn.classList.add('active');
  });
});

// =============================================
// 通知トースト
// =============================================
function showToast(msg, type) {
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'success');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3500);
}

// =============================================
// GAS APIを呼び出す共通関数
// =============================================
function callAPI(action, params) {
  var url = GAS_URL + '?action=' + action;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(params || {})
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error);
    return data;
  });
}

// =============================================
// データ読み込み（ページ表示時）
// =============================================
function loadAll() {
  callAPI('getAllData')
    .then(function(d) {
      document.getElementById('stat-unread').textContent = d.unread || 0;
      document.getElementById('stat-pending').textContent = d.pending || 0;
      renderMessages(d.messages || []);
      renderBroadcasts(d.broadcasts || []);
      renderVisits(d.visits || []);
      renderSuspends(d.suspends || []);
    })
    .catch(function(e) {
      showToast('データ読み込みエラー：' + e.message, 'error');
    });
}

// =============================================
// メッセージ描画
// =============================================
function renderMessages(msgs) {
  var el = document.getElementById('msg-list');
  if (msgs.length === 0) {
    el.innerHTML = '<p style="color:#888">メッセージはありません</p>';
    return;
  }
  el.innerHTML = msgs.map(function(m) {
    var cls = m.senderType === '家族' ? 'msg-family' : 'msg-facility';
    var badgeCls = m.status === '未読' ? 'unread' : 'read';
    return '<div class="msg-box ' + cls + '">' +
      '<div class="msg-meta">' + (m.senderType || '') + '→' + (m.receiver || '') + '　' + (m.dt || '') + '</div>' +
      '<div>' + (m.body || '') + '</div>' +
      '<span class="badge badge-' + badgeCls + '">' + (m.status || '') + '</span>' +
      '</div>';
  }).join('');
}

// =============================================
// 一斉通知履歴描画
// =============================================
function renderBroadcasts(bcs) {
  var el = document.getElementById('bc-list');
  if (bcs.length === 0) {
    el.innerHTML = '<p style="color:#888">履歴はありません</p>';
    return;
  }
  var rows = bcs.map(function(b) {
    return '<tr><td>' + (b.dt || '') + '</td><td>' + (b.dept || '') + '</td>' +
      '<td><strong>' + (b.title || '') + '</strong></td>' +
      '<td>' + (b.body || '') + '</td></tr>';
  }).join('');
  el.innerHTML = '<table><tr><th>日時</th><th>部署</th><th>件名</th><th>本文</th></tr>' + rows + '</table>';
}

// =============================================
// 面会予約描画
// =============================================
function renderVisits(visits) {
  var el = document.getElementById('visit-list');
  if (visits.length === 0) {
    el.innerHTML = '<p style="color:#888">予約はありません</p>';
    return;
  }
  var rows = visits.map(function(v) {
    var bc = v.status === '承認済み' ? 'approved' : v.status === '承認待ち' ? 'pending' : 'other';
    return '<tr>' +
      '<td>' + (v.family || '') + '</td>' +
      '<td>' + (v.user || '') + '</td>' +
      '<td>' + (v.date || '') + ' ' + (v.time || '') + '</td>' +
      '<td><span class="badge badge-' + bc + '">' + (v.status || '') + '</span></td>' +
      '<td>' +
        '<button class="btn btn-primary btn-sm" onclick="approveVisit(\'' + v.id + '\', true)">承認</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="approveVisit(\'' + v.id + '\', false)">却下</button>' +
      '</td></tr>';
  }).join('');
  el.innerHTML = '<table><tr><th>家族ID</th><th>利用者ID</th><th>希望日時</th><th>状態</th><th>操作</th></tr>' + rows + '</table>';
}

// =============================================
// 面会中止期間描画
// =============================================
function renderSuspends(sps) {
  var el = document.getElementById('suspend-list');
  if (sps.length === 0) {
    el.innerHTML = '<p style="color:#888">設定はありません</p>';
    return;
  }
  var rows = sps.map(function(s) {
    return '<tr><td>' + (s.start || '') + '</td><td>' + (s.end || '') + '</td>' +
      '<td>' + (s.reason || '') + '</td><td>' + (s.staff || '') + '</td><td>' + (s.dt || '') + '</td></tr>';
  }).join('');
  el.innerHTML = '<table><tr><th>開始日</th><th>終了日</th><th>理由</th><th>設定者</th><th>設定日時</th></tr>' + rows + '</table>';
}

// =============================================
// メッセージ送信
// =============================================
function sendMessage() {
  var params = {
    senderId:     document.getElementById('s_sender').value,
    senderType:   document.getElementById('s_stype').value,
    receiverId:   document.getElementById('s_receiver').value,
    receiverType: document.getElementById('s_rtype').value,
    body:         document.getElementById('s_body').value
  };
  if (!params.senderId || !params.receiverId || !params.body) {
    showToast('送信者ID・受信者ID・メッセージを入力してください', 'warning');
    return;
  }
  callAPI('sendMessage', params)
    .then(function() {
      showToast('送信しました！', 'success');
      document.getElementById('s_body').value = '';
      loadAll();
    })
    .catch(function(e) { showToast('エラー：' + e.message, 'error'); });
}

// =============================================
// 一斉通知送信
// =============================================
function sendBroadcast() {
  var params = {
    title: document.getElementById('bc_title').value,
    body:  document.getElementById('bc_body').value,
    dept:  document.getElementById('bc_dept').value || null
  };
  if (!params.title || !params.body) {
    showToast('件名と本文を入力してください', 'warning');
    return;
  }
  callAPI('sendBroadcast', params)
    .then(function(d) {
      showToast('送信完了！（' + d.count + '件）', 'success');
      loadAll();
    })
    .catch(function(e) { showToast('エラー：' + e.message, 'error'); });
}

// =============================================
// 面会申請
// =============================================
function requestVisit() {
  var params = {
    familyId: document.getElementById('v_family').value,
    userId:   document.getElementById('v_user').value,
    wishDate: document.getElementById('v_date').value,
    wishTime: document.getElementById('v_time').value,
    note:     document.getElementById('v_note').value
  };
  if (!params.familyId || !params.userId || !params.wishDate) {
    showToast('家族ID・利用者ID・希望日を入力してください', 'warning');
    return;
  }
  callAPI('requestVisit', params)
    .then(function(d) {
      showToast(d.message, d.success ? 'success' : 'warning');
      if (d.success) loadAll();
    })
    .catch(function(e) { showToast('エラー：' + e.message, 'error'); });
}

// =============================================
// 面会承認・却下
// =============================================
function approveVisit(visitId, approve) {
  callAPI('approveVisit', { visitId: visitId, staffId: 'STAFF001', approve: approve })
    .then(function() {
      showToast(approve ? '承認しました' : '却下しました', 'success');
      loadAll();
    })
    .catch(function(e) { showToast('エラー：' + e.message, 'error'); });
}

// =============================================
// 面会中止期間設定
// =============================================
function setSuspend() {
  var params = {
    startDate: document.getElementById('sp_start').value,
    endDate:   document.getElementById('sp_end').value,
    reason:    document.getElementById('sp_reason').value,
    staffId:   'STAFF001'
  };
  if (!params.startDate || !params.endDate || !params.reason) {
    showToast('開始日・終了日・理由を入力してください', 'warning');
    return;
  }
  callAPI('setSuspendPeriod', params)
    .then(function(d) {
      showToast('面会中止期間を設定しました（自動キャンセル：' + d.cancelCount + '件）', 'success');
      loadAll();
    })
    .catch(function(e) { showToast('エラー：' + e.message, 'error'); });
}

// =============================================
// ケアマネメール送信
// =============================================
function sendCareManager() {
  var params = {
    title:        document.getElementById('cm_title').value,
    body:         document.getElementById('cm_body').value,
    targetUserId: document.getElementById('cm_user').value || null
  };
  if (!params.title || !params.body) {
    showToast('件名と本文を入力してください', 'warning');
    return;
  }
  callAPI('sendEmailToCareManagers', params)
    .then(function(d) {
      showToast(d.sentCount + '件のケアマネへメール送信しました！', 'success');
    })
    .catch(function(e) { showToast('エラー：' + e.message, 'error'); });
}

// =============================================
// 起動時にデータ読み込み
// =============================================
window.addEventListener('load', function() {
  loadAll();
});
