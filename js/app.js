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
    priceRange: 1500,
    accountCost: 0, // 帳戶成本
    accountBalance: 0, // 目前餘額

    // 策略管理
    strategies: strategies,
    currentStrategy: 'A',
    optionPositions: strategies.A, // 動態指向當前策略的倉位

    // UI Cache
    lastRenderedStrikeCenter: null,

    // 複試單分組
    nextGroupId: 1,
    selectedPositions: new Set(), // 儲存格式: "Strategy-Index" (e.g., "A-0")

    isLoading: true
};

// ======== DOM 元素快取 ========
const elements = {};

// ======== 初始化 ========
document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    bindEvents();
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
    elements.currentIndexDisplay = document.getElementById('current-index-display');

    // Main Content
    elements.btnReload = document.getElementById('btn-reload');
    elements.btnSave = document.getElementById('btn-save');
    elements.btnClear = document.getElementById('btn-clear');

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
    elements.btnAddOption = document.getElementById('btn-add-option');

    // Futures Form
    elements.futuresStrike = document.getElementById('futures-strike');
    elements.futuresLots = document.getElementById('futures-lots');
    elements.btnAddFutures = document.getElementById('btn-add-futures');

    // Strategy Controls
    elements.btnCopyStrategy = document.getElementById('btn-copy-strategy');
    elements.btnGroupPositions = document.getElementById('btn-group-positions');
    elements.btnClearStrategy = document.getElementById('btn-clear-strategy');
    elements.btnAddToA = document.getElementById('btn-add-to-a');
    elements.btnAddToB = document.getElementById('btn-add-to-b');
    elements.btnAddToC = document.getElementById('btn-add-to-c');



    // AI Inventory Parser
    elements.inventoryText = document.getElementById('inventory-text');
    elements.btnParseInventory = document.getElementById('btn-parse-inventory');
    elements.btnClearInventory = document.getElementById('btn-clear-inventory');
    elements.parseResults = document.getElementById('parse-results');
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

    // Sidebar Inputs
    elements.etfLotsInput?.addEventListener('input', handleSettingsChange);
    elements.etfCostInput?.addEventListener('input', handleSettingsChange);
    elements.etfCurrentInput?.addEventListener('input', handleSettingsChange);
    elements.hedgeRatioInput?.addEventListener('input', handleSettingsChange);
    elements.accountCostInput?.addEventListener('input', handleSettingsChange);
    elements.accountBalanceInput?.addEventListener('input', handleSettingsChange);
    elements.priceRangeInput?.addEventListener('input', handleSettingsChange);

    // File Operations
    elements.btnReload?.addEventListener('click', handleReload);
    elements.btnSave?.addEventListener('click', handleSave);
    elements.btnClear?.addEventListener('click', handleClear);

    // Product Tabs
    elements.productTabs.forEach(tab => {
        tab.addEventListener('click', handleProductTabClick);
    });

    // Add Position
    elements.btnAddOption?.addEventListener('click', handleAddOption);
    elements.btnAddFutures?.addEventListener('click', handleAddFutures);

    // Strategy Controls
    elements.btnGroupPositions?.addEventListener('click', handleGroupPositions);
    elements.btnCopyStrategy?.addEventListener('click', handleCopyStrategy);
    elements.btnClearStrategy?.addEventListener('click', handleClearStrategy);
    elements.btnAddToA?.addEventListener('click', () => handleAddToStrategyClick('A'));
    elements.btnAddToB?.addEventListener('click', () => handleAddToStrategyClick('B'));
    elements.btnAddToC?.addEventListener('click', () => handleAddToStrategyClick('C'));



    // AI Inventory Parser
    elements.btnParseInventory?.addEventListener('click', handleParseInventory);
    elements.btnClearInventory?.addEventListener('click', handleClearInventory);
    elements.btnApplyParsed?.addEventListener('click', handleApplyParsed);

    // Image OCR
    elements.btnBrowseImage?.addEventListener('click', () => elements.imageUpload?.click());
    elements.imageUpload?.addEventListener('change', handleImageUpload);
    elements.imageUploadArea?.addEventListener('dragover', handleImageDragOver);
    elements.imageUploadArea?.addEventListener('dragleave', handleImageDragLeave);
    elements.imageUploadArea?.addEventListener('drop', handleImageDrop);
    elements.btnOcrRecognize?.addEventListener('click', handleOcrRecognize);
    elements.btnClearImage?.addEventListener('click', handleClearImage);
}

/**
 * 初始化應用程式
 */
