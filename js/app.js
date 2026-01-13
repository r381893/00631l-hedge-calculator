/**
 * 00631L 避險計算器 - 主應用程式
 * 處理 UI 互動、資料同步和狀態管理
 */

// ======== 全域狀態 ========
// 策略儲存容器
const strategies = {
    A: [],
    B: [],
    C: []
};

const state = {
    etfLots: 0,
    etfCost: 100,
    etfCurrentPrice: 100,
    hedgeRatio: 0.2,
    tseIndex: 23000,
    referenceIndex: 23000, // 基準指數
    priceRange: 1500,
    accountCost: 0, // 帳戶成本
    accountBalance: 0, // 目前餘額

    // 已實現損益 (平倉後的獲利/虧損)
    realizedPnL: {
        A: 0,
        B: 0,
        C: 0
    },

    // 策略管理
    strategies: strategies,
    currentStrategy: 'A',
    optionPositions: strategies.A, // 動態指向當前策略的倉位

    // UI Cache
    lastRenderedStrikeCenter: null,
    optionChainData: null,
    optionSource: 'taifex', // 報價來源: taifex, mock, fubon

    // 複試單分組
    nextGroupId: 1,
    selectedPositions: new Set(), // 儲存格式: "Strategy-Index" (e.g., "A-0")

    isLoading: true
};

// ======== DOM 元素快取 ========
const elements = {};

// ======== 全域變數 ========
let uploadedImageBase64 = null; // 儲存上傳圖片的 Base64 數據

// ======== 初始化 ========
document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    bindEvents();
    bindInventoryEvents(); // Bind new AI Inventory events
    await initApp();
});

/**
 * 快取常用 DOM 元素
 */
function cacheElements() {
    // Header
    elements.tseIndex = document.getElementById('tse-index');
    elements.etfPrice = document.getElementById('etf-price');

    // Sidebar
    elements.sidebarToggle = document.getElementById('sidebar-toggle');
    elements.sidebar = document.getElementById('sidebar');
    elements.etfLotsInput = document.getElementById('etf-lots');
    elements.etfCostInput = document.getElementById('etf-cost');
    elements.etfCurrentInput = document.getElementById('etf-current');
    elements.hedgeRatioInput = document.getElementById('hedge-ratio');
    elements.accountCostInput = document.getElementById('account-cost');
    elements.accountBalanceInput = document.getElementById('account-balance');
    elements.accountPnLValue = document.getElementById('account-pnl-value');
    elements.suggestedLots = document.getElementById('suggested-lots');
    elements.suggestedCalc = document.getElementById('suggested-calc');
    elements.priceRangeInput = document.getElementById('price-range');
    elements.referenceIndexInput = document.getElementById('reference-index');
    elements.currentIndexDisplay = document.getElementById('current-index-display');

    // File Operations - 移除
    // elements.btnReload = document.getElementById('btn-reload');
    // elements.btnSave = document.getElementById('btn-save');
    // elements.btnClear = document.getElementById('btn-clear');

    elements.etfSummarySection = document.getElementById('etf-summary');
    elements.statLots = document.getElementById('stat-lots');
    elements.statShares = document.getElementById('stat-shares');
    elements.statMarketValue = document.getElementById('stat-market-value');
    elements.statCostValue = document.getElementById('stat-cost-value');
    elements.statUnrealizedPnL = document.getElementById('stat-unrealized-pnl');
    elements.statPnLPct = document.getElementById('stat-pnl-pct');
    elements.hedgeSuggestion = document.getElementById('hedge-suggestion');
    elements.strikePickerGrid = document.getElementById('strike-picker-grid');

    elements.positionsSection = document.getElementById('positions-section');
    // Dual column positions
    elements.positionsListA = document.getElementById('positions-list-a');
    elements.positionsListB = document.getElementById('positions-list-b');
    elements.positionsListC = document.getElementById('positions-list-c');
    elements.countA = document.getElementById('count-a');
    elements.countB = document.getElementById('count-b');
    elements.countC = document.getElementById('count-c');
    elements.premiumInA = document.getElementById('premium-in-a');
    elements.premiumOutA = document.getElementById('premium-out-a');
    elements.premiumNetA = document.getElementById('premium-net-a');
    elements.premiumInB = document.getElementById('premium-in-b');
    elements.premiumOutB = document.getElementById('premium-out-b');
    elements.premiumNetB = document.getElementById('premium-net-b');
    elements.premiumInC = document.getElementById('premium-in-c');
    elements.premiumOutC = document.getElementById('premium-out-c');
    elements.premiumNetC = document.getElementById('premium-net-c');

    // 已實現損益輸入
    elements.realizedPnLA = document.getElementById('realized-pnl-a');
    elements.realizedPnLB = document.getElementById('realized-pnl-b');
    elements.realizedPnLC = document.getElementById('realized-pnl-c');

    elements.pnlTableBody = document.getElementById('pnl-table-body');

    // Tabs
    elements.productTabs = document.querySelectorAll('.tab[data-product]');
    elements.optionForm = document.getElementById('option-form');
    elements.futuresForm = document.getElementById('futures-form');

    // Option Form
    elements.optType = document.getElementById('opt-type');
    elements.optStrike = document.getElementById('opt-strike');
    elements.optLots = document.getElementById('opt-lots');
    elements.optPremium = document.getElementById('opt-premium');
    elements.btnGetPrice = document.getElementById('btn-get-price');
    elements.priceLoading = document.getElementById('price-loading');
    elements.btnAddOption = document.getElementById('btn-add-option');

    // Futures Form
    elements.futuresStrike = document.getElementById('futures-strike');
    elements.futuresLots = document.getElementById('futures-lots');
    elements.btnAddFutures = document.getElementById('btn-add-futures');

    // Strategy Controls
    elements.btnConfirmCopy = document.getElementById('btn-confirm-copy');
    elements.chkConfirmCopy = document.getElementById('chk-confirm-copy'); // Added
    elements.copySource = document.getElementById('copy-source');
    elements.copyTarget = document.getElementById('copy-target');

    elements.btnGroupPositions = document.getElementById('btn-group-positions');
    elements.btnClearStrategy = document.getElementById('btn-clear-strategy');
    elements.btnAddToA = document.getElementById('btn-add-to-a');
    elements.btnAddToB = document.getElementById('btn-add-to-b');
    elements.btnAddToC = document.getElementById('btn-add-to-c');



    // AI Inventory Parser
    elements.inventoryText = document.getElementById('inventory-text');

    // Sensitivity Analysis Elements
    state.senElements = {
        indexDown: document.getElementById('sen-index-down'),
        indexCurrent: document.getElementById('sen-index-current'),
        indexUp: document.getElementById('sen-index-up'),
        etfDown: document.getElementById('sen-etf-down'),
        etfCurrent: document.getElementById('sen-etf-current'),
        etfUp: document.getElementById('sen-etf-up'),
        stratDown: document.getElementById('sen-strategy-down'),
        stratCurrent: document.getElementById('sen-strategy-current'),
        stratUp: document.getElementById('sen-strategy-up')
    };
    elements.btnParseInventory = document.getElementById('btn-parse-inventory');
    elements.btnClearInventory = document.getElementById('btn-clear-inventory');
    elements.parseResults = document.getElementById('parse-results');

    // Firebase Config
    elements.firebaseConfigInput = document.getElementById('firebase-config-input');
    elements.btnSaveFirebaseConfig = document.getElementById('btn-save-firebase-config');
    elements.btnResetFirebase = document.getElementById('btn-reset-firebase');
    elements.btnTestFirebase = document.getElementById('btn-test-firebase');
    elements.btnCopySyncLink = document.getElementById('btn-copy-sync-link');
    elements.parsedEtf = document.getElementById('parsed-etf');
    elements.parsedOptions = document.getElementById('parsed-options');
    elements.btnApplyParsed = document.getElementById('btn-apply-parsed');

    // Image OCR
    elements.imageUpload = document.getElementById('image-upload');
    elements.imageUploadArea = document.getElementById('image-upload-area');
    elements.btnBrowseImage = document.getElementById('btn-browse-image');
    elements.imagePreview = document.getElementById('image-preview');
    elements.previewImg = document.getElementById('preview-img');
    elements.btnOcrRecognize = document.getElementById('btn-ocr-recognize');
    elements.btnClearImage = document.getElementById('btn-clear-image');
    elements.ocrLoading = document.getElementById('ocr-loading');

    // Footer
    elements.updateTime = document.getElementById('update-time');

    // Toast
    elements.toast = document.getElementById('toast');
}

/**
 * 綁定事件處理器
 */
function bindEvents() {
    // Sidebar Toggle
    elements.sidebarToggle?.addEventListener('click', toggleSidebar);

    // Sidebar Overlay - click to close sidebar
    document.getElementById('sidebar-overlay')?.addEventListener('click', toggleSidebar);

    // Sidebar Inputs
    elements.etfLotsInput?.addEventListener('input', handleSettingsChange);
    elements.etfCostInput?.addEventListener('input', handleSettingsChange);
    elements.etfCurrentInput?.addEventListener('input', handleSettingsChange);
    elements.hedgeRatioInput?.addEventListener('input', handleSettingsChange);
    elements.accountCostInput?.addEventListener('input', handleSettingsChange);
    elements.accountBalanceInput?.addEventListener('input', handleSettingsChange);
    elements.priceRangeInput?.addEventListener('input', handleSettingsChange);
    elements.referenceIndexInput?.addEventListener('input', handleSettingsChange);

    // 已實現損益輸入
    elements.realizedPnLA?.addEventListener('input', handleRealizedPnLChange);
    elements.realizedPnLB?.addEventListener('input', handleRealizedPnLChange);
    elements.realizedPnLC?.addEventListener('input', handleRealizedPnLChange);

    // File Operations (已移除)
    // elements.btnReload?.addEventListener('click', () => window.location.reload());
    // elements.btnSave?.addEventListener('click', handleSave);
    elements.btnClear?.addEventListener('click', handleClear);

    // Product Tabs
    elements.productTabs.forEach(tab => {
        tab.addEventListener('click', handleProductTabClick);
    });

    // Add Position
    elements.btnAddOption?.addEventListener('click', handleAddOption);
    elements.btnGetPrice?.addEventListener('click', handleGetOptionPrice);
    elements.btnAddFutures?.addEventListener('click', handleAddFutures);

    // Strategy Controls
    elements.btnGroupPositions?.addEventListener('click', handleGroupPositions);
    // elements.btnOpenCopyModal... (已移除)
    elements.btnConfirmCopy?.addEventListener('click', handleConfirmCopy);
    elements.chkConfirmCopy?.addEventListener('change', (e) => {
        if (elements.btnConfirmCopy) {
            elements.btnConfirmCopy.disabled = !e.target.checked;
        }
    });
    elements.copySource?.addEventListener('change', handleCopySourceChange);
    elements.btnClearStrategy?.addEventListener('click', handleClearStrategy);
    elements.btnAddToA?.addEventListener('click', () => handleAddToStrategyClick('A'));
    elements.btnAddToB?.addEventListener('click', () => handleAddToStrategyClick('B'));
    elements.btnAddToC?.addEventListener('click', () => handleAddToStrategyClick('C'));



    // AI Inventory Parser
    elements.btnParseInventory?.addEventListener('click', handleParseInventory);
    elements.btnClearInventory?.addEventListener('click', handleClearInventory);
    elements.btnApplyParsed?.addEventListener('click', handleApplyParsed);

    // Firebase Config
    elements.btnSaveFirebaseConfig?.addEventListener('click', handleSaveFirebaseConfig);
    elements.btnResetFirebase?.addEventListener('click', handleResetFirebaseConfig);
    elements.btnTestFirebase?.addEventListener('click', handleTestFirebaseConnection);
    elements.btnCopySyncLink?.addEventListener('click', handleCopySyncLink);

    // Image OCR
    elements.btnBrowseImage?.addEventListener('click', () => elements.imageUpload?.click());
    elements.imageUpload?.addEventListener('change', handleImageUpload);
    elements.imageUploadArea?.addEventListener('dragover', handleImageDragOver);
    elements.imageUploadArea?.addEventListener('dragleave', handleImageDragLeave);
    elements.imageUploadArea?.addEventListener('drop', handleImageDrop);
    elements.btnOcrRecognize?.addEventListener('click', handleOcrRecognize);
    elements.btnClearImage?.addEventListener('click', handleClearImage);

    // AI Analysis
    bindAIEvents();

    // Source Switcher (資料來源切換)
    bindSourceSwitcherEvents();
}

