// ============================================================
// HaruLink - Firebase 設定・共通ユーティリティ
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBLsF3-edJ17qKtV_HfCAX0GNlRlABD1k4",
  authDomain: "harulink.firebaseapp.com",
  projectId: "harulink",
  storageBucket: "harulink.firebasestorage.app",
  messagingSenderId: "788689352075",
  appId: "1:788689352075:web:eb0b88f6b60c2156956b8e",
  measurementId: "G-SK8JMYZ922"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);

// サービス取得
const auth = firebase.auth();
const db = firebase.firestore();

// Firestoreコレクション名
const COLLECTIONS = {
  STAFF:        'staff',
  FAMILIES:     'families',
  CAREMANAGERS: 'caremanagers',
  RESIDENTS:    'residents',
  MESSAGES:     'messages',
  BROADCASTS:   'broadcasts',
  VISITS:       'visits',
  SUSPENDS:     'suspends',
  PHOTOS:       'photos'
};
