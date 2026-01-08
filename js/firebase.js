/**
 * 00631L 避險計算器 - Firebase 模組
 * 處理資料儲存和即時同步
 */

// Firebase 設定
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCXZXIYFKOejwegXD1n_E1N5SCWr7Unpxw",
    authDomain: "hedge-option-tool.firebaseapp.com",
    databaseURL: "https://hedge-option-tool-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hedge-option-tool",
    storageBucket: "hedge-option-tool.firebasestorage.app",
    messagingSenderId: "341937921876",
    appId: "1:341937921876:web:3706db8f1f61554525f2c1",
    measurementId: "G-LG609LN6XT"
};

// Firebase 實例
let firebaseApp = null;
let database = null;
let isConnected = false;

// 預設資料結構
const DEFAULT_DATA = {
    etfLots: 0,
    etfCost: 100,
    etfCurrentPrice: 100,
    hedgeRatio: 0.2,
    optionPositions: [],
    strategyB: {
        positions: []
    },
    accountCost: 0,       // 帳戶成本
    accountBalance: 0,    // 目前餘額
    lastUpdated: null
};

/**
 * 初始化 Firebase
 * @param {Object} config - Firebase 設定（可選，使用預設設定）
 * @returns {boolean} 是否成功初始化
 */
function initFirebase(config = null) {
    try {
        const finalConfig = config || FIREBASE_CONFIG;

        // 檢查設定是否有效
        if (finalConfig.apiKey === "YOUR_API_KEY") {
            console.warn('Firebase 尚未設定，使用本地儲存模式');
            updateConnectionStatus(false, '本地模式');
            return false;
        }

        // 初始化 Firebase
        if (!firebaseApp) {
            firebaseApp = firebase.initializeApp(finalConfig);
            database = firebase.database();
        }

        // 監聽連線狀態
        const connectedRef = firebase.database().ref('.info/connected');
        connectedRef.on('value', (snap) => {
            isConnected = snap.val() === true;
            updateConnectionStatus(isConnected, isConnected ? '已連線' : '離線');
        });

        console.log('Firebase 初始化成功');
        return true;
    } catch (error) {
        console.error('Firebase 初始化失敗:', error);
        updateConnectionStatus(false, '連線失敗');
        return false;
    }
}

/**
 * 更新連線狀態 UI
 * @param {boolean} connected - 是否已連線
 * @param {string} message - 狀態訊息
 */
function updateConnectionStatus(connected, message) {
    const statusEl = document.getElementById('firebase-status');
    if (statusEl) {
        statusEl.className = 'status-indicator' + (connected ? ' connected' : '');
        const textEl = statusEl.querySelector('.status-text');
        if (textEl) {
            textEl.textContent = message;
        }
    }
}

/**
 * 取得使用者 ID（使用裝置識別或匿名 ID）
 * @returns {string} 使用者 ID
 */
function getUserId() {
    let userId = localStorage.getItem('hedge_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('hedge_user_id', userId);
    }
    return userId;
}

/**
 * 儲存資料到 Firebase
 * @param {Object} data - 要儲存的資料
 * @returns {Promise<boolean>} 是否成功
 */
async function saveData(data) {
    const dataToSave = {
        ...data,
        lastUpdated: new Date().toISOString()
    };

    // 同時儲存到本地
    localStorage.setItem('hedge_positions', JSON.stringify(dataToSave));

    // 如果 Firebase 可用，也儲存到雲端
    if (database && isConnected) {
        try {
            const userId = getUserId();
            await database.ref(`users/${userId}/positions`).set(dataToSave);
            console.log('資料已儲存到 Firebase');
            return true;
        } catch (error) {
            console.error('Firebase 儲存失敗:', error);
            return false;
        }
    }

    console.log('資料已儲存到本地');
    return true;
}

/**
 * 從 Firebase 載入資料
 * @returns {Promise<Object>} 載入的資料
 */
async function loadData() {
    // 先嘗試從 Firebase 載入
    // 修改：不等待 isConnected 狀態，直接嘗試讀取（Firebase SDK 會處理連線狀態）
    if (database) {
        try {
            const userId = getUserId();
            // 設定 3 秒超時，避免網路不通時卡住
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firebase 讀取超時')), 3000)
            );

            const dbPromise = database.ref(`users/${userId}/positions`).get();

            const snapshot = await Promise.race([dbPromise, timeoutPromise]);

            if (snapshot.exists()) {
                console.log('從 Firebase 載入資料');
                return snapshot.val();
            }
        } catch (error) {
            console.error('Firebase 載入失敗:', error);
            // 如果 Firebase 失敗，會繼續往下執行本地載入
        }
    }

    // 從本地載入
    const localData = localStorage.getItem('hedge_positions');
    if (localData) {
        try {
            console.log('從本地儲存載入資料');
            return JSON.parse(localData);
        } catch (error) {
            console.error('本地資料解析失敗:', error);
        }
    }

    // 返回預設資料
    console.log('使用預設資料');
    return { ...DEFAULT_DATA };
}

/**
 * 設定即時同步監聽器
 * @param {Function} callback - 資料變更時的回呼函數
 * @returns {Function} 取消訂閱函數
 */
function subscribeToChanges(callback) {
    if (!database) {
        console.warn('Firebase 未初始化，無法設定同步');
        return () => { };
    }

    const userId = getUserId();
    const ref = database.ref(`users/${userId}/positions`);

    const handler = ref.on('value', (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        }
    });

    // 返回取消訂閱函數
    return () => ref.off('value', handler);
}

/**
 * 清除所有資料
 * @returns {Promise<boolean>} 是否成功
 */
async function clearData() {
    // 清除本地
    localStorage.removeItem('hedge_positions');

    // 清除 Firebase
    if (database && isConnected) {
        try {
            const userId = getUserId();
            await database.ref(`users/${userId}/positions`).remove();
            console.log('Firebase 資料已清除');
        } catch (error) {
            console.error('Firebase 清除失敗:', error);
        }
    }

    return true;
}

/**
 * 匯出資料為 JSON 檔案
 * @param {Object} data - 要匯出的資料
 */
function exportDataAsJSON(data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `hedge_positions_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 從 JSON 檔案匯入資料
 * @param {File} file - JSON 檔案
 * @returns {Promise<Object>} 匯入的資料
 */
async function importDataFromJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                resolve(data);
            } catch (error) {
                reject(new Error('JSON 解析失敗'));
            }
        };
        reader.onerror = () => reject(new Error('檔案讀取失敗'));
        reader.readAsText(file);
    });
}

// 匯出模組
window.FirebaseModule = {
    initFirebase,
    saveData,
    loadData,
    subscribeToChanges,
    clearData,
    exportDataAsJSON,
    importDataFromJSON,
    getUserId,
    isConnected: () => isConnected
};