/**
 * 綁定資料來源切換事件
 */
function bindSourceSwitcherEvents() {
    const sourceButtons = document.querySelectorAll('.source-btn');
    const sourceStatus = document.getElementById('source-status');

    sourceButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const source = e.target.dataset.source;
            if (!source || btn.disabled) return;

            // 更新按鈕狀態
            sourceButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 更新 state
            state.optionSource = source;
            state.lastRenderedStrikeCenter = null; // 強制重新載入
            state.optionChainData = null;

            // 更新狀態顯示
            if (sourceStatus) {
                sourceStatus.textContent = '切換中...';
                sourceStatus.className = 'source-status';
            }

            // 重新載入報價表
            await renderStrikePicker();

            // 更新狀態
            if (sourceStatus && state.optionChainData) {
                const sourceLabel = {
                    'taifex': '期交所',
                    'mock': '模擬',
                    'fubon': '富邦'
                };
                sourceStatus.textContent = sourceLabel[state.optionChainData.source] || state.optionChainData.source;
                sourceStatus.className = state.optionChainData.source === 'mock' ? 'source-status warning' : 'source-status success';
            }
        });
    });

    // 初始化時檢查可用來源
    initSourceAvailability();
}

/**
 * 初始化並檢查可用的資料來源
 */
async function initSourceAvailability() {
    const sourceStatus = document.getElementById('source-status');
    const fubonBtn = document.querySelector('.source-btn[data-source="fubon"]');
    const taifexBtn = document.querySelector('.source-btn[data-source="taifex"]');

    try {
        const response = await fetch('http://localhost:5000/api/sources');
        if (response.ok) {
            const data = await response.json();

            // 啟用富邦按鈕（如果可用）
            if (fubonBtn && data.fubon_available) {
                fubonBtn.disabled = false;
            }

            // 如果期交所不可用，自動切換到 mock
            if (!data.taifex_available && taifexBtn) {
                taifexBtn.classList.remove('active');
                const mockBtn = document.querySelector('.source-btn[data-source="mock"]');
                if (mockBtn) {
                    mockBtn.classList.add('active');
                    state.optionSource = 'mock';
                }
            }

            // 更新狀態
            if (sourceStatus) {
                sourceStatus.textContent = data.taifex_available ? '期交所' : '模擬';
                sourceStatus.className = data.taifex_available ? 'source-status success' : 'source-status warning';
            }
        }
    } catch (error) {
        console.warn('無法檢查資料來源:', error);
        if (sourceStatus) {
            sourceStatus.textContent = 'API 離線';
            sourceStatus.className = 'source-status warning';
        }
    }
}

/**
 * 初始化應用程式
 */
async function initApp() {
    try {
        // 初始化 Firebase
        FirebaseModule.initFirebase();

        // 載入當前 Firebase 設定到 UI
        if (elements.firebaseConfigInput) {
            let currentConfig = FirebaseModule.getCurrentConfig();
            // 如果當前設定是空的 (防呆)，使用預設值
            if (!currentConfig || Object.keys(currentConfig).length === 0) {
                currentConfig = FirebaseModule.DEFAULT_CONFIG;
            }
            elements.firebaseConfigInput.value = JSON.stringify(currentConfig, null, 2);
        }

        // 設定版本時間 (Static Build Time)
        if (elements.updateTime) {
            elements.updateTime.textContent = '2026-01-10 11:32';
        }

        // 載入資料
        const savedData = await FirebaseModule.loadData();
        if (savedData) {
            // 輔助函數：確保轉換為陣列 (處理 Firebase 可能回傳物件的情況)
            const ensureArray = (data) => {
                if (!data) return [];
                if (Array.isArray(data)) return data;
                return Object.values(data);
            };

            // 資料遷移：處理各種儲存格式
            if (savedData.optionPositions) {
                state.strategies.A = ensureArray(savedData.optionPositions);
            }
            if (savedData.strategyB && savedData.strategyB.positions) {
                state.strategies.B = ensureArray(savedData.strategyB.positions);
            }
            if (savedData.strategyC && savedData.strategyC.positions) {
                state.strategies.C = ensureArray(savedData.strategyC.positions);
            }

            // 還原其他欄位
            state.etfLots = savedData.etfLots || 0;
            state.etfCost = savedData.etfCost || 100;
            state.etfCurrentPrice = savedData.etfCurrentPrice || 100;
            state.hedgeRatio = savedData.hedgeRatio || 0.2;
            state.priceRange = savedData.priceRange || 1500;
            state.tseIndex = savedData.tseIndex || 23000;
            state.referenceIndex = savedData.referenceIndex || state.tseIndex; // Default to current index if not saved
            state.accountCost = savedData.accountCost || 0;
            state.accountBalance = savedData.accountBalance || 0;
            state.currentStrategy = savedData.currentStrategy || 'A';

            // 還原已實現損益
            if (savedData.realizedPnL) {
                state.realizedPnL.A = savedData.realizedPnL.A || 0;
                state.realizedPnL.B = savedData.realizedPnL.B || 0;
                state.realizedPnL.C = savedData.realizedPnL.C || 0;
            }

            // 確保 optionPositions 正確指向
            state.optionPositions = state.strategies[state.currentStrategy];

            // 更新帳戶輸入欄位
            if (elements.accountCostInput) elements.accountCostInput.value = state.accountCost;
            if (elements.accountBalanceInput) elements.accountBalanceInput.value = state.accountBalance;

            // 更新已實現損益輸入欄位
            if (elements.realizedPnLA) elements.realizedPnLA.value = state.realizedPnL.A;
            if (elements.realizedPnLB) elements.realizedPnLB.value = state.realizedPnL.B;
            if (elements.realizedPnLC) elements.realizedPnLC.value = state.realizedPnL.C;

            updateAccountPnLDisplay();

            // 顯示資料來源提示
            if (savedData._source === 'local') {
                showToast('info', `已載入本地資料 (${new Date(savedData.lastUpdated).toLocaleString()})`);
            } else if (savedData._source === 'cloud') {
                showToast('success', `已載入雲端資料 (${new Date(savedData.lastUpdated).toLocaleString()})`);
            }
        }

        // 抓取即時價格
        await fetchMarketPrices();

        // 更新 UI
        updateUI();

        // 設定策略選擇按鈕狀態
        if (elements.btnAddToA && elements.btnAddToB) {
            elements.btnAddToA.classList.toggle('active', state.currentStrategy === 'A');
            elements.btnAddToB.classList.toggle('active', state.currentStrategy === 'B');
        }

        // 設定預設履約價
        const defaultStrike = Math.round(state.tseIndex / 100) * 100;
        if (elements.optStrike) elements.optStrike.value = defaultStrike;
        if (elements.futuresStrike) elements.futuresStrike.value = defaultStrike;

        // 初始化履約價點選器
        renderStrikePicker();

        // 初始化圖表
        ChartModule.initPnLChart('pnl-chart');
        updateChart();

        // 更新時間 (現在使用 initApp 中的靜態版本時間)
        // updateTime();

        state.isLoading = false;
        showToast('success', '應用程式載入完成');
    } catch (error) {
        console.error('初始化失敗:', error);
        showToast('error', '載入失敗: ' + error.message);
    }
}

/**
 * 抓取市場即時價格（使用多個 CORS proxy 備援）
 */
async function fetchMarketPrices() {
    // 多個 CORS proxy 備援（更新為更可靠的服務）
    const corsProxies = [
        'https://corsproxy.io/?url=',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest='
    ];

    let successfulProxy = null;
    let tseSuccess = false;
    let etfSuccess = false;

    // 嘗試抓取加權指數
    for (const proxy of corsProxies) {
        try {
            const tseUrl = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/%5ETWII?interval=1d&range=5d');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const tseRes = await fetch(proxy + tseUrl, {
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (tseRes.ok) {
                const tseData = await tseRes.json();
                const tsePrice = tseData?.chart?.result?.[0]?.meta?.regularMarketPrice;
                if (tsePrice && tsePrice > 1000) {
                    state.tseIndex = Math.round(tsePrice * 100) / 100;
                    // 如果尚未設定基準指數 (例如第一次載入)，預設使用當前指數
                    if (!state.referenceIndex) state.referenceIndex = state.tseIndex;
                    successfulProxy = proxy;
                    tseSuccess = true;
                    console.log('✅ 加權指數抓取成功:', state.tseIndex, '使用:', proxy);
                    break;
                }
            }
        } catch (e) {
            console.warn(`❌ CORS proxy ${proxy} 失敗:`, e.message);
        }
    }

    // 抓取 00631L（使用成功的 proxy 或重試所有）
    const proxiesToTry = successfulProxy ? [successfulProxy, ...corsProxies.filter(p => p !== successfulProxy)] : corsProxies;

    for (const proxy of proxiesToTry) {
        try {
            const etfUrl = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/00631L.TW?interval=1d&range=5d');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const etfRes = await fetch(proxy + etfUrl, {
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (etfRes.ok) {
                const etfData = await etfRes.json();
                const etfPrice = etfData?.chart?.result?.[0]?.meta?.regularMarketPrice;
                if (etfPrice && etfPrice > 0) {
                    state.etfCurrentPrice = Math.round(etfPrice * 100) / 100;
                    etfSuccess = true;
                    console.log('✅ 00631L 抓取成功:', state.etfCurrentPrice);
                    break;
                }
            }
        } catch (e) {
            console.warn(`❌ 無法抓取 00631L (${proxy}):`, e.message);
        }
    }

    // 顯示結果
    if (tseSuccess && etfSuccess) {
        showToast('success', `報價更新成功：加權 ${state.tseIndex.toLocaleString()} / 00631L ${state.etfCurrentPrice}`);
    } else if (!tseSuccess && !etfSuccess) {
        console.log('API 抓取失敗，請手動輸入即時價格');
        showToast('warning', '無法自動抓取報價，請手動輸入');
    } else {
        showToast('info', `部分報價更新：${tseSuccess ? '加權 ' + state.tseIndex.toLocaleString() : '加權失敗'} / ${etfSuccess ? '00631L ' + state.etfCurrentPrice : '00631L失敗'}`);
    }
}

/**
 * 更新所有 UI 元素
 */
function updateUI() {
    updateHeaderPrices();
    updateSidebarInputs();
    updateETFSummary();
    updateSuggestedHedge();
    renderPositionsList('A');
    updatePremiumSummary('A');
    renderPositionsList('B');
    updatePremiumSummary('B');
    renderPositionsList('C');
    updatePremiumSummary('C');
    updatePnLTable();
    updateSensitivityAnalysis(); // Added

    // 更新履約價選擇器 (僅當中心點改變時才會重繪)
    renderStrikePicker();
}

/**
 * 更新 Header 價格顯示
 */
function updateHeaderPrices() {
    if (elements.tseIndex) {
        elements.tseIndex.textContent = state.tseIndex.toLocaleString();
    }
    if (elements.etfPrice) {
        elements.etfPrice.textContent = state.etfCurrentPrice.toFixed(2);
    }
    if (elements.currentIndexDisplay) {
        elements.currentIndexDisplay.textContent = state.tseIndex.toLocaleString();
    }
}

/**
 * 更新側邊欄輸入值
 */
function updateSidebarInputs() {
    if (elements.etfLotsInput && document.activeElement !== elements.etfLotsInput) {
        elements.etfLotsInput.value = state.etfLots;
    }
    if (elements.etfCostInput && document.activeElement !== elements.etfCostInput) {
        elements.etfCostInput.value = state.etfCost;
    }
    if (elements.etfCurrentInput && document.activeElement !== elements.etfCurrentInput) {
        elements.etfCurrentInput.value = state.etfCurrentPrice;
    }
    if (elements.hedgeRatioInput && document.activeElement !== elements.hedgeRatioInput) {
        elements.hedgeRatioInput.value = state.hedgeRatio;
    }
    if (elements.priceRangeInput && document.activeElement !== elements.priceRangeInput) {
        elements.priceRangeInput.value = state.priceRange;
    }
    if (elements.referenceIndexInput && document.activeElement !== elements.referenceIndexInput) {
        elements.referenceIndexInput.value = state.referenceIndex;
    }
    if (elements.accountCostInput && document.activeElement !== elements.accountCostInput) {
        elements.accountCostInput.value = state.accountCost;
    }
    if (elements.accountBalanceInput && document.activeElement !== elements.accountBalanceInput) {
        elements.accountBalanceInput.value = state.accountBalance;
    }
}

/**
 * 更新建議避險口數
 */
/**
 * 更新建議避險口數
 */
