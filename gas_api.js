// ============================================================
// HaruLink - GAS API サーバー専用コード（完全版）
// GASエディタに全文を貼り付けて再デプロイしてください
// ============================================================

var SPREADSHEET_ID = '1_w4iNVLC9Iy9RUtlbby-oy36fRjebKpOiO1a6F0ASN0';

// シート名定義
var SHEET = {
  STAFF:        'スタッフマスタ',
  RESIDENTS:    '入居者情報',
  FAMILIES:     '家族マスタ',
  CAREMANAGERS: 'ケアマネマスタ',
  MESSAGES:     'メッセージ',
  BROADCASTS:   '一斉通知',
  VISITS:       '面会予約',
  SUSPENDS:     '面会中止',
  PHOTOS:       '写真管理'
};

// ============================================================
// エントリーポイント
// ============================================================
function doGet(e) {
  var action = (e.parameter && e.parameter.action) || '';
  var params = {};
  try { params = JSON.parse(e.parameter.params || '{}'); } catch(err) {}
  return respond(handleAction(action, params));
}

function doPost(e) {
  var action = '', params = {};
  try {
    var body = JSON.parse(e.postData.contents);
    action = body.action || '';
    params = body.params || body;
  } catch(err) {
    action = (e.parameter && e.parameter.action) || '';
  }
  return respond(handleAction(action, params));
}

function respond(result) {
  var output = ContentService.createTextOutput(JSON.stringify(result));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================================
// ルーティング
// ============================================================
function handleAction(action, params) {
  try {
    switch(action) {
      // 認証
      case 'loginStaff':        return loginStaff(params);
      case 'loginFamily':       return loginFamily(params);
      case 'loginCareManager':  return loginCareManager(params);
      // データ取得
      case 'getAllData':         return getAllData();
      case 'getFamilyData':     return getFamilyData(params);
      case 'getCareManagerData':return getCareManagerData(params);
      // メッセージ
      case 'postMessage':           return postMessage(params);
      case 'sendMessage':           return sendMessage(params);
      case 'sendCareManagerMessage':return sendCareManagerMessage(params);
      // 通知・予約・中止
      case 'sendBroadcast':     return sendBroadcast(params);
      case 'postNotice':        return postNotice(params);
      case 'getNotices':        return getNotices(params);
      case 'requestVisit':      return requestVisit(params);
      case 'approveVisit':      return approveVisit(params);
      case 'setSuspendPeriod':  return setSuspendPeriod(params);
      // マスタ登録
      case 'addResident':       return addResident(params);
      case 'addFamily':         return addFamily(params);
      case 'addCareManager':    return addCareManager(params);
      case 'addStaff':          return addStaff(params);
      // 削除
      case 'deleteRecord':      return deleteRecord(params);
      // 写真
      case 'uploadPhoto':       return uploadPhoto(params);
      case 'getPhotos':         return getPhotos(params);
      default:
        return { error: 'unknown action: ' + action };
    }
  } catch(err) {
    return { error: err.toString() };
  }
}

// ============================================================
// シートユーティリティ
// ============================================================
function getSheet(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // ヘッダー初期設定
    var headers = {
      'スタッフマスタ':  ['ID','スタッフID','氏名','権限','担当部門','パスワード'],
      '入居者情報':      ['ID','氏名','部屋番号','入居日','担当スタッフ'],
      '家族マスタ':      ['ID','氏名','続柄','利用者ID','利用者名','メール','パスワード'],
      'ケアマネマスタ':  ['ID','氏名','所属','メール','パスワード'],
      'メッセージ':      ['ID','送信者','受信者','件名','本文','種別','送信者ID','受信者ID','送信日時','既読'],
      '一斉通知':        ['ID','タイトル','本文','対象','送信者','送信日時'],
      '面会予約':        ['ID','申請者','利用者名','家族ID','希望日','希望時間','人数','目的','ステータス','申請日時'],
      '面会中止':        ['ID','開始日','終了日','理由','設定者','設定日時'],
      '写真管理':        ['ID','利用者ID','画像URL','ファイル名','メモ','アップロード者','撮影日時']
    };
    if (headers[name]) sheet.appendRow(headers[name]);
  }
  return sheet;
}