async function initApp() {
    try {
        // 初始化 Firebase
        FirebaseModule.initFirebase();

        // 載入資料
        const savedData = await FirebaseModule.loadData();
        if (savedData) {
            // 資料遷移：處理各種儲存格式
            if (savedData.optionPositions) {
                state.strategies.A = savedData.optionPositions;
            }
            if (savedData.strategyB && savedData.strategyB.positions) {
                state.strategies.B = savedData.strategyB.positions;
            }
            if (savedData.strategyC && savedData.strategyC.positions) {
                state.strategies.C = savedData.strategyC.positions;
            }

            // 還原其他欄位
            state.etfLots = savedData.etfLots || 0;
            state.etfCost = savedData.etfCost || 100;
            state.etfCurrentPrice = savedData.etfCurrentPrice || 100;
            state.hedgeRatio = savedData.hedgeRatio || 0.2;
            state.priceRange = savedData.priceRange || 1500;
            state.tseIndex = savedData.tseIndex || 23000;
            state.accountCost = savedData.accountCost || 0;
            state.accountBalance = savedData.accountBalance || 0;
            state.currentStrategy = savedData.currentStrategy || 'A';

            // 確保 optionPositions 正確指向
            state.optionPositions = state.strategies[state.currentStrategy];

            // 更新帳戶輸入欄位
            if (elements.accountCostInput) elements.accountCostInput.value = state.accountCost;
            if (elements.accountBalanceInput) elements.accountBalanceInput.value = state.accountBalance;
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

        // 更新時間
        updateTime();

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
    renderPositionsList('A');
    updatePremiumSummary('A');
    renderPositionsList('B');
    updatePremiumSummary('B');
    renderPositionsList('C');
    updatePremiumSummary('C');
    updatePnLTable();

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
    if (elements.etfLotsInput) elements.etfLotsInput.value = state.etfLots;
    if (elements.etfCostInput) elements.etfCostInput.value = state.etfCost;
    if (elements.etfCurrentInput) elements.etfCurrentInput.value = state.etfCurrentPrice;
    if (elements.hedgeRatioInput) elements.hedgeRatioInput.value = state.hedgeRatio;
    if (elements.priceRangeInput) elements.priceRangeInput.value = state.priceRange;
}

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

    elements.statLots.textContent = `${summary.lots.toFixed(2)} 張`;
    elements.statShares.textContent = `${summary.shares.toLocaleString()} 股`;
    elements.statMarketValue.textContent = `${summary.marketValue.toLocaleString()} 元`;
    elements.statCostValue.textContent = `${summary.costValue.toLocaleString()} 元`;

    const pnlClass = summary.unrealizedPnL >= 0 ? 'profit' : 'loss';
    elements.statUnrealizedPnL.textContent = `${summary.unrealizedPnL >= 0 ? '+' : ''}${summary.unrealizedPnL.toLocaleString()} 元`;
    elements.statUnrealizedPnL.className = 'stat-value ' + pnlClass;
    elements.statPnLPct.textContent = `${summary.pnlPercent >= 0 ? '+' : ''}${summary.pnlPercent.toFixed(2)}%`;

    // 更新避險建議
    const suggestion = state.etfLots * state.hedgeRatio;
    const suggestionText = elements.hedgeSuggestion.querySelector('.suggestion-text');
    if (suggestionText) {
        suggestionText.innerHTML = `持有 ${state.etfLots.toFixed(2)} 張，建議買入 <b>${suggestion.toFixed(1)} 口</b> 賣權進行保護`;
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
 * 產生履約價點選器
 */
function renderStrikePicker() {
    if (!elements.strikePickerGrid) return;

    const centerStrike = Math.round(state.tseIndex / 100) * 100;

    // 避免重複渲染相同的中心點
    if (state.lastRenderedStrikeCenter === centerStrike) return;
    state.lastRenderedStrikeCenter = centerStrike;

    const strikes = [];

    // 產生 ±1000 點範圍的履約價（每 100 點一個）
    // 使用者要求：大盤是30000就是正負大概1000點的點位，排列可以在修正讓使用者更清楚
    for (let s = centerStrike - 1000; s <= centerStrike + 1000; s += 100) {
        strikes.push(s);
    }

    // 產生 T 字報價表 HTML
    let html = `
        <div class="chain-header">
            <span class="chain-col-call">Call (買權)</span>
            <span class="chain-col-strike">履約價</span>
            <span class="chain-col-put">Put (賣權)</span>
        </div>
        <div class="chain-body">
    `;

    html += strikes.map(strike => {
        const isAtm = strike === centerStrike;
        return `
            <div class="chain-row ${isAtm ? 'atm' : ''}">
                <div class="chain-cell call-cell">
                    <button class="chain-btn cell-btn sell" data-strike="${strike}" data-type="Call" data-direction="賣出">賣</button>
                    <button class="chain-btn cell-btn buy" data-strike="${strike}" data-type="Call" data-direction="買進">買</button>
                </div>
                <div class="chain-cell strike-cell">
                    <span class="chain-strike">${strike}</span>
                </div>
                <div class="chain-cell put-cell">
                    <button class="chain-btn cell-btn buy" data-strike="${strike}" data-type="Put" data-direction="買進">買</button>
                    <button class="chain-btn cell-btn sell" data-strike="${strike}" data-type="Put" data-direction="賣出">賣</button>
                </div>
            </div>
        `;
    }).join('');

    html += '</div>';

    elements.strikePickerGrid.innerHTML = html;
    elements.strikePickerGrid.className = 'option-chain-container'; // 切換 class 以套用新樣式

    // 綁定事件
    elements.strikePickerGrid.querySelectorAll('.chain-btn').forEach(btn => {
        btn.addEventListener('click', handleStrikePickerClick);
    });
}

/**
 * 處理履約價點選器點擊
 */
function handleStrikePickerClick(e) {
    const strike = parseInt(e.target.dataset.strike);
    const type = e.target.dataset.type;
    const direction = e.target.dataset.direction;

    // 填入表單
    elements.optType.value = type;
    elements.optStrike.value = strike;

    // 設定買賣方向
    if (direction) {
        const radio = document.querySelector(`input[name="opt-direction"][value="${direction}"]`);
        if (radio) radio.checked = true;
    }

    // 捲動到表單
    elements.optPremium?.focus();

    showToast('info', `已選擇 ${direction || ''} ${strike} ${type === 'Call' ? '買權' : '賣權'}，請輸入權利金`);
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

    if (isFutures) {
        tagsHTML = `
            <span class="position-tag tag-product">微台期貨</span>
            <span class="position-tag tag-sell">做空</span>
        `;
        detailsHTML = `
            <span class="position-strike">進場 ${pos.strike.toLocaleString()}</span>
            <span class="position-lots-stepper">
                <button class="lots-btn lots-minus" data-index="${index}" data-strategy="${strategy}">−</button>
                <span class="lots-value">${pos.lots}</span>
                <button class="lots-btn lots-plus" data-index="${index}" data-strategy="${strategy}">+</button>
                <span class="lots-unit">口</span>
            </span>
        `;
    } else {
        const typeClass = pos.type === 'Call' ? 'tag-call' : 'tag-put';
        const typeLabel = pos.type === 'Call' ? '買權' : '賣權';
        const dirClass = pos.direction === '買進' ? 'tag-buy' : 'tag-sell';

        tagsHTML = `
            <span class="position-tag ${dirClass}">${pos.direction}</span>
            <span class="position-tag ${typeClass}">${typeLabel}</span>
        `;
        detailsHTML = `
            <span class="position-strike">${pos.strike.toLocaleString()}</span>
            <span class="position-lots-stepper">
                <button class="lots-btn lots-minus" data-index="${index}" data-strategy="${strategy}">−</button>
                <span class="lots-value">${pos.lots}</span>
                <button class="lots-btn lots-plus" data-index="${index}" data-strategy="${strategy}">+</button>
            </span>
            <span>@${pos.premium}點</span>
        `;
    }

    div.innerHTML = `
        <div class="position-select">
            <input type="checkbox" class="pos-select-check" data-index="${index}" data-strategy="${strategy}" ${isSelected ? 'checked' : ''}>
        </div>
        ${groupBadge}
        <div class="position-info">
            ${tagsHTML}
            ${detailsHTML}
        </div>
        <div class="position-actions">
            <button class="position-btn delete" data-action="delete" data-index="${index}" data-strategy="${strategy}" title="刪除">🗑️</button>
        </div>
    `;

    // 綁定選取框事件
    div.querySelector('.pos-select-check').addEventListener('change', handlePositionSelect);

    // 綁定刪除按鈕事件
    div.querySelectorAll('.position-btn').forEach(btn => {
        btn.addEventListener('click', handlePositionAction);
    });

    // 綁定口數調整按鈕事件
    div.querySelectorAll('.lots-btn').forEach(btn => {
        btn.addEventListener('click', handleLotsStepper);
    });

    return div;
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
        centerPrice: state.tseIndex,
        priceRange: state.priceRange,
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice,
        positions: state.strategies.A
    });

    // 計算策略 B
    const resultB = Calculator.calculatePnLCurve({
        centerPrice: state.tseIndex,
        priceRange: state.priceRange,
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice,
        positions: state.strategies.B
    });
    // 計算策略 C
    const resultC = Calculator.calculatePnLCurve({
        centerPrice: state.tseIndex,
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

    const formatPnL = (val) => {
        const cls = val >= 0 ? 'profit' : 'loss';
        const sign = val >= 0 ? '+' : '';
        return `<span class="${cls}">${sign}${val.toLocaleString()}</span>`;
    };

    // 計算固定的「每 100 點損益基礎值」
    // 公式：股數 × 現價 × 2倍槓桿 × (100 / 指數) 
    // 這代表指數每移動 100 點，ETF 損益的線性化估算
    const shares = state.etfLots * Calculator.CONSTANTS.ETF_SHARES_PER_LOT;
    const delta100Base = shares * state.etfCurrentPrice * Calculator.CONSTANTS.LEVERAGE_00631L * (100 / state.tseIndex);

    for (let i = 0; i < prices.length; i++) {
        const row = document.createElement('tr');

        // 策略 A/B/C 只計算選擇權損益
        const pnlA = Math.round(optProfitsA[i]);
        const pnlB = Math.round(optProfitsB[i]);
        const pnlC = Math.round(optProfitsC[i]);
        const etfPnL = Math.round(etfProfits[i]);
        // 總損益
        const totalPnLA = etfPnL + pnlA + accountPnL;
        const totalPnLB = etfPnL + pnlB + accountPnL;
        const totalPnLC = etfPnL + pnlC + accountPnL;

        const change = prices[i] - state.tseIndex;

        // 計算 ETF Δ100：每 100 點對應 delta100Base，以此類推
        // 變動 100 點 = 1 倍 delta100Base
        // 變動 200 點 = 2 倍 delta100Base
        // 變動 -100 點 = -1 倍 delta100Base（負值表示虧損）
        const multiplier = change / 100;
        const etfDelta100 = Math.round(delta100Base * multiplier);
        const etfDelta = formatPnL(etfDelta100);

        // 高亮價平區域
        if (Math.abs(change) < 50) {
            row.classList.add('table-active');
        }

        const changeStr = change >= 0 ? `+${change.toLocaleString()}` : change.toLocaleString();

        row.innerHTML = `
            <td>${changeStr}</td>
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
        centerPrice: state.tseIndex,
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
            centerPrice: state.tseIndex,
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
            centerPrice: state.tseIndex,
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

    updatePnLTable();
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
    elements.sidebar.classList.toggle('open');
}

function handleSettingsChange() {
    state.etfLots = parseFloat(elements.etfLotsInput.value) || 0;
    state.etfCost = parseFloat(elements.etfCostInput.value) || 0;
    state.etfCurrentPrice = parseFloat(elements.etfCurrentInput.value) || 0;
    state.hedgeRatio = parseFloat(elements.hedgeRatioInput.value) || 0;
    state.accountCost = parseFloat(elements.accountCostInput?.value) || 0;
    state.accountBalance = parseFloat(elements.accountBalanceInput?.value) || 0;
    state.priceRange = parseInt(elements.priceRangeInput.value) || 1500;

    // 更新帳戶損益顯示
    updateAccountPnLDisplay();

    updateUI();
    updateChart();
    autoSave();
}

function handleProductTabClick(e) {
    const product = e.target.dataset.product;

    elements.productTabs.forEach(tab => tab.classList.remove('active'));
    e.target.classList.add('active');

    if (product === 'option') {
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
 * 複製策略 A 到 B
 */
function handleCopyStrategy() {
    state.strategies.B = JSON.parse(JSON.stringify(state.strategies.A));
    updateUI();
    updateChart();
    autoSave();
    showToast('success', '已將策略 A 複製到策略 B');
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
let saveTimeout = null;
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
                strategyC: { positions: state.strategies.C }
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
let uploadedImageBase64 = null;

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
    const reader = new FileReader();

    reader.onload = (e) => {
        const base64 = e.target.result;
        uploadedImageBase64 = base64;

        // 顯示預覽
        elements.previewImg.src = base64;
        elements.imageUploadArea.style.display = 'none';
        elements.imagePreview.style.display = 'block';
    };

    reader.onerror = () => {
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
async function handleOcrRecognize() {
    if (!uploadedImageBase64) {
        showToast('error', '請先上傳圖片');
        return;
    }

    // 顯示載入中
    elements.imagePreview.style.display = 'none';
    elements.ocrLoading.style.display = 'block';

    try {
        const response = await fetch(OCR_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: uploadedImageBase64
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'OCR 服務錯誤');
        }

        const data = await response.json();

        if (!data.success || !data.csv) {
            throw new Error('無法辨識圖片內容');
        }

        // 解析 CSV 結果
        const positions = parseOcrCsv(data.csv);

        if (positions.length === 0) {
            throw new Error('未識別到任何選擇權倉位');
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
        showToast('error', 'OCR 辨識失敗: ' + error.message);

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
 * 複製策略 A 到 B
 */
function handleCopyStrategy() {
    // 深拷貝 A 到 B
    state.strategies.B = JSON.parse(JSON.stringify(state.strategies.A));

    // 如果當前是 B，立即更新顯示
    if (state.currentStrategy === 'B') {
        state.optionPositions = state.strategies.B;
        updateUI();
    }

    // 無論如何都要更新圖表（因為 B 線變了）
    updateChart();

    showToast('success', '已將策略 A 複製到策略 B');
    autoSave();
}