function updateSuggestedHedge() {
    const suggested = state.etfLots * state.hedgeRatio;
    if (elements.suggestedLots) {
        elements.suggestedLots.textContent = `${suggested.toFixed(1)} 口`;
    }
    if (elements.suggestedCalc) {
        elements.suggestedCalc.textContent = `(${state.etfLots.toFixed(2)} 張 × ${state.hedgeRatio.toFixed(2)})`;
    }
}

/**
 * 更新 ETF 庫存摘要
 */
function updateETFSummary() {
    // 安全檢查：確保元素存在才操作 style
    if (!elements.etfSummarySection) {
        // 元素已從 HTML 移除，靜默跳過
        return;
    }

    if (state.etfLots <= 0) {
        elements.etfSummarySection.style.display = 'none';
        return;
    }

    elements.etfSummarySection.style.display = 'block';

    const summary = Calculator.calculateETFSummary({
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice
    });

    if (!summary) return;

    if (elements.statLots) elements.statLots.textContent = `${summary.lots.toFixed(2)} 張`;
    if (elements.statShares) elements.statShares.textContent = `${summary.shares.toLocaleString()} 股`;
    if (elements.statMarketValue) elements.statMarketValue.textContent = `${summary.marketValue.toLocaleString()} 元`;
    if (elements.statCostValue) elements.statCostValue.textContent = `${summary.costValue.toLocaleString()} 元`;

    if (elements.statUnrealizedPnL) {
        const pnlClass = summary.unrealizedPnL >= 0 ? 'profit' : 'loss';
        elements.statUnrealizedPnL.textContent = `${summary.unrealizedPnL >= 0 ? '+' : ''}${summary.unrealizedPnL.toLocaleString()} 元`;
        elements.statUnrealizedPnL.className = 'stat-value ' + pnlClass;
    }
    if (elements.statPnLPct) elements.statPnLPct.textContent = `${summary.pnlPercent >= 0 ? '+' : ''}${summary.pnlPercent.toFixed(2)}%`;

    // 更新避險建議
    const suggestion = state.etfLots * state.hedgeRatio;
    if (elements.hedgeSuggestion) {
        const suggestionText = elements.hedgeSuggestion.querySelector('.suggestion-text');
        if (suggestionText) {
            suggestionText.innerHTML = `持有 ${state.etfLots.toFixed(2)} 張，建議買入 <b>${suggestion.toFixed(1)} 口</b> 賣權進行保護`;
        }
    }
}

/**
 * 更新帳戶損益顯示
 */
function updateAccountPnLDisplay() {
    const accountPnL = state.accountBalance - state.accountCost;
    if (elements.accountPnLValue) {
        const cls = accountPnL >= 0 ? 'profit' : 'loss';
        const sign = accountPnL >= 0 ? '+' : '';
        elements.accountPnLValue.textContent = `${sign}${accountPnL.toLocaleString()} 元`;
        elements.accountPnLValue.className = cls;
    }
}

/**
 * 計算帳戶損益
 */
function getAccountPnL() {
    return state.accountBalance - state.accountCost;
}

/**
 * 產生履約價點選器 (支援即時報價)
 */
async function renderStrikePicker() {
    if (!elements.strikePickerGrid) return;

    // 顯示載入中
    elements.strikePickerGrid.innerHTML = '<div style="text-align: center; padding: 20px;"><span class="loading-spinner"></span> 正在載入即時報價...</div>';

    const centerStrike = Math.round(state.tseIndex / 100) * 100;

    // 避免重複渲染相同的中心點 (但在切換時仍需重新抓取)
    if (state.lastRenderedStrikeCenter === centerStrike && state.optionChainData) {
        renderOptionChainGrid(state.optionChainData);
        return;
    }
    state.lastRenderedStrikeCenter = centerStrike;

    try {
        // 呼叫後端 API 取得報價鏈
        // 請求範圍：前後 10 檔 (依照使用者目前的視圖)
        const range = 10;
        const source = state.optionSource || 'taifex';
        const apiUrl = `http://localhost:5000/api/option-chain?center=${centerStrike}&range=${range}&source=${source}`;

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('API Error');

        const data = await response.json();
        state.optionChainData = data; // 快取資料

        renderOptionChainGrid(data);

    } catch (error) {
        console.error('報價表載入失敗:', error);
        // 降級處理：顯示無報價的表格
        renderOptionChainGrid({
            center: centerStrike,
            chain: generateMockChain(centerStrike, 10, false) // false = 不帶價格
        });
        showToast('warning', '報價讀取失敗，顯示純履約價表');
    }
}

/**
 * 渲染報價表網格 (分離出來的渲染邏輯)
 */
function renderOptionChainGrid(data) {
    if (!elements.strikePickerGrid) return;

    let html = `
        <div class="chain-header">
            <span class="chain-col-call">Call (買權)</span>
            <span class="chain-col-strike">履約價</span>
            <span class="chain-col-put">Put (賣權)</span>
        </div>
        <div class="chain-body">
    `;

    // 確保資料按履約價排序
    const chain = data.chain.sort((a, b) => a.strike - b.strike);

    html += chain.map(row => {
        const isAtm = row.strike === data.center;

        // 處理 Call 價格
        const callPrice = row.call?.price > 0 ? row.call.price : '買';
        const callBid = row.call?.bid > 0 ? row.call.bid : '賣';

        // 處理 Put 價格
        const putPrice = row.put?.price > 0 ? row.put.price : '買';
        const putBid = row.put?.bid > 0 ? row.put.bid : '賣';

        // 價格顯示 (如果有價格就顯示數值，否則顯示買/賣)
        // 這裡邏輯："賣出"按鈕顯示"Bid"價格(因為你要賣)，"買進"按鈕顯示"Ask"價格(因為你要買)
        // 但為了簡化且符合一般看盤習慣，通常顯示 Last Price (成交價)
        // 使用者需求是「成交價」，我們這裡優先顯示 Last Price

        const formatPrice = (p) => typeof p === 'number' ? p : p;

        return `
            <div class="chain-row ${isAtm ? 'atm' : ''}">
                <div class="chain-cell call-cell">
                    <button class="chain-btn cell-btn sell" data-strike="${row.strike}" data-type="Call" data-direction="賣出" data-price="${row.call?.price || 0}">${formatPrice(row.call?.price || '賣')}</button>
                    <button class="chain-btn cell-btn buy" data-strike="${row.strike}" data-type="Call" data-direction="買進" data-price="${row.call?.price || 0}">${formatPrice(row.call?.price || '買')}</button>
                </div>
                <div class="chain-cell strike-cell">
                    <span class="chain-strike">${row.strike}</span>
                </div>
                <div class="chain-cell put-cell">
                    <button class="chain-btn cell-btn buy" data-strike="${row.strike}" data-type="Put" data-direction="買進" data-price="${row.put?.price || 0}">${formatPrice(row.put?.price || '買')}</button>
                    <button class="chain-btn cell-btn sell" data-strike="${row.strike}" data-type="Put" data-direction="賣出" data-price="${row.put?.price || 0}">${formatPrice(row.put?.price || '賣')}</button>
                </div>
            </div>
        `;
    }).join('');

    html += '</div>';

    elements.strikePickerGrid.innerHTML = html;
    elements.strikePickerGrid.className = 'option-chain-container';

    // 綁定事件
    elements.strikePickerGrid.querySelectorAll('.chain-btn').forEach(btn => {
        btn.addEventListener('click', handleStrikePickerClick);
    });
}

/**
 * 產生本機模擬鏈 (降級用)
 */
function generateMockChain(center, range, withPrice) {
    const chain = [];
    for (let i = -range; i <= range; i++) {
        const strike = center + (i * 100);
        chain.push({
            strike: strike,
            call: { price: withPrice ? 100 : 0 },
            put: { price: withPrice ? 100 : 0 }
        });
    }
    return chain;
}

/**
 * 處理履約價點選器點擊
 */
function handleStrikePickerClick(e) {
    const strike = parseInt(e.target.dataset.strike);
    const type = e.target.dataset.type;
    const direction = e.target.dataset.direction;
    const price = parseFloat(e.target.dataset.price); // 取得價格

    // 填入表單
    elements.optType.value = type;
    elements.optStrike.value = strike;

    // 設定買賣方向
    if (direction) {
        const radio = document.querySelector(`input[name="opt-direction"][value="${direction}"]`);
        if (radio) radio.checked = true;
    }

    // 自動填入價格 (如果有抓到的話)
    if (price && price > 0 && elements.optPremium) {
        elements.optPremium.value = price;

        // 觸發價格填入動畫
        elements.optPremium.classList.remove('price-filled');
        void elements.optPremium.offsetWidth; // 強制重繪以重新觸發動畫
        elements.optPremium.classList.add('price-filled');
    }

    // 捲動到表單並聚焦 (如果沒有價格，聚焦在價格欄位讓使用者輸入；有價格則聚焦確認或口數)
    if (price && price > 0) {
        elements.optLots?.focus();
        showToast('success', `已選擇 ${type} ${strike} @ ${price}`);
    } else {
        elements.optPremium?.focus();
        showToast('info', `已選擇 ${type} ${strike}，請輸入權利金`);
    }
}

/**
 * 更新倉位列表（雙欄顯示 A/B 策略）
 */
/**
 * 渲染單一策略的倉位列表
 * @param {string} strategy - 策略標識 ('A', 'B', 'C')
 */
function renderPositionsList(strategy) {
    const listElement = elements[`positionsList${strategy}`];
    const countElement = elements[`count${strategy}`];

    if (!listElement || !countElement) return;

    // 清空列表
    listElement.innerHTML = '';

    // 渲染倉位
    const positions = state.strategies[strategy] || [];
    positions.forEach((pos, index) => {
        const item = createPositionItem(pos, index, strategy);
        listElement.appendChild(item);
    });

    // 更新計數
    countElement.textContent = `${positions.length} 筆`;

    // 控制整體區塊顯示 (如果有任一策略有倉位就顯示)
    const hasAnyPosition = Object.values(state.strategies).some(s => s.length > 0);
    if (elements.positionsSection) {
        elements.positionsSection.style.display = hasAnyPosition ? 'block' : 'none';
    }
}

/**
 * 建立倉位項目 HTML
 * @param {string} strategy - 策略標識 ('A' 或 'B')
 */
function createPositionItem(pos, index, strategy = 'A') {
    const div = document.createElement('div');
    div.className = 'position-item';
    if (pos.isClosed) {
        div.classList.add('closed');
    }

    // 處理群組樣式
    if (pos.groupId) {
        div.classList.add(`group-color-${pos.groupId % 5}`); // 循環使用 5 種群組顏色
        div.dataset.groupId = pos.groupId;
    }

    const isFutures = pos.product === '微台期貨' || pos.type === 'Futures';
    const isSelected = state.selectedPositions.has(`${strategy}-${index}`);

    let tagsHTML = '';
    let detailsHTML = '';

    // 群組標記
    const groupBadge = pos.groupId ? `<span class="group-badge">#${pos.groupId}</span>` : '';

    // 0 口數時半透明顯示
    if (pos.lots === 0) {
        div.style.opacity = '0.5';
    }

    // 1. Badge Logic (Merged)
    let badgeHTML = '';
    if (isFutures) {
        // Futures: Always Sell for this app? Or depends on logic. 
        // Logic says: `pos.product === '微台期貨'` or Type=Futures. Hardcoded `tag-sell` "做空" in original.
        // Let's stick to original text but unified badge style.
        badgeHTML = `<span class="pos-badge badge-sell">微台·空</span>`;
    } else {
        const isBuy = pos.direction === '買進';
        const isCall = pos.type === 'Call';
        const actionText = isBuy ? '買' : '賣';
        const typeText = isCall ? 'Call' : 'Put'; // Or 買權/賣權 if space permits. User suggested "賣·Call"
        const badgeClass = isBuy ? 'badge-buy' : 'badge-sell';

        // Ex: "買·Call" or "賣·Put"
        badgeHTML = `<span class="pos-badge ${badgeClass}">${actionText}·${typeText}</span>`;
    }

    // 2. Details (Strike, Stepper, Price)
    // Structure: [Strike] [Stepper] [Price]
    if (isFutures) {
        detailsHTML = `
            <span class="pos-strike">進場 ${pos.strike.toLocaleString()}</span>
            <div class="pos-stepper">
                <button class="lots-btn lots-minus" data-index="${index}" data-strategy="${strategy}" ${pos.isClosed ? 'disabled' : ''}>−</button>
                <span class="lots-value">${pos.lots}</span>
                <button class="lots-btn lots-plus" data-index="${index}" data-strategy="${strategy}" ${pos.isClosed ? 'disabled' : ''}>+</button>
            </div>
        `;
    } else {
        detailsHTML = `
            <span class="pos-strike">${pos.strike.toLocaleString()}</span>
            <div class="pos-stepper">
                <button class="lots-btn lots-minus" data-index="${index}" data-strategy="${strategy}" ${pos.isClosed ? 'disabled' : ''}>−</button>
                <span class="lots-value">${pos.lots}</span>
                <button class="lots-btn lots-plus" data-index="${index}" data-strategy="${strategy}" ${pos.isClosed ? 'disabled' : ''}>+</button>
            </div>
            <span class="pos-price">${pos.premium}</span>
        `;
    }

    div.innerHTML = `
        <div class="position-row-content">
            <div class="pos-col-check">
                <input type="checkbox" class="pos-select-check" data-index="${index}" data-strategy="${strategy}" ${isSelected ? 'checked' : ''}>
            </div>
            
            <div class="pos-col-badge">
                ${badgeHTML}
            </div>

            <div class="pos-col-main">
                ${detailsHTML}
            </div>
            
            <div class="pos-col-delete">
                 <button class="icon-btn delete" data-action="delete" data-index="${index}" data-strategy="${strategy}" title="刪除">✕</button>
            </div>
        </div>
    `;

    // 綁定選取框事件
    div.querySelector('.pos-select-check').addEventListener('change', handlePositionSelect);

    // 綁定刪除按鈕事件
    div.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', handlePositionAction);
    });

    // 綁定口數調整按鈕事件
    div.querySelectorAll('.lots-btn').forEach(btn => {
        btn.addEventListener('click', handleLotsStepper);
    });

    return div;
}