function sheetToArray(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function generateId() {
  return new Date().getTime().toString(36) + Math.random().toString(36).slice(2,5);
}

function now() {
  return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

function formatDateTime(val) {
  if (!val) return '';
  if (typeof val === 'object' && val instanceof Date) {
    return val.getFullYear() + '/' + String(val.getMonth()+1).padStart(2,'0') + '/' + String(val.getDate()).padStart(2,'0') + ' ' + String(val.getHours()).padStart(2,'0') + ':' + String(val.getMinutes()).padStart(2,'0');
  }
  var str = String(val);
  var match = str.match(/(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
  if (match) {
    return match[1] + '/' + String(match[2]).padStart(2,'0') + '/' + String(match[3]).padStart(2,'0') + ' ' + String(match[4]).padStart(2,'0') + ':' + String(match[5]).padStart(2,'0');
  }
  return str;
}

// ============================================================
// 認証
// ============================================================
function loginStaff(params) {
  var rows = sheetToArray(getSheet(SHEET.STAFF));
  var user = rows.find(function(r) {
    return String(r['スタッフID']) === String(params.id) && String(r['パスワード']) === String(params.password);
  });
  if (!user) return { success: false };
  return { success: true, user: { id: user['ID'], name: user['氏名'], role: user['権限'], dept: user['担当部門'] } };
}

function loginFamily(params) {
  var rows = sheetToArray(getSheet(SHEET.FAMILIES));
  var user = rows.find(function(r) { return String(r['パスワード']) === String(params.password); });
  if (!user) return { success: false };
  // 担当スタッフIDから氏名を取得
  var staffName = '';
  var staffId = user['担当スタッフID'] || '';
  if (staffId) {
    var staffRows = sheetToArray(getSheet(SHEET.STAFF));
    var staff = staffRows.find(function(s) { return String(s['スタッフID']) === String(staffId); });
    if (staff) staffName = staff['氏名'];
  }
  return { success: true, user: { id: user['ID'], name: user['氏名'], relation: user['続柄'], residentId: user['利用者ID'], residentName: user['利用者名'], staffName: staffName || '担当スタッフ' } };
}

function loginCareManager(params) {
  var rows = sheetToArray(getSheet(SHEET.CAREMANAGERS));
  var user = rows.find(function(r) { return String(r['パスワード']) === String(params.password); });
  if (!user) return { success: false };
  return { success: true, user: { id: user['ID'], name: user['氏名'], org: user['所属'] } };
}

// ============================================================
// スタッフ用全データ取得
// ============================================================
function getAllData() {
  return {
    messages:     sheetToArray(getSheet(SHEET.MESSAGES)),
    broadcasts:   sheetToArray(getSheet(SHEET.BROADCASTS)),
    visits:       sheetToArray(getSheet(SHEET.VISITS)),
    suspends:     sheetToArray(getSheet(SHEET.SUSPENDS)),
    residents:    sheetToArray(getSheet(SHEET.RESIDENTS)),
    families:     sheetToArray(getSheet(SHEET.FAMILIES)),
    caremanagers: sheetToArray(getSheet(SHEET.CAREMANAGERS)),
    staff:        sheetToArray(getSheet(SHEET.STAFF))
  };
}

// ============================================================
// 家族向けデータ取得
// ============================================================
function getFamilyData(params) {
  var fid = String(params.familyId || '');
  var families = sheetToArray(getSheet(SHEET.FAMILIES));
  var family = families.find(function(f) { return String(f['ID']) === fid; });
  if (!family) return { messages: [], visits: [], notices: [] };

  var allMsgs = sheetToArray(getSheet(SHEET.MESSAGES));
  var messages = allMsgs.filter(function(m) {
    return String(m['送信者ID']) === fid || String(m['受信者ID']) === fid ||
           m['送信者'] === family['氏名'] || m['受信者'] === family['氏名'];
  });

  var allVisits = sheetToArray(getSheet(SHEET.VISITS));
  var visits = allVisits.filter(function(v) { return String(v['家族ID']) === fid || v['申請者'] === family['氏名']; }).map(function(v) {
    // 希望時間がDateオブジェクトになっている場合は文字列に変換
    var t = v['希望時間'];
    if (t instanceof Date) {
      t = String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0');
    } else {
      t = String(t || '');
    }
    // 希望日もDateオブジェクトの可能性があるので文字列に変換
    var d = v['希望日'];
    if (d instanceof Date) {
      d = d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
    } else {
      d = String(d || '');
    }
    return {
      '希望日':     d,
      '希望時間':   t,
      '人数':       String(v['人数'] || ''),
      '目的':       String(v['目的'] || ''),
      '備考':       String(v['備考'] || ''),
      'ステータス': String(v['ステータス'] || '申請中')
    };
  });

  var allBroadcasts = sheetToArray(getSheet(SHEET.BROADCASTS));
  var notices = allBroadcasts.filter(function(b) { return b['対象'] === '全員' || b['対象'] === '家族'; }).map(function(b) {
    return {
      'タイトル': b['タイトル'],
      '本文': b['本文'],
      '送信日時': formatDateTime(b['送信日時'])
    };
  });

  // 利用者IDに紐づく写真を取得
  var residentId = String(family['利用者ID'] || '');
  var photos = [];
  try {
    var allPhotos = sheetToArray(getSheet(SHEET.PHOTOS));
    photos = allPhotos.filter(function(p) {
      return String(p['利用者ID']) === residentId;
    }).map(function(p) {
      return {
        '画像URL':    String(p['画像URL'] || ''),
        'メモ':       String(p['メモ'] || ''),
        '撮影日時':   formatDateTime(p['撮影日時'])
      };
    });
  } catch(e) {}

  return { messages: messages, visits: visits, notices: notices, photos: photos };
}

// ============================================================
// ケアマネ向けデータ取得
// ============================================================
function getCareManagerData(params) {
  var cid = String(params.careManagerId || '');
  var cms = sheetToArray(getSheet(SHEET.CAREMANAGERS));
  var cm = cms.find(function(c) { return String(c['ID']) === cid; });
  if (!cm) return { messages: [] };

  var allMsgs = sheetToArray(getSheet(SHEET.MESSAGES));
  var messages = allMsgs.filter(function(m) {
    return (m['種別'] === 'ケアマネ' || m['種別'] === 'ケアマネから') &&
           (String(m['送信者ID']) === cid || String(m['受信者ID']) === cid ||
            m['送信者'] === cm['氏名'] || m['受信者'] === cm['氏名']);
  });

  return { messages: messages };
}

// ============================================================
// メッセージ送信
// ============================================================
// family.jsから呼ばれる家族→スタッフメッセージ
function postMessage(params) {
  var sheet = getSheet(SHEET.MESSAGES);
  var id = generateId();
  sheet.appendRow([id, params.sender||'', params.receiver||'', '', params.message||'', '家族', params.familyId||'', '', now(), false]);
  return { success: true, id: id };
}

function sendMessage(params) {
  var sheet = getSheet(SHEET.MESSAGES);
  var id = generateId();
  sheet.appendRow([id, params.sender||'', params.receiver||'', params.subject||'', params.message||'', params.kind||'スタッフ', params.senderId||'', params.receiverId||'', now(), false]);
  return { success: true, id: id };
}

function sendCareManagerMessage(params) {
  var sheet = getSheet(SHEET.MESSAGES);
  var id = generateId();
  sheet.appendRow([id, params.sender||'', params.receiver||'施設管理者', params.subject||'', params.message||'', 'ケアマネから', params.careManagerId||'', '', now(), false]);
  return { success: true, id: id };
}

// ============================================================
// 一斉通知
// ============================================================
function sendBroadcast(params) {
  var sheet = getSheet(SHEET.BROADCASTS);
  var id = generateId();
  sheet.appendRow([id, params.title||'', params.message||'', params.target||'全員', params.sender||'', now()]);
  return { success: true, id: id };
}

function postNotice(params) {
  var sheet = getSheet(SHEET.BROADCASTS);
  var id = generateId();
  sheet.appendRow([id, params.title||'', params.message||'', params.sender||'', now()]);
  return { success: true, id: id };
}

function getNotices(params) {
  var allNotices = sheetToArray(getSheet(SHEET.BROADCASTS));
  var notices = allNotices.map(function(b) {
    return {
      'ID': b['ID'],
      'タイトル': b['タイトル'],
      '本文': b['本文'],
      '送信者': b['送信者'],
      '送信日時': formatDateTime(b['送信日時'])
    };
  });
  return { notices: notices };
}

// ============================================================
// 面会予約
// ============================================================
function requestVisit(params) {
  var sheet = getSheet(SHEET.VISITS);
  var id = generateId();
  sheet.appendRow([id, params.applicant||'', params.residentName||'', params.familyId||'', params.date||'', params.time||'', params.people||1, params.purpose||'', '申請中', now()]);
  return { success: true, id: id };
}

function approveVisit(params) {
  var sheet = getSheet(SHEET.VISITS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id)) {
      sheet.getRange(i+1, 9).setValue(params.status || '承認');
      return { success: true };
    }
  }
  return { error: '対象の予約が見つかりませんでした' };
}

// ============================================================
// 面会中止
// ============================================================
function setSuspendPeriod(params) {
  var sheet = getSheet(SHEET.SUSPENDS);
  var id = generateId();
  sheet.appendRow([id, params.startDate||'', params.endDate||'', params.reason||'', params.setter||'', now()]);
  return { success: true, id: id };
}

// ============================================================
// マスタ登録
// ============================================================
function addResident(params) {
  var sheet = getSheet(SHEET.RESIDENTS);
  var id = generateId();
  sheet.appendRow([id, params.name||'', params.room||'', params.date||'', params.staff||'']);
  return { success: true, id: id };
}

function addFamily(params) {
  var sheet = getSheet(SHEET.FAMILIES);
  var id = generateId();
  // 利用者名を取得
  var residentName = '';
  if (params.residentId) {
    var residents = sheetToArray(getSheet(SHEET.RESIDENTS));
    var res = residents.find(function(r) { return String(r['ID']) === String(params.residentId); });
    if (res) residentName = res['氏名'];
  }
  sheet.appendRow([id, params.name||'', params.relation||'', params.residentId||'', residentName, params.email||'', params.password||'']);
  return { success: true, id: id };
}

function addCareManager(params) {
  var sheet = getSheet(SHEET.CAREMANAGERS);
  var id = generateId();
  sheet.appendRow([id, params.name||'', params.org||'', params.email||'', params.password||'']);
  return { success: true, id: id };
}

function addStaff(params) {
  var sheet = getSheet(SHEET.STAFF);
  var id = generateId();
  sheet.appendRow([id, params.staffId||'', params.name||'', params.role||'一般職員', params.dept||'', params.password||'']);
  return { success: true, id: id };
}

// ============================================================
// レコード削除
// ============================================================
function deleteRecord(params) {
  var sheetName = params.sheet;
  var targetId = String(params.id);
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === targetId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: '対象レコードが見つかりません' };
}

// ============================================================
// 写真アップロード（Base64 → Googleドライブに保存）
// ============================================================
function uploadPhoto(params) {
  var residentId = String(params.residentId || '');
  var fileName   = String(params.fileName   || 'photo.jpg');
  var mimeType   = String(params.mimeType   || 'image/jpeg');
  var data       = String(params.data       || '');
  var memo       = String(params.memo       || '');
  var uploader   = String(params.uploader   || '');

  if (!residentId || !data) return { error: 'パラメータ不足' };

  // Googleドライブのフォルダを取得 or 作成
  var folderName = 'HaruLink_Photos_' + residentId;
  var folders = DriveApp.getFoldersByName(folderName);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }

  // Base64デコードしてファイル作成
  var decoded = Utilities.base64Decode(data);
  var blob = Utilities.newBlob(decoded, mimeType, fileName);
  var file = folder.createFile(blob);

  // 誰でも閲覧できるよう共有設定
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 画像の直接表示URL（uc?export=view形式）
  var fileId = file.getId();
  var imageUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;

  // スプレッドシートに記録
  var sheet = getSheet(SHEET.PHOTOS);
  var id = 'PH' + new Date().getTime();
  sheet.appendRow([id, residentId, imageUrl, fileName, memo, uploader, new Date()]);

  return { success: true, url: imageUrl };
}

// ============================================================
// 写真取得（利用者IDで絞り込み）
// ============================================================
function getPhotos(params) {
  var residentId = String(params.residentId || '');
  var photos = sheetToArray(getSheet(SHEET.PHOTOS));
  var result = photos.filter(function(p) {
    return !residentId || String(p['利用者ID']) === residentId;
  }).map(function(p) {
    return {
      '画像URL':    String(p['画像URL'] || ''),
      'メモ':       String(p['メモ'] || ''),
      '撮影日時':   formatDateTime(p['撮影日時'])
    };
  });
  return { photos: result };
}