/**
 * 處理平倉狀態切換
 */
function handlePositionCloseToggle(e) {
    const index = parseInt(e.target.dataset.index);
    const strategy = e.target.dataset.strategy;
    const isChecked = e.target.checked;

    const positions = state.strategies[strategy];
    if (positions && positions[index]) {
        positions[index].isClosed = isChecked;
        if (isChecked && positions[index].closePrice === undefined) {
            // 預設平倉價為成本價 (方便修改)
            positions[index].closePrice = isFutures(positions[index]) ? positions[index].strike : positions[index].premium;
        }

        saveData(); // 儲存變更
        updateUI();
    }
}

/**
 * 處理平倉價格輸入
 */
// 防抖動 UI 更新 (避免輸入時焦點跳掉)
let updateUITimeout;
function debounceUpdateUI() {
    clearTimeout(updateUITimeout);
    updateUITimeout = setTimeout(() => {
        updateUI();
    }, 1500);
}

/**
 * 處理平倉價格輸入
 */
function handlePositionClosePrice(e) {
    const index = parseInt(e.target.dataset.index);
    const strategy = e.target.dataset.strategy;
    const value = e.target.value; // Keep as string first
    const price = parseFloat(value);

    const positions = state.strategies[strategy];
    if (positions && positions[index]) {
        positions[index].closePrice = price; // Save internal numeric value

        // 1. 即時更新該卡片的損益顯示 (不重繪整個列表)
        const closeInfo = e.target.closest('.close-info');
        if (closeInfo) {
            const pnlElement = closeInfo.querySelector('.realized-pnl');
            if (pnlElement && !isNaN(price)) {
                // 使用 Calculator 類別計算 (需確保 scope 正確)
                const realizedPnL = Calculator.calcRealizedPnL(positions[index], price);
                const pnlSign = realizedPnL >= 0 ? '+' : '';
                pnlElement.textContent = `${pnlSign}${realizedPnL.toLocaleString()}`;
                pnlElement.className = `realized-pnl ${realizedPnL >= 0 ? 'profit' : 'loss'}`;
            }
        }

        // 2. 延遲更新整體 UI (總計等)
        debounceUpdateUI();
        saveDataDebounced();
    }
}

function isFutures(pos) {
    return pos.product === '微台期貨' || pos.type === 'Futures';
}

// 防抖動儲存
let saveTimeout;
function saveDataDebounced() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveData, 1000);
}

/**
 * 更新權利金收支摘要（雙欄）
 */
function updatePremiumSummary() {
    // 策略 A
    const summaryA = Calculator.calculatePremiumSummary(state.strategies.A);
    elements.premiumInA.textContent = `+${summaryA.premiumIn.toLocaleString()}`;
    elements.premiumOutA.textContent = `-${summaryA.premiumOut.toLocaleString()}`;
    elements.premiumNetA.textContent = `${summaryA.netPremium >= 0 ? '+' : ''}${summaryA.netPremium.toLocaleString()} 元`;
    elements.premiumNetA.className = summaryA.netPremium >= 0 ? 'profit' : 'loss';

    // 策略 B
    const summaryB = Calculator.calculatePremiumSummary(state.strategies.B);
    elements.premiumInB.textContent = `+${summaryB.premiumIn.toLocaleString()}`;
    elements.premiumOutB.textContent = `-${summaryB.premiumOut.toLocaleString()}`;
    elements.premiumNetB.textContent = `${summaryB.netPremium >= 0 ? '+' : ''}${summaryB.netPremium.toLocaleString()} 元`;
    elements.premiumNetB.className = summaryB.netPremium >= 0 ? 'profit' : 'loss';

    // 策略 C
    const summaryC = Calculator.calculatePremiumSummary(state.strategies.C || []);
    elements.premiumInC.textContent = `+${summaryC.premiumIn.toLocaleString()}`;
    elements.premiumOutC.textContent = `-${summaryC.premiumOut.toLocaleString()}`;
    elements.premiumNetC.textContent = `${summaryC.netPremium >= 0 ? '+' : ''}${summaryC.netPremium.toLocaleString()} 元`;
    elements.premiumNetC.className = summaryC.netPremium >= 0 ? 'profit' : 'loss';
}

/**
 * 更新損益試算表（完整版）
 */
function updatePnLTable() {
    // 計算策略 A
    const resultA = Calculator.calculatePnLCurve({
        centerPrice: state.referenceIndex, // Center grid on Reference Index
        referenceIndex: state.tseIndex,    // Base math on Current Index (for ETF projection)
        priceRange: state.priceRange,
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice,
        positions: state.strategies.A
    });

    // 計算策略 B
    const resultB = Calculator.calculatePnLCurve({
        centerPrice: state.referenceIndex,
        referenceIndex: state.tseIndex,
        priceRange: state.priceRange,
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice,
        positions: state.strategies.B
    });
    // 計算策略 C
    const resultC = Calculator.calculatePnLCurve({
        centerPrice: state.referenceIndex,
        referenceIndex: state.tseIndex,
        priceRange: state.priceRange,
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice,
        positions: state.strategies.C || []
    });

    elements.pnlTableBody.innerHTML = '';

    const { prices, etfProfits, optionProfits: optProfitsA } = resultA;
    const { optionProfits: optProfitsB } = resultB;
    const { optionProfits: optProfitsC } = resultC;
    const accountPnL = getAccountPnL();

    // 取得各策略已實現損益
    const realizedA = state.realizedPnL.A || 0;
    const realizedB = state.realizedPnL.B || 0;
    const realizedC = state.realizedPnL.C || 0;

    const formatPnL = (val) => {
        const cls = val >= 0 ? 'profit' : 'loss';
        const sign = val >= 0 ? '+' : '';
        return `<span class="${cls}">${sign}${val.toLocaleString()}</span>`;
    };

    // 計算 ETF 在基準指數時的損益 (作為變化的基準點 0)
    const pnlAtRef = Calculator.calcETFPnL(
        state.referenceIndex,
        state.tseIndex,
        state.etfLots,
        state.etfCost,
        state.etfCurrentPrice
    );

    for (let i = 0; i < prices.length; i++) {
        const row = document.createElement('tr');

        // 策略 A/B/C = 選擇權損益 + 已實現損益
        const pnlA = Math.round(optProfitsA[i]) + realizedA;
        const pnlB = Math.round(optProfitsB[i]) + realizedB;
        const pnlC = Math.round(optProfitsC[i]) + realizedC;
        const etfPnL = Math.round(etfProfits[i]);
        // 總損益 = ETF損益 + 策略損益(含已實現) + 帳戶損益
        const totalPnLA = etfPnL + pnlA + accountPnL;
        const totalPnLB = etfPnL + pnlB + accountPnL;
        const totalPnLC = etfPnL + pnlC + accountPnL;

        // Change relative to Reference Index (Base Point)
        const change = prices[i] - state.referenceIndex;

        // 計算 ETF 損益變化：相對於基準指數的損益變動
        // 這樣在 基準指數 (Reference Index) 位置時，變化量會是 0
        const etfDeltaVal = etfPnL - pnlAtRef;
        const etfDelta = formatPnL(Math.round(etfDeltaVal));


        // 高亮現價區域（最接近當前指數的列）
        if (Math.abs(prices[i] - state.tseIndex) < 50) {
            row.classList.add('current-price-row');
        }

        const changeStr = change >= 0 ? `+${change.toLocaleString()}` : change.toLocaleString();

        // 加權指數，以 100 點四捨五入
        const indexValue = Math.round(prices[i] / 100) * 100;
        const indexStr = indexValue.toLocaleString();

        // 判斷是否為基準指數所在列
        let indexDisplay = indexStr;
        if (Math.abs(indexValue - state.referenceIndex) < 50) {
            indexDisplay = `<span class="reference-badge" title="基準指數">🎯 ${indexStr}</span>`;
            row.classList.add('reference-price-row');
        }

        row.innerHTML = `
            <td>${changeStr}</td>
            <td class="col-index">${indexDisplay}</td>
            <td class="col-strategy-a">${formatPnL(pnlA)}</td>
            <td class="col-strategy-b">${formatPnL(pnlB)}</td>
            <td class="col-strategy-c">${formatPnL(pnlC)}</td>
            <td>${formatPnL(etfPnL)}</td>
            <td class="col-etf-delta">${etfDelta}</td>
            <td>${formatPnL(accountPnL)}</td>
            <td class="col-total-a"><strong>${formatPnL(totalPnLA)}</strong></td>
            <td class="col-total-b"><strong>${formatPnL(totalPnLB)}</strong></td>
            <td class="col-total-c"><strong>${formatPnL(totalPnLC)}</strong></td>
        `;

        elements.pnlTableBody.appendChild(row);
    }
}

/**
 * 更新圖表
 */
/**
 * 更新圖表
 */
function updateChart() {
    // 計算策略 A
    const resultA = Calculator.calculatePnLCurve({
        centerPrice: state.referenceIndex,
        referenceIndex: state.tseIndex,
        priceRange: state.priceRange,
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice,
        positions: state.strategies.A
    });

    // 計算策略 B
    let resultB = null;
    if (state.strategies.B.length > 0) {
        resultB = Calculator.calculatePnLCurve({
            centerPrice: state.referenceIndex,
            referenceIndex: state.tseIndex,
            priceRange: state.priceRange,
            etfLots: state.etfLots,
            etfCost: state.etfCost,
            etfCurrent: state.etfCurrentPrice,
            positions: state.strategies.B
        });
    }

    // 計算策略 C
    let resultC = null;
    if (state.strategies.C && state.strategies.C.length > 0) {
        resultC = Calculator.calculatePnLCurve({
            centerPrice: state.referenceIndex,
            referenceIndex: state.tseIndex,
            priceRange: state.priceRange,
            etfLots: state.etfLots,
            etfCost: state.etfCost,
            etfCurrent: state.etfCurrentPrice,
            positions: state.strategies.C
        });
    }

    ChartModule.updatePnLChart(
        resultA,
        state.tseIndex,
        true,
        state.strategies.A.length > 0,
        resultB,
        resultC
    );

    // 更新圖表說明 (Legend)
    const legendEl = document.querySelector('.chart-legend');
    if (legendEl) {
        if (resultB || resultC) {
            // 比較模式：只顯示策略 A/B/C
            legendEl.innerHTML = `
                📊 <b>圖例說明：</b>
                <span class="legend-item" style="color:#ef4444">🔴 策略 A</span> |
                ${resultB ? '<span class="legend-item" style="color:#3b82f6">🔵 策略 B</span> |' : ''}
                ${resultC ? '<span class="legend-item" style="color:#69f0ae">🟢 策略 C</span> |' : ''}
                <span class="legend-item" style="color:#94a3b8">📉 00631L</span> |
                <span class="legend-item legend-current">Current</span> = 現價
            `;
        } else {
            // 單一模式：顯示詳細說明
            legendEl.innerHTML = `
                📊 <b>圖例說明：</b>
                <span class="legend-item legend-etf">00631L</span> = ETF損益 |
                <span class="legend-item legend-option">Options</span> = 選擇權組合 |
                <span class="legend-item legend-total">Total P/L</span> = 組合總損益 |
                <span class="legend-item legend-current">Current</span> = 現價
            `;
        }
    }

    // 控制空狀態顯示
    const chartEmptyState = document.getElementById('chart-empty-state');
    const hasAnyPosition = Object.values(state.strategies).some(s => s && s.length > 0);
    if (chartEmptyState) {
        chartEmptyState.classList.toggle('visible', !hasAnyPosition);
    }

    updatePnLTable();
}

/**
 * 更新損益敏感度分析
 */
function updateSensitivityAnalysis() {
    const { tseIndex, etfLots, etfCost, etfCurrentPrice, strategies, referenceIndex } = state;
    const { senElements } = state;
    if (!senElements.indexCurrent) return; // Safety check

    const range = 100;
    const indexDown = tseIndex - range;
    const indexUp = tseIndex + range;

    // Helper to format PnL
    const fmt = (val, isDiff = false) => {
        const sign = val > 0 ? '+' : (val < 0 ? '' : ''); // Negative numbers have '-' automatically
        const cls = val > 0 ? 'profit' : (val < 0 ? 'loss' : '');
        // For diffs, usually explicit + is good. For absolute, maybe distinct.
        // Let's use standard signed format.
        const prefix = (isDiff && val > 0) ? '+' : '';
        return `<span class="${cls}">${prefix}${val.toLocaleString()}</span>`;
    };

    // Calculate ETF PnL
    // Note: We use referenceIndex regarding the "Base Point" logic if we want "Accumulated PnL".
    // But "Sensitivity" usually asks "What if price moves NOW?".
    // However, our calculator uses `baseIndex` (Reference Index) to determine entry point.
    // So `calcETFPnL(targetPrice, baseIndex, ...)` gives the absolute PnL at that price relative to entry.
    // The "Change" is `PnL_at_Target - PnL_at_Current`.

    // 1. Absolute PnL at each point (Relative to Entry/Reference)
    const getEtfPnL = (idx) => Calculator.calcETFPnL(idx, referenceIndex, etfLots, etfCost, etfCurrentPrice);

    const etfPnL_Current = getEtfPnL(tseIndex);
    const etfPnL_Down = getEtfPnL(indexDown);
    const etfPnL_Up = getEtfPnL(indexUp);

    // 2. Strategy PnL at each point
    // We need to sum up all active strategies (A+B+C) or just the active ones?
    // Usually "Strategy PnL" means the Option Overlay.
    // Let's sum all active strategies to show total portfolio sensitivity.
    const allPositions = [
        ...(strategies.A || []),
        ...(strategies.B || []),
        ...(strategies.C || [])
    ];

    const getStratPnL = (idx) => {
        let total = 0;
        allPositions.forEach(pos => {
            total += Calculator.calcPositionPnL(pos, idx);
        });
        return total;
    };

    const stratPnL_Current = getStratPnL(tseIndex);
    const stratPnL_Down = getStratPnL(indexDown);
    const stratPnL_Up = getStratPnL(indexUp);

    // 3. Render Indices
    senElements.indexDown.textContent = indexDown.toLocaleString();
    senElements.indexCurrent.textContent = tseIndex.toLocaleString();
    senElements.indexUp.textContent = indexUp.toLocaleString();

    // 4. Render Values
    // Current: Show Absolute PnL (Accumulated)
    // Up/Down: Show CHANGE (Delta) relative to Current

    // ETF
    senElements.etfCurrent.innerHTML = fmt(Math.round(etfPnL_Current));
    senElements.etfDown.innerHTML = fmt(Math.round(etfPnL_Down - etfPnL_Current), true);
    senElements.etfUp.innerHTML = fmt(Math.round(etfPnL_Up - etfPnL_Current), true);

    // Strategy
    senElements.stratCurrent.innerHTML = fmt(Math.round(stratPnL_Current));
    senElements.stratDown.innerHTML = fmt(Math.round(stratPnL_Down - stratPnL_Current), true);
    senElements.stratUp.innerHTML = fmt(Math.round(stratPnL_Up - stratPnL_Current), true);
}

/**
 * 更新時間顯示
 */
function updateTime() {
    const now = new Date();
    elements.updateTime.textContent = now.toLocaleString('zh-TW');
}

// ======== 事件處理器 ========

function toggleSidebar() {
    const isOpen = elements.sidebar.classList.toggle('open');
    // Also toggle overlay and button state for mobile
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        overlay.classList.toggle('active', isOpen);
    }
    if (elements.sidebarToggle) {
        elements.sidebarToggle.classList.toggle('sidebar-open', isOpen);
    }
}

function handleSettingsChange() {
    state.etfLots = parseFloat(elements.etfLotsInput.value) || 0;
    state.etfCost = parseFloat(elements.etfCostInput.value) || 0;
    state.etfCurrentPrice = parseFloat(elements.etfCurrentInput.value) || 0;
    state.hedgeRatio = parseFloat(elements.hedgeRatioInput.value) || 0;
    state.accountCost = parseFloat(elements.accountCostInput?.value) || 0;
    state.accountBalance = parseFloat(elements.accountBalanceInput?.value) || 0;
    state.priceRange = parseInt(elements.priceRangeInput.value) || 1500;
    // 同步基準指數輸入到 state，確保會被儲存
    if (elements.referenceIndexInput) {
        const refVal = parseInt(elements.referenceIndexInput.value);
        state.referenceIndex = Number.isNaN(refVal) ? state.tseIndex : refVal;
    }

    // 更新帳戶損益顯示
    updateAccountPnLDisplay();

    updateUI();
    updateChart();
    autoSave();
}

/**
 * 處理已實現損益輸入變更
 */
function handleRealizedPnLChange() {
    state.realizedPnL.A = parseFloat(elements.realizedPnLA?.value) || 0;
    state.realizedPnL.B = parseFloat(elements.realizedPnLB?.value) || 0;
    state.realizedPnL.C = parseFloat(elements.realizedPnLC?.value) || 0;

    updateChart(); // 重新計算並更新表格
    autoSave();
}

function handleProductTabClick(e) {
    const product = e.target.dataset.product;

    elements.productTabs.forEach(tab => tab.classList.remove('active'));
    e.target.classList.add('active');

    if (product.toLowerCase() === 'option') {
        elements.optionForm.style.display = 'block';
        elements.futuresForm.style.display = 'none';
    } else {
        elements.optionForm.style.display = 'none';
        elements.futuresForm.style.display = 'block';
    }
}

function handleAddOption() {
    const direction = document.querySelector('input[name="opt-direction"]:checked').value;

    const newPosition = {
        product: '台指',
        type: elements.optType.value,
        direction: direction,
        strike: parseFloat(elements.optStrike.value) || 0,
        lots: parseInt(elements.optLots.value) || 1,
        premium: parseFloat(elements.optPremium.value) || 0
    };

    // 新增到當前選擇的策略
    state.strategies[state.currentStrategy].push(newPosition);
    updateUI();
    updateChart();
    autoSave();
    showToast('success', `已新增到策略 ${state.currentStrategy}`);
}

function handleAddFutures() {
    const newPosition = {
        product: '微台期貨',
        type: 'Futures',
        direction: '做空',
        strike: parseFloat(elements.futuresStrike.value) || 0,
        lots: parseInt(elements.futuresLots.value) || 1,
        premium: 0
    };

    // 新增到當前選擇的策略
    state.strategies[state.currentStrategy].push(newPosition);
    updateUI();
    updateChart();
    autoSave();
    showToast('success', `已新增到策略 ${state.currentStrategy}`);
}

function handlePositionAction(e) {
    const action = e.currentTarget.dataset.action;
    const index = parseInt(e.currentTarget.dataset.index);
    const strategy = e.currentTarget.dataset.strategy || 'A';
    const positions = state.strategies[strategy];

    if (action === 'delete' && positions[index]) {
        positions.splice(index, 1);
    }

    updateUI();
    updateChart();
    autoSave();
}

/**
 * 處理口數調整按鈕點擊
 */
function handleLotsStepper(e) {
    const index = parseInt(e.target.dataset.index);
    const strategy = e.target.dataset.strategy || 'A';
    const isPlus = e.target.classList.contains('lots-plus');

    if (state.strategies[strategy][index]) {
        const currentLots = state.strategies[strategy][index].lots;
        const newLots = isPlus ? currentLots + 1 : currentLots - 1;

        if (newLots >= 0 && newLots <= 999) {
            state.strategies[strategy][index].lots = newLots;
            updateUI();
            updateChart();
            autoSave();
        }
    }
}

/**
 * 處理倉位選取勾選
 */
function handlePositionSelect(e) {
    const index = e.target.dataset.index;
    const strategy = e.target.dataset.strategy;
    const key = `${strategy}-${index}`;

    if (e.target.checked) {
        state.selectedPositions.add(key);
    } else {
        state.selectedPositions.delete(key);
    }

    // 更新群組按鈕狀態 (如果有的話)
    updateGroupButtonState();
}

/**
 * 處理建立群組
 */
function handleGroupPositions() {
    if (state.selectedPositions.size < 2) {
        showToast('warning', '請至少選擇 2 筆倉位建立群組');
        return;
    }

    const groupId = state.nextGroupId++;

    state.selectedPositions.forEach(key => {
        const [strat, idx] = key.split('-');
        if (state.strategies[strat] && state.strategies[strat][idx]) {
            state.strategies[strat][idx].groupId = groupId;
        }
    });

    state.selectedPositions.clear();
    updateUI();
    autoSave();
    showToast('success', `已建立群組 #${groupId}`);
}

/**
 * 更新群組按鈕狀態
 */
function updateGroupButtonState() {
    const btnGroup = document.getElementById('btn-group-positions');
    if (btnGroup) {
        btnGroup.disabled = state.selectedPositions.size < 2;
        btnGroup.innerHTML = state.selectedPositions.size >= 2
            ? `🔗 建立群組 (${state.selectedPositions.size})`
            : `🔗 建立群組`;
    }
}

async function handleReload() {
    try {
        const savedData = await FirebaseModule.loadData();
        if (savedData) {
            Object.assign(state, savedData);
            updateUI();
            updateChart();
            showToast('success', '資料已重新載入');
        }
    } catch (error) {
        showToast('error', '載入失敗: ' + error.message);
    }
}

async function handleSave() {
    try {
        const success = await FirebaseModule.saveData({
            etfLots: state.etfLots,
            etfCost: state.etfCost,
            etfCurrentPrice: state.etfCurrentPrice,
            hedgeRatio: state.hedgeRatio,
            accountCost: state.accountCost,
            accountBalance: state.accountBalance,
            currentStrategy: state.currentStrategy,
            optionPositions: state.strategies.A,
            strategyB: { positions: state.strategies.B }
        });

        if (success) {
            updateSaveStatus(true);
            showToast('success', '資料已同步到雲端');
        } else {
            updateSaveStatus(false, '📂 僅儲存於本地');
            showToast('warning', '已儲存於本地 (雲端同步失敗)');
        }
    } catch (error) {
        updateSaveStatus(false, '❌ 儲存失敗');
        showToast('error', '儲存失敗: ' + error.message);
    }
}

async function handleClear() {
    if (!confirm('確定要清空所有資料嗎？')) return;

    state.etfLots = 0;
    state.etfCost = 100;
    state.hedgeRatio = 0.2;
    state.strategies.A = [];
    state.strategies.B = [];
    state.strategies.C = [];
    await FirebaseModule.clearData();
    updateUI();
    updateChart();
    showToast('success', '已清空所有資料');
}

// handleComparisonTabClick 已移除（舊版獨立比較區塊，改用 handleStrategySwitch）

// ======== 策略控制函數 ========

/**
 * 切換新增倉位的目標策略
 */
function handleAddToStrategyClick(strategy) {
    state.currentStrategy = strategy;

    // 更新按鈕樣式
    elements.btnAddToA?.classList.toggle('active', strategy === 'A');
    elements.btnAddToB?.classList.toggle('active', strategy === 'B');

    showToast('info', `新增倉位將加入策略 ${strategy}`);
}

/**
 * 當來源改變時，更新目標選項（避免選擇相同）
 */
function handleCopySourceChange() {
    const source = elements.copySource.value;
    const targetSelect = elements.copyTarget;

    // 遍歷所有選項
    Array.from(targetSelect.options).forEach(option => {
        if (option.value === source) {
            option.disabled = true;
            if (targetSelect.value === source) {
                // 如果當前選中的被禁用，切換到另一個可用選項
                const available = Array.from(targetSelect.options).find(opt => opt.value !== source);
                if (available) targetSelect.value = available.value;
            }
        } else {
            option.disabled = false;
        }
    });
}

/**
 * 確認複製策略
 */
function handleConfirmCopy() {
    const source = elements.copySource.value;
    const target = elements.copyTarget.value;

    if (source === target) {
        showToast('error', '來源與目標不能相同');
        return;
    }

    if (!confirm(`確定要將 策略 ${source} 複製到 策略 ${target} 嗎？\n目標策略原本的倉位將由來源策略覆蓋！`)) {
        return;
    }

    // 執行深拷貝複製
    state.strategies[target] = JSON.parse(JSON.stringify(state.strategies[source]));

    // 更新介面
    updateUI();
    updateChart();
    autoSave();

    showToast('success', `已成功將 策略 ${source} 複製到 策略 ${target}`);
}

/**
 * 清空當前策略
 */
function handleClearStrategy() {
    const current = state.currentStrategy;
    if (!confirm(`確定要清空策略 ${current} 的所有倉位嗎？`)) return;

    state.strategies[current] = [];
    updateUI();
    updateChart();
    autoSave();
    showToast('success', `已清空策略 ${current}`);
}

/**
 * 取得選擇權報價
 */
async function handleGetOptionPrice() {
    const strike = parseFloat(elements.optStrike.value);
    const type = elements.optType.value;

    if (!strike) {
        showToast('warning', '請先輸入履約價');
        elements.optStrike.focus();
        return;
    }

    // UI Loading 狀態
    if (elements.btnGetPrice) elements.btnGetPrice.disabled = true;
    if (elements.priceLoading) elements.priceLoading.style.display = 'inline';

    try {
        // 呼叫後端 API (預設使用與前端同源的 API)
        const apiUrl = `http://localhost:5000/api/option-price?strike=${strike}&type=${type}`;

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();

        if (data.price) {
            elements.optPremium.value = data.price;

            // 顯示來源提示
            const sourceText = data.source === 'fubon' ? '富邦真實行情' : '模擬行情';
            showToast('success', `已更新報價: ${data.price} (${sourceText})`);
        } else {
            showToast('warning', '查無報價');
        }

    } catch (error) {
        console.error('取得報價失敗:', error);
        showToast('error', '取得報價失敗，請確認 API 服務已啟動');
    } finally {
        // 解除 Loading 狀態
        if (elements.btnGetPrice) elements.btnGetPrice.disabled = false;
        if (elements.priceLoading) elements.priceLoading.style.display = 'none';
    }
}

function handleCompare() {
    if (state.strategyB.positions.length === 0) {
        showToast('error', '請先設定策略 B');
        return;
    }

    const result = Calculator.compareStrategies(
        { positions: state.optionPositions },
        state.strategyB,
        {
            centerPrice: state.tseIndex,
            priceRange: state.priceRange,
            etfLots: state.etfLots,
            etfCost: state.etfCost,
            etfCurrent: state.etfCurrentPrice
        }
    );

    // 顯示比較結果（可以擴展為模態框或新區塊）
    console.log('策略比較結果:', result);
    showToast('success', '策略比較完成，請查看控制台');
}



/**
 * 自動儲存（防抖）
 */
// let saveTimeout = null; // Removed duplicate
function autoSave() {
    updateSaveStatus(false, '儲存中...');

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            const success = await FirebaseModule.saveData({
                etfLots: state.etfLots,
                etfCost: state.etfCost,
                etfCurrentPrice: state.etfCurrentPrice,
                hedgeRatio: state.hedgeRatio,
                accountCost: state.accountCost,
                accountBalance: state.accountBalance,
                currentStrategy: state.currentStrategy,
                optionPositions: state.strategies.A,
                strategyB: { positions: state.strategies.B },
                strategyC: { positions: state.strategies.C },
                realizedPnL: state.realizedPnL,
                // Persist reference index and tseIndex so user's input survives reload
                referenceIndex: state.referenceIndex,
                tseIndex: state.tseIndex,
                priceRange: state.priceRange
            });

            if (success) {
                updateSaveStatus(true);
                // showToast('success', '資料已自動儲存'); // Optional: prevent spamming toasts
            } else {
                updateSaveStatus(false, '📂 僅儲存於本地');
            }
        } catch (error) {
            updateSaveStatus(false, '❌ 儲存失敗');
        }
    }, 1000);
}

/**
 * 更新儲存狀態顯示
 */
function updateSaveStatus(isSynced, customText = null) {
    const statusEl = document.getElementById('save-status');
    if (!statusEl) return;

    if (customText) {
        statusEl.textContent = customText;
        return;
    }

    if (isSynced) {
        statusEl.textContent = '☁️ 已同步';
        statusEl.style.color = '#4caf50'; // Green
    } else {
        statusEl.textContent = '📂 僅儲存於本地';
        statusEl.style.color = '#ff9800'; // Orange
    }
}

/**
 * 顯示 Toast 通知
 */
function showToast(type, message) {
    const toast = elements.toast;
    const icon = toast.querySelector('.toast-icon');
    const msg = toast.querySelector('.toast-message');

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };

    toast.className = 'toast ' + type;
    icon.textContent = icons[type] || icons.info;
    msg.textContent = message;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ======== AI 庫存解析 ========

// 暫存解析結果
let parsedInventory = {
    etf: null,
    options: []
};

// ======== AI Strategy Analysis ========

/**
 * 綁定 AI 相關事件
 */
function bindAIEvents() {
    elements.btnAIAnalysis = document.getElementById('btn-ai-analysis');
    elements.aiResultCard = document.getElementById('ai-result-card');
    elements.aiResultContent = document.getElementById('ai-result-content');
    elements.aiLoading = document.getElementById('ai-loading');
    elements.btnCloseAI = document.getElementById('btn-close-ai');
    elements.aiApiKeyInput = document.getElementById('ai-api-key');

    // 載入儲存的 API Key
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey && elements.aiApiKeyInput) {
        elements.aiApiKeyInput.value = savedKey;
        state.apiKey = savedKey;
    }

    elements.aiApiKeyInput?.addEventListener('change', (e) => {
        state.apiKey = e.target.value.trim();
        localStorage.setItem('gemini_api_key', state.apiKey);
    });

    elements.btnAIAnalysis?.addEventListener('click', handleAIAnalysis);
    elements.btnCloseAI?.addEventListener('click', () => {
        elements.aiResultCard.style.display = 'none';
    });
}

/**
 * 處理 AI 分析請求
 */
async function handleAIAnalysis() {
    if (!state.apiKey) {
        showToast('error', '請先在側邊欄設定 Google Gemini API Key');
        // 自動打開側邊欄並聚焦
        if (window.innerWidth <= 768) elements.sidebar.classList.add('active');
        elements.aiApiKeyInput?.focus();
        return;
    }

    // 顯示載入動畫
    elements.aiLoading.style.display = 'block';
    elements.btnAIAnalysis.disabled = true;
    elements.aiResultCard.style.display = 'none';

    try {
        const prompt = generateAnalysisPrompt();
        const response = await callGeminiAPI(prompt, state.apiKey);

        // 渲染結果
        elements.aiResultContent.innerHTML = renderMarkdown(response);
        elements.aiResultCard.style.display = 'block';

        // 捲動到結果
        elements.aiResultCard.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('AI Analysis Error:', error);
        showToast('error', 'AI 分析失敗: ' + error.message);
    } finally {
        elements.aiLoading.style.display = 'none';
        elements.btnAIAnalysis.disabled = false;
    }
}

/**
 * 呼叫 Google Gemini API
 */
async function callGeminiAPI(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

/**
 * 產生分析用的提示詞 (Prompt)
 */
function generateAnalysisPrompt() {
    const currentStrategy = state.strategies[state.currentStrategy];

    // 整理倉位資訊
    const positionsText = currentStrategy.map(pos => {
        const type = pos.product === '微台期貨' || pos.type === 'Futures' ? '期貨' : `選擇權 ${pos.type}`;
        return `- ${type} ${pos.direction} ${pos.strike} @ ${pos.premium || 0} (${pos.lots}口)`;
    }).join('\n');

    // 取得損益分析數據
    const summary = Calculator.calculatePnLCurve({
        centerPrice: state.tseIndex,
        priceRange: state.priceRange,
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice,
        positions: currentStrategy
    });

    // 簡單找出最大虧損點和最大獲利點
    const maxProfit = Math.max(...summary.combinedProfits);
    const maxLoss = Math.min(...summary.combinedProfits);
    const currentPnL = summary.combinedProfits[Math.floor(summary.combinedProfits.length / 2)];

    return `
你是一位專業的選擇權避險策略顧問。請針對以下投資組合進行風險評估與建議。請用繁體中文回答。

**市場狀況**
- 加權指數: ${state.tseIndex}
- 00631L 現價: ${state.etfCurrentPrice}

**持有資產**
- 00631L (2倍槓桿ETF): ${state.etfLots} 張 (成本 ${state.etfCost})

**選擇權/期貨避險倉位 (策略 ${state.currentStrategy})**
${positionsText || '(無倉位)'}

**損益模擬數據**
- 目前預估損益: ${Math.round(currentPnL)} 元
- 模擬區間最大獲利: ${Math.round(maxProfit)} 元
- 模擬區間最大虧損: ${Math.round(maxLoss)} 元

**請提供分析報告，包含：**
1.  **風險評估**: (低/中/高) 請說明主要風險來源（例如：下檔保護不足、上方獲利被鎖死、時間價值流失快等）。
2.  **避險有效性**: 目前的倉位對於大跌 (-10%) 是否有足夠保護？
3.  **操作建議**: 針對目前狀況，具體建議如何調整倉位（例如：平倉某部位、加買 Put、或是調整履約價）。請給出具體履約價建議。
    `;
}

/**
 * 簡單的 Markdown 渲染器
 */
function renderMarkdown(text) {
    if (!text) return '';

    // 處理標題
    let html = text
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // 粗體
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // 斜體
        .replace(/\n/g, '<br>'); // 換行

    return html;
}

/**
 * 處理庫存解析
 */
function handleParseInventory() {
    const text = elements.inventoryText.value.trim();
    if (!text) {
        showToast('error', '請先貼上庫存資料');
        return;
    }

    parsedInventory = parseInventoryText(text);
    displayParsedResults(parsedInventory);
    showToast('success', 'AI 解析完成');
}

/**
 * 解析庫存文字
 * 支援多種券商格式
 */
function parseInventoryText(text) {
    const result = {
        etf: null,
        options: []
    };

    const lines = text.split('\n').filter(l => l.trim());

    for (const line of lines) {
        // 解析 00631L ETF
        const etfMatch = parseETFLine(line);
        if (etfMatch) {
            result.etf = etfMatch;
            continue;
        }

        // 解析選擇權
        const optMatch = parseOptionLine(line);
        if (optMatch) {
            result.options.push(optMatch);
            continue;
        }

        // 解析期貨
        const futMatch = parseFuturesLine(line);
        if (futMatch) {
            result.options.push(futMatch);
        }
    }

    return result;
}

/**
 * 解析 ETF 庫存行
 */
function parseETFLine(line) {
    const lowerLine = line.toLowerCase();

    // 常見 00631L 相關關鍵字
    if (!lowerLine.includes('00631l') && !lowerLine.includes('631l') &&
        !lowerLine.includes('正2') && !lowerLine.includes('台灣50正2')) {
        return null;
    }

    // 嘗試提取數值
    const numbers = line.match(/[\d,]+\.?\d*/g) || [];
    const cleanNumbers = numbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n));

    // 嘗試識別張數、成本、現價
    let lots = 0, cost = 0, current = 0;

    // 張數模式：xxx張 或 xxx 張
    const lotsMatch = line.match(/([\d,.]+)\s*張/);
    if (lotsMatch) {
        lots = parseFloat(lotsMatch[1].replace(/,/g, ''));
    }

    // 成本模式：成本xxx 或 均價xxx
    const costMatch = line.match(/(?:成本|均價|買進均價|平均成本)[：:\s]*(\d+\.?\d*)/);
    if (costMatch) {
        cost = parseFloat(costMatch[1]);
    }

    // 現價模式：現價xxx 或 市價xxx
    const currentMatch = line.match(/(?:現價|市價|收盤價)[：:\s]*(\d+\.?\d*)/);
    if (currentMatch) {
        current = parseFloat(currentMatch[1]);
    }

    // 如果沒有明確標籤，嘗試推斷
    if (lots === 0 && cleanNumbers.length > 0) {
        // 找最小的合理數值作為張數
        const potentialLots = cleanNumbers.filter(n => n < 1000 && n > 0);
        if (potentialLots.length > 0) {
            lots = potentialLots[0];
        }
    }

    if (cost === 0 && cleanNumbers.length > 1) {
        // 找接近 ETF 價格範圍的數值
        const potentialPrices = cleanNumbers.filter(n => n > 50 && n < 300);
        if (potentialPrices.length >= 1) {
            cost = potentialPrices[0];
        }
        if (potentialPrices.length >= 2) {
            current = potentialPrices[1];
        }
    }

    if (lots === 0 && cost === 0) return null;

    return { lots, cost, current };
}

/**
 * 解析選擇權庫存行
 */
function parseOptionLine(line) {
    const lowerLine = line.toLowerCase();

    // 選擇權關鍵字
    const isOption = lowerLine.includes('call') || lowerLine.includes('put') ||
        lowerLine.includes('買權') || lowerLine.includes('賣權') ||
        lowerLine.includes('選擇權');

    if (!isOption) return null;

    // 判斷 Call/Put
    const isCall = lowerLine.includes('call') || lowerLine.includes('買權');
    const type = isCall ? 'Call' : 'Put';

    // 判斷買進/賣出
    const isBuy = lowerLine.includes('買進') || lowerLine.includes('long') ||
        lowerLine.includes('買入') || !lowerLine.includes('賣出');
    const direction = lowerLine.includes('賣出') ? '賣出' : '買進';

    // 提取履約價（通常是 5 位數）
    const strikeMatch = line.match(/(\d{4,5})(?!\d)/);
    const strike = strikeMatch ? parseInt(strikeMatch[1]) : 0;

    // 提取口數
    const lotsMatch = line.match(/(\d+)\s*口/);
    const lots = lotsMatch ? parseInt(lotsMatch[1]) : 1;

    // 提取權利金
    const premiumMatch = line.match(/(?:權利金|成本|@)\s*(\d+)/);
    const premium = premiumMatch ? parseFloat(premiumMatch[1]) : 0;

    if (strike === 0) return null;

    return {
        product: '台指',
        type,
        direction,
        strike,
        lots,
        premium
    };
}

/**
 * 解析期貨庫存行
 */
function parseFuturesLine(line) {
    const lowerLine = line.toLowerCase();

    // 期貨關鍵字
    const isFutures = lowerLine.includes('期貨') || lowerLine.includes('微台') ||
        lowerLine.includes('小台') || lowerLine.includes('大台');

    if (!isFutures) return null;

    // 提取價格（通常是 5 位數）
    const priceMatch = line.match(/(\d{4,5})(?!\d)/);
    const strike = priceMatch ? parseInt(priceMatch[1]) : 0;

    // 提取口數
    const lotsMatch = line.match(/(\d+)\s*口/);
    const lots = lotsMatch ? parseInt(lotsMatch[1]) : 1;

    if (strike === 0) return null;

    return {
        product: '微台期貨',
        type: 'Futures',
        direction: '做空',
        strike,
        lots,
        premium: 0
    };
}

/**
 * 顯示解析結果
 */
function displayParsedResults(parsed) {
    let etfHtml = '';
    let optionsHtml = '';

    if (parsed.etf) {
        etfHtml = `
            <div class="parsed-item">
                <span class="parsed-label">📊 00631L</span>
                <span class="parsed-value">${parsed.etf.lots} 張</span>
                <span class="parsed-detail">成本 ${parsed.etf.cost || '--'} / 現價 ${parsed.etf.current || '--'}</span>
            </div>
        `;
    } else {
        etfHtml = '<p class="empty-hint">未偵測到 ETF 庫存</p>';
    }

    if (parsed.options.length > 0) {
        optionsHtml = parsed.options.map((opt, i) => `
            <div class="parsed-item">
                <span class="parsed-label">#${i + 1}</span>
                <span class="parsed-tag tag-${opt.type.toLowerCase()}">${opt.type}</span>
                <span class="parsed-tag tag-${opt.direction === '買進' ? 'buy' : 'sell'}">${opt.direction}</span>
                <span class="parsed-value">${opt.strike}</span>
                <span class="parsed-detail">${opt.lots} 口 @ ${opt.premium} 點</span>
            </div>
        `).join('');
    } else {
        optionsHtml = '<p class="empty-hint">未偵測到選擇權倉位</p>';
    }

    elements.parsedEtf.innerHTML = etfHtml;
    elements.parsedOptions.innerHTML = optionsHtml;
    elements.parseResults.style.display = 'block';
}

/**
 * 清空庫存輸入
 */
function handleClearInventory() {
    elements.inventoryText.value = '';
    elements.parseResults.style.display = 'none';
    parsedInventory = { etf: null, options: [] };
}

/**
 * 套用解析結果
 */
function handleApplyParsed() {
    if (!parsedInventory.etf && parsedInventory.options.length === 0) {
        showToast('error', '沒有可套用的資料');
        return;
    }

    // 套用 ETF
    if (parsedInventory.etf) {
        state.etfLots = parsedInventory.etf.lots;
        if (parsedInventory.etf.cost) state.etfCost = parsedInventory.etf.cost;
        if (parsedInventory.etf.current) state.etfCurrentPrice = parsedInventory.etf.current;
    }

    // 套用選擇權
    if (parsedInventory.options.length > 0) {
        const currentStrat = state.currentStrategy;
        // 將新倉位加入目前的策略陣列
        state.strategies[currentStrat] = [...state.strategies[currentStrat], ...parsedInventory.options];
        // 更新指標
        state.optionPositions = state.strategies[currentStrat];
    }

    updateUI();
    updateChart();
    autoSave();
    showToast('success', '已套用解析結果');

    // 清空
    handleClearInventory();
}

// ======== 圖片 OCR 功能 ========

// PWA 後端 API URL
const OCR_API_URL = 'https://zero0631l-hedge-api.onrender.com/api/ocr-image';

// 暫存的圖片 base64
// 暫存的圖片 base64
// uploadedImageBase64 declared at top of file

/**
 * 處理圖片上傳
 */
function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (file) {
        processImageFile(file);
    }
}

/**
 * 處理圖片拖曳 - dragover
 */
function handleImageDragOver(e) {
    e.preventDefault();
    elements.imageUploadArea.classList.add('dragover');
}

/**
 * 處理圖片拖曳 - dragleave
 */
function handleImageDragLeave(e) {
    e.preventDefault();
    elements.imageUploadArea.classList.remove('dragover');
}

/**
 * 處理圖片拖曳 - drop
 */
function handleImageDrop(e) {
    e.preventDefault();
    elements.imageUploadArea.classList.remove('dragover');

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        processImageFile(file);
    } else {
        showToast('error', '請上傳圖片檔案');
    }
}

/**
 * 處理圖片檔案 - 轉換為 base64 並預覽
 */
function processImageFile(file) {
    console.log('Processing image file:', file.name); // DEBUG
    const reader = new FileReader();

    reader.onload = (e) => {
        const base64 = e.target.result;
        uploadedImageBase64 = base64;
        console.log('Image converted to base64, length:', base64.length); // DEBUG

        // 顯示預覽
        if (elements.previewImg) elements.previewImg.src = base64;
        if (elements.imageUploadArea) elements.imageUploadArea.style.display = 'none';

        // 強制顯示預覽區塊
        if (elements.imagePreview) {
            elements.imagePreview.style.display = 'block';
            console.log('Preview element set to display: block'); // DEBUG
        } else {
            console.error('Preview element not found!'); // DEBUG
        }
    };

    reader.onerror = () => {
        console.error('FileReader error');
        showToast('error', '無法讀取圖片');
    };

    reader.readAsDataURL(file);
}

/**
 * 清除圖片
 */
function handleClearImage() {
    uploadedImageBase64 = null;
    elements.previewImg.src = '';
    elements.imageUpload.value = '';
    elements.imagePreview.style.display = 'none';
    elements.imageUploadArea.style.display = 'block';
    elements.ocrLoading.style.display = 'none';
}

/**
 * 執行 OCR 辨識
 */
/**
 * 執行 AI 圖片辨識 (使用 Gemini Vision)
 */
/**
 * 執行 AI 圖片辨識 (使用 Gemini Vision)
 */
async function handleOcrRecognize() {
    if (!uploadedImageBase64) {
        showToast('error', '請先上傳圖片');
        return;
    }

    // 優先使用寫死在程式碼的 Key，如果沒有才看網頁輸入框
    const apiKey = HARDCODED_API_KEY || elements.aiApiKey?.value.trim() || '';

    if (!apiKey) {
        showToast('error', '請先設定 API Key (在下方 AI 設定區塊)');
        // Open sidebar if closed
        if (!elements.sidebar.classList.contains('open')) {
            toggleSidebar();
        }
        elements.aiApiKey?.focus();
        return;
    }

    // 顯示載入中
    elements.imagePreview.style.display = 'none';
    elements.ocrLoading.style.display = 'block';

    // 移除 data:image/png;base64, 前綴
    const base64Data = uploadedImageBase64.split(',')[1];
    const mimeType = uploadedImageBase64.split(',')[0].match(/:(.*?);/)[1];

    try {
        const prompt = `
你是一個專業的金融交易員助理。請分析這張圖片（券商庫存截圖），並提取出所有的「選擇權」倉位資訊。

請將結果輸出為嚴格的 JSON 格式陣列，不要包含 Markdown 標記 (\`\`\`json ... \`\`\`)，直接回傳 JSON 字串即可。
陣列中每個物件應包含以下欄位：
- "type": "Call" 或 "Put"
- "direction": "買進" 或 "賣出"
- "strike": 履約價 (數值)
- "lots": 口數 (數值, 必須為正整數)
- "premium": 成交價或成本 (數值)

請忽略期貨 (Futures) 或股票 (Stock) 倉位，只提取選擇權 (Options)。
如果圖片模糊或無法辨識，請回傳空陣列 []。

範例格式：
[
  {"type": "Call", "direction": "買進", "strike": 20000, "lots": 2, "premium": 350},
  {"type": "Put", "direction": "賣出", "strike": 19800, "lots": 5, "premium": 80.5}
]
`;

        // 定義模型列表 (Vision 優先順序)
        const models = [
            'gemini-1.5-flash-002',      // Explicit version
            'gemini-1.5-flash-001',      // Explicit version
            'gemini-1.5-flash',          // Alias
            'gemini-1.5-flash-latest',   // Alias
            'gemini-1.5-pro-002',        // Pro Explicit
            'gemini-2.0-flash-exp',      // 2.0 實驗版
            'gemini-1.5-flash-8b',       // 8B version
            'gemini-pro-vision'          // 舊版備用
        ];

        let lastError = null;
        let successData = null;

        // 嘗試所有模型
        for (const model of models) {
            try {
                console.log(`嘗試使用模型: ${model}...`);

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64Data
                                    }
                                }
                            ]
                        }]
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error?.message || `模型 ${model} 請求失敗`);
                }

                successData = await response.json();
                break; // 成功就跳出迴圈
            } catch (e) {
                console.warn(`模型 ${model} 失敗:`, e.message);
                lastError = e;
                // 繼續嘗試下一個
            }
        }

        if (!successData) {
            throw lastError || new Error('所有模型皆無法使用');
        }

        const text = successData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error('模型未回傳資料');

        // 清理 Markdown 標記以便解析 JSON
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('Gemini 解析結果:', cleanText);

        let positions = [];
        try {
            positions = JSON.parse(cleanText);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            throw new Error('AI 回傳格式錯誤，無法解析');
        }

        if (!Array.isArray(positions)) {
            throw new Error('AI 回傳格式非陣列');
        }

        if (positions.length === 0) {
            throw new Error('未識別到任何選擇權倉位 (或是非選擇權商品)');
        }

        // 設定到 parsedInventory 並顯示結果
        parsedInventory = {
            etf: null,
            options: positions
        };

        displayParsedResults(parsedInventory);
        showToast('success', `AI 辨識成功！共 ${positions.length} 筆倉位`);

    } catch (error) {
        console.error('OCR Error:', error);

        // 如果全部失敗，嘗試自我診斷
        if (error.message.includes('所有模型皆無法使用')) {
            showToast('warning', '正在診斷可用模型...');
            try {
                const modelsResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                const modelsData = await modelsResp.json();

                if (modelsData.models) {
                    const availableModels = modelsData.models
                        .filter(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('vision') || m.name.includes('flash') || m.name.includes('pro'))
                        .map(m => m.name.replace('models/', ''))
                        .join('\n');

                    alert(`您的 API Key 無法存取目前設定的模型。\n\n目前可用的模型如下：\n${availableModels}\n\n請截圖給開發者！`);
                }
            } catch (diagError) {
                console.error('Diagnosis failed:', diagError);
            }
        }

        showToast('error', '辨識失敗: ' + error.message);

        // 恢復預覽
        elements.imagePreview.style.display = 'block';
    } finally {
        elements.ocrLoading.style.display = 'none';
    }
}

/**
 * 解析 OCR 回傳的 CSV 格式
 * 格式：類型,方向,Call/Put,履約價,權利金,口數
 */
function parseOcrCsv(csvText) {
    const positions = [];
    const lines = csvText.split('\n').filter(l => l.trim());

    // 跳過標題行
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());

        if (cols.length < 6) continue;

        const [typeStr, directionStr, callPutStr, strikeStr, premiumStr, lotsStr] = cols;

        // 跳過期貨（這裡只處理選擇權）
        if (typeStr.toLowerCase() === 'future') continue;

        const strike = parseFloat(strikeStr);
        const premium = parseFloat(premiumStr);
        const lots = parseInt(lotsStr);

        if (isNaN(strike) || isNaN(lots)) continue;

        positions.push({
            product: '台指',
            type: callPutStr.toLowerCase() === 'call' ? 'Call' : 'Put',
            direction: directionStr.toLowerCase() === 'buy' ? '買進' : '賣出',
            strike: strike,
            lots: lots,
            premium: isNaN(premium) ? 0 : premium
        });
    }

    return positions;
}

// ======== 策略比較功能 ========

/**
 * 切換 A/B 策略
 */
function handleStrategySwitch(e) {
    const target = e.target.dataset.strategy;
    if (target && target !== state.currentStrategy) {
        state.currentStrategy = target;
        state.optionPositions = state.strategies[target];

        // 更新按鈕樣式
        if (elements.btnStrategyA) {
            elements.btnStrategyA.classList.toggle('active', target === 'A');
            elements.btnStrategyB.classList.toggle('active', target === 'B');
        }

        // 更新 UI
        updateUI(); // 這會更新倉位列表和權利金摘要
        updateChart(); // 這會計算兩個策略並更新圖表與表格

        showToast('info', `已切換到策略 ${target}`);
    }
}

/**
 * 複製策略
 */
function handleCopyStrategy() {
    const from = elements.copySource ? elements.copySource.value : 'A';
    const to = elements.copyTarget ? elements.copyTarget.value : 'B';

    if (from === to) {
        showToast('warning', '來源與目標不能相同');
        return;
    }

    // Double check confirmation (redundant but safe)
    if (elements.chkConfirmCopy && !elements.chkConfirmCopy.checked) {
        showToast('warning', '請先勾選確認方塊');
        return;
    }

    // 深拷貝
    state.strategies[to] = JSON.parse(JSON.stringify(state.strategies[from]));

    // 如果當前是目標策略，立即更新顯示
    if (state.currentStrategy === to) {
        state.optionPositions = state.strategies[to];
        updateUI();
    }

    // 無論如何都要更新圖表
    updateChart();

    showToast('success', `已將策略 ${from} 複製到策略 ${to}`);
    autoSave();

    // Reset confirmation
    if (elements.chkConfirmCopy) {
        elements.chkConfirmCopy.checked = false;
        elements.btnConfirmCopy.disabled = true;
    }
}



/**
 * 處理儲存 Firebase 設定
 */
function handleSaveFirebaseConfig() {
    try {
        const configStr = elements.firebaseConfigInput.value.trim();
        if (!configStr) {
            showToast('warning', '請輸入設定內容');
            return;
        }

        const config = JSON.parse(configStr);
        // saveUserConfig now throws on error
        FirebaseModule.saveUserConfig(config);

        showToast('success', '設定已儲存，正在重新連線...');

        // 重新初始化 (嘗試)
        FirebaseModule.initFirebase(config);

        // 延遲重整以確保完全生效
        setTimeout(() => window.location.reload(), 1000);

    } catch (e) {
        console.error(e);
        if (e instanceof SyntaxError) {
            showToast('error', '設定格式錯誤 (必須是有效 JSON)');
        } else {
            showToast('error', '儲存失敗: ' + e.message);
        }
    }
}

/**
 * 處理重置 Firebase 設定
 */
function handleResetFirebaseConfig() {
    if (confirm('確定要重置為預設 Firebase 設定嗎？網頁將會重新整理。')) {
        FirebaseModule.resetConfig();
        // 立即更新 UI 以顯示預設值 (不必等 reload)
        if (elements.firebaseConfigInput && FirebaseModule.DEFAULT_CONFIG) {
            elements.firebaseConfigInput.value = JSON.stringify(FirebaseModule.DEFAULT_CONFIG, null, 2);
        }
        window.location.reload();
    }
}

// ======== AI 策略分析功能 ========

/**
 * 處理測試 Firebase 連線
 */
async function handleTestFirebaseConnection() {
    showToast('info', '正在測試連線...');
    const result = await FirebaseModule.checkConnection();

    if (result.success) {
        showToast('success', result.message);
    } else {
        showToast('error', result.message);
        // 如果失敗，嘗試顯示更多資訊
        if (result.message.includes('Config')) {
            alert('連線失敗，請檢查 Firebase Config 是否正確。\n\n錯誤訊息: ' + result.message);
        }
    }
}

/**
 * 處理複製同步連結
 */
async function handleCopySyncLink() {
    try {
        const syncUrl = FirebaseModule.getSyncUrl();
        await navigator.clipboard.writeText(syncUrl);
        showToast('success', '已複製同步連結！在其他裝置開啟即可同步資料');
    } catch (e) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = FirebaseModule.getSyncUrl();
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('success', '已複製同步連結！');
    }
}

// ======== AI 策略分析功能 ========

function bindAIEvents() {
    elements.btnAiAnalysis = document.getElementById('btn-ai-analysis');
    elements.aiLoading = document.getElementById('ai-loading');
    elements.aiResultCard = document.getElementById('ai-result-card');
    elements.btnCloseAi = document.getElementById('btn-close-ai');
    elements.aiResultContent = document.getElementById('ai-result-content');
    elements.aiApiKey = document.getElementById('ai-api-key');

    // Button event listener
    elements.btnAiAnalysis?.addEventListener('click', handleAIAnalysis);

    // Close button event listener
    elements.btnCloseAi?.addEventListener('click', () => {
        if (elements.aiResultCard) elements.aiResultCard.style.display = 'none';
    });
}

/**
 * 綁定 AI 庫存判讀相關事件
 */
/**
 * 綁定 AI 庫存判讀相關事件 (功能已移除)
 */
function bindInventoryEvents() {
    // 拖曳上傳
    elements.imageUploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.imageUploadArea.classList.add('dragover');
    });

    elements.imageUploadArea?.addEventListener('dragleave', (e) => {
        e.preventDefault();
        elements.imageUploadArea.classList.remove('dragover');
    });

    elements.imageUploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.imageUploadArea.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processImageFile(e.dataTransfer.files[0]);
        }
    });

    elements.btnOcrRecognize?.addEventListener('click', handleOcrRecognize);
    elements.btnClearImage?.addEventListener('click', handleClearImage);

    elements.btnParseInventory?.addEventListener('click', handleParseInventory);
    elements.btnClearInventory?.addEventListener('click', () => {
        if (elements.inventoryText) elements.inventoryText.value = '';
        if (elements.parseResults) elements.parseResults.style.display = 'none';
    });
}

// 請在這裡填入您的 API Key，就不用每次在網頁上輸入了！
const HARDCODED_API_KEY = '';

/**
 * 執行 AI 策略分析
 */
async function handleAIAnalysis() {
    // 優先使用寫死在程式碼的 Key，如果沒有才看網頁輸入框
    const apiKey = HARDCODED_API_KEY || elements.aiApiKey?.value.trim() || '';

    if (!apiKey) {
        showToast('error', '請先在程式碼中填入 API Key，或在側邊欄輸入');
        // Open sidebar if closed
        if (!elements.sidebar.classList.contains('open')) {
            toggleSidebar();
        }
        elements.aiApiKey?.focus();
        return;
    }

    // 準備資料
    const strategyData = {
        tseIndex: state.tseIndex,
        etf: {
            price: state.etfCurrentPrice,
            lots: state.etfLots,
            cost: state.etfCost
        },
        positions: state.strategies[state.currentStrategy], // Use current strategy
        account: {
            balance: state.accountBalance,
            cost: state.accountCost
        },
        view: {
            priceRange: state.priceRange
        }
    };

    // 顯示 Loading
    elements.btnAiAnalysis.disabled = true;
    if (elements.aiLoading) elements.aiLoading.style.display = 'block';
    if (elements.aiResultCard) elements.aiResultCard.style.display = 'none';

    try {
        const prompt = `
你是一位專業的選擇權避險策略分析師。請根據以下資料進行詳細診斷與建議：

**市場數據**：
- 加權指數：${strategyData.tseIndex}
- 00631L 現價：${strategyData.etf.price}

**投資組合 (00631L + 選擇權避險)**：
- 00631L 持倉：${strategyData.etf.lots} 張 (成本 ${strategyData.etf.cost})
- 當前策略 (${state.currentStrategy}) 選擇權倉位：
${strategyData.positions.map(p => `- ${p.direction} ${p.type} ${p.strike} @ ${p.premium} (${p.lots}口)`).join('\n') || '(無倉位)'}

**請分析以下重點**：
1.  **避險效力評估**：目前的選擇權部位是否能有效保護 00631L 下跌風險？
2.  **損益平衡點**：大約在加權指數多少點位是損益兩平？
3.  **風險提示**：如果有突發大漲或大跌，此組合的最大風險是什麼？
4.  **調整建議**：針對目前的部位，建議如何調整（加倉、平倉、或移動履約價）？

請用繁體中文回答，使用 Markdown 格式（條列式重點），語氣專業但易懂。
`;

        // 定義模型嘗試列表 (根據您的 API Key 可用列表調整)
        const models = [
            'gemini-2.0-flash',          // 新一代模型
            'gemini-flash-latest',       // 最新 Flash 版本
            'gemini-pro-latest',         // 最新 Pro 版本
            'gemini-1.5-flash',          // 舊版備用
            'gemini-pro'                 // 舊版備用
        ];

        let lastError = null;
        let successData = null;

        // 嘗試所有模型
        for (const model of models) {
            try {
                console.log(`嘗試使用模型: ${model}...`);

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }]
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error?.message || `模型 ${model} 請求失敗`);
                }

                successData = await response.json();
                break; // 成功就跳出迴圈
            } catch (e) {
                console.warn(`模型 ${model} 失敗:`, e.message);
                lastError = e;
                // 繼續嘗試下一個
            }
        }

        if (!successData) {
            throw lastError || new Error('所有模型皆無法使用');
        }

        const aiText = successData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiText) {
            // Render Result
            if (elements.aiResultCard) elements.aiResultCard.style.display = 'block';
            if (elements.aiResultContent) {
                elements.aiResultContent.innerHTML = marked.parse(aiText);
            }
            showToast('success', 'AI 分析完成');
        }

    } catch (error) {
        console.error('AI Error:', error);

        // 嘗試列出可用模型以進行診斷
        try {
            showToast('warning', '正在診斷可用模型...');
            const modelsResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const modelsData = await modelsResp.json();

            if (modelsData.models) {
                const availableModels = modelsData.models
                    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                    .map(m => m.name.replace('models/', ''))
                    .join(', ');

                console.log('Available Models:', availableModels);
                alert(`您的 API Key 可用的模型有：\n${availableModels}\n\n請截圖此畫面給開發者！`);
            } else {
                alert('無法取得模型列表，請檢查 API Key 是否正確或是 Google Cloud Console 是否已啟用 Generative Language API。');
            }
        } catch (e) {
            console.error('ListModels Error:', e);
            alert(`診斷失敗：${error.message}\n\n而且連模型列表都抓不到，請檢查網路或 API Key 權限！`);
        }

        showToast('error', 'AI 分析失敗');
    } finally {
        elements.btnAiAnalysis.disabled = false;
        if (elements.aiLoading) elements.aiLoading.style.display = 'none';
    }
}
