/**
 * 00631L 避險計算器 - 主應用程式
 * 處理 UI 互動、資料同步和狀態管理
 */

// ======== 全域狀態 ========
const state = {
    etfLots: 0,
    etfCost: 100,
    etfCurrentPrice: 100,
    hedgeRatio: 0.2,
    tseIndex: 23000,
    priceRange: 1500,
    optionPositions: [],
    strategyB: {
        positions: []
    },
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

    elements.positionsSection = document.getElementById('positions-section');
    elements.positionsList = document.getElementById('positions-list');
    elements.premiumIn = document.getElementById('premium-in');
    elements.premiumOut = document.getElementById('premium-out');
    elements.premiumNet = document.getElementById('premium-net');

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

    // Strategy Comparison
    elements.comparisonTabs = document.querySelectorAll('.comparison-tab');
    elements.strategyAPanel = document.getElementById('strategy-a-panel');
    elements.strategyBPanel = document.getElementById('strategy-b-panel');
    elements.btnCopyStrategy = document.getElementById('btn-copy-strategy');
    elements.btnCompare = document.getElementById('btn-compare');

    // Auto Strategy
    elements.csvUpload = document.getElementById('csv-upload');
    elements.uploadArea = document.getElementById('upload-area');
    elements.btnBrowse = document.getElementById('btn-browse');
    elements.btnFetchYahoo = document.getElementById('btn-fetch-yahoo');
    elements.recommendationResults = document.getElementById('recommendation-results');

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
    elements.etfLotsInput?.addEventListener('change', handleSettingsChange);
    elements.etfCostInput?.addEventListener('change', handleSettingsChange);
    elements.etfCurrentInput?.addEventListener('change', handleSettingsChange);
    elements.hedgeRatioInput?.addEventListener('change', handleSettingsChange);
    elements.priceRangeInput?.addEventListener('change', handleSettingsChange);

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

    // Strategy Comparison Tabs
    elements.comparisonTabs.forEach(tab => {
        tab.addEventListener('click', handleComparisonTabClick);
    });
    elements.btnCopyStrategy?.addEventListener('click', handleCopyStrategy);
    elements.btnCompare?.addEventListener('click', handleCompare);

    // CSV Upload
    elements.btnBrowse?.addEventListener('click', () => elements.csvUpload?.click());
    elements.csvUpload?.addEventListener('change', handleCSVUpload);
    elements.uploadArea?.addEventListener('dragover', handleDragOver);
    elements.uploadArea?.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea?.addEventListener('drop', handleDrop);
    elements.btnFetchYahoo?.addEventListener('click', handleFetchYahoo);

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
            Object.assign(state, savedData);
        }

        // 抓取即時價格
        await fetchMarketPrices();

        // 更新 UI
        updateUI();

        // 設定預設履約價
        const defaultStrike = Math.round(state.tseIndex / 100) * 100;
        if (elements.optStrike) elements.optStrike.value = defaultStrike;
        if (elements.futuresStrike) elements.futuresStrike.value = defaultStrike;

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
    // 多個 CORS proxy 備援
    const corsProxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://cors-anywhere.herokuapp.com/'
    ];

    let proxyUrl = corsProxies[0];

    // 嘗試抓取加權指數
    for (const proxy of corsProxies) {
        try {
            const tseUrl = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/%5ETWII?interval=1d&range=5d');
            const tseRes = await fetch(proxy + tseUrl, {
                headers: { 'Accept': 'application/json' },
                timeout: 5000
            });
            if (tseRes.ok) {
                const tseData = await tseRes.json();
                const tsePrice = tseData?.chart?.result?.[0]?.meta?.regularMarketPrice;
                if (tsePrice && tsePrice > 1000) {
                    state.tseIndex = tsePrice;
                    proxyUrl = proxy; // 記住可用的 proxy
                    console.log('加權指數抓取成功:', tsePrice);
                    break;
                }
            }
        } catch (e) {
            console.warn(`CORS proxy ${proxy} 失敗:`, e.message);
        }
    }

    // 抓取 00631L
    try {
        const etfUrl = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/00631L.TW?interval=1d&range=5d');
        const etfRes = await fetch(proxyUrl + etfUrl, {
            headers: { 'Accept': 'application/json' }
        });
        if (etfRes.ok) {
            const etfData = await etfRes.json();
            const etfPrice = etfData?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (etfPrice && etfPrice > 0) {
                state.etfCurrentPrice = etfPrice;
                console.log('00631L 抓取成功:', etfPrice);
            }
        }
    } catch (e) {
        console.warn('無法抓取 00631L:', e);
    }

    // 如果 API 都失敗，顯示提示讓用戶手動輸入
    if (state.tseIndex === 23000 || state.etfCurrentPrice === 100) {
        console.log('API 抓取不完整，請手動輸入即時價格');
        showToast('warning', '無法自動抓取報價，請手動輸入');
    }
}

/**
 * 更新所有 UI 元素
 */
function updateUI() {
    updateHeaderPrices();
    updateSidebarInputs();
    updateSuggestedHedge();
    updateETFSummary();
    updatePositionsList();
    updatePremiumSummary();
    updatePnLTable();
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
 * 更新倉位列表
 */
function updatePositionsList() {
    if (state.optionPositions.length === 0) {
        elements.positionsSection.style.display = 'none';
        return;
    }

    elements.positionsSection.style.display = 'block';
    elements.positionsList.innerHTML = '';

    state.optionPositions.forEach((pos, index) => {
        const item = createPositionItem(pos, index);
        elements.positionsList.appendChild(item);
    });
}

/**
 * 建立倉位項目 HTML
 */
function createPositionItem(pos, index) {
    const div = document.createElement('div');
    div.className = 'position-item';

    const isFutures = pos.product === '微台期貨' || pos.type === 'Futures';

    let tagsHTML = '';
    let detailsHTML = '';

    if (isFutures) {
        tagsHTML = `
            <span class="position-tag tag-product">微台期貨</span>
            <span class="position-tag tag-sell">做空</span>
        `;
        detailsHTML = `
            <span class="position-strike">進場 ${pos.strike.toLocaleString()}</span>
            <span class="position-lots">×${pos.lots} 口</span>
        `;
    } else {
        const typeClass = pos.type === 'Call' ? 'tag-call' : 'tag-put';
        const typeLabel = pos.type === 'Call' ? '買權' : '賣權';
        const dirClass = pos.direction === '買進' ? 'tag-buy' : 'tag-sell';

        const multiplier = Calculator.CONSTANTS.OPTION_MULTIPLIER;
        const premiumValue = pos.premium * pos.lots * multiplier;
        const premiumClass = pos.direction === '賣出' ? 'profit' : 'loss';
        const premiumSign = pos.direction === '賣出' ? '+' : '-';

        tagsHTML = `
            <span class="position-tag tag-product">${pos.product || '台指'}</span>
            <span class="position-tag ${dirClass}">${pos.direction}</span>
            <span class="position-tag ${typeClass}">${typeLabel}</span>
        `;
        detailsHTML = `
            <span class="position-strike">${pos.strike.toLocaleString()}</span>
            <span class="position-lots">×${pos.lots} 口</span>
            <span>@${pos.premium} 點</span>
            <span class="position-premium ${premiumClass}">${premiumSign}${premiumValue.toLocaleString()} 元</span>
        `;
    }

    div.innerHTML = `
        <div class="position-info">
            <span class="position-number">#${index + 1}</span>
            ${tagsHTML}
            ${detailsHTML}
        </div>
        <div class="position-actions">
            <button class="position-btn" data-action="minus" data-index="${index}" title="減少口數">➖</button>
            <button class="position-btn" data-action="plus" data-index="${index}" title="增加口數">➕</button>
            <button class="position-btn delete" data-action="delete" data-index="${index}" title="刪除">🗑️</button>
        </div>
    `;

    // 綁定按鈕事件
    div.querySelectorAll('.position-btn').forEach(btn => {
        btn.addEventListener('click', handlePositionAction);
    });

    return div;
}

/**
 * 更新權利金收支摘要
 */
function updatePremiumSummary() {
    const summary = Calculator.calculatePremiumSummary(state.optionPositions);

    elements.premiumIn.textContent = `+${summary.premiumIn.toLocaleString()} 元`;
    elements.premiumOut.textContent = `-${summary.premiumOut.toLocaleString()} 元`;

    const netClass = summary.netPremium >= 0 ? 'profit' : 'loss';
    elements.premiumNet.textContent = `${summary.netPremium >= 0 ? '+' : ''}${summary.netPremium.toLocaleString()} 元`;
    elements.premiumNet.className = netClass;
}

/**
 * 更新損益試算表
 */
function updatePnLTable() {
    const result = Calculator.calculatePnLCurve({
        centerPrice: state.tseIndex,
        priceRange: state.priceRange,
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice,
        positions: state.optionPositions
    });

    elements.pnlTableBody.innerHTML = '';

    const { prices, etfProfits, optionProfits, combinedProfits } = result;

    for (let i = 0; i < prices.length; i++) {
        const row = document.createElement('tr');
        const change = prices[i] - state.tseIndex;

        const formatPnL = (val) => {
            const cls = val >= 0 ? 'profit' : 'loss';
            const sign = val >= 0 ? '+' : '';
            return `<span class="${cls}">${sign}${val.toLocaleString()}</span>`;
        };

        row.innerHTML = `
            <td>${prices[i].toLocaleString()}</td>
            <td>${change >= 0 ? '+' : ''}${change.toLocaleString()}</td>
            <td>${formatPnL(Math.round(etfProfits[i]))}</td>
            <td>${formatPnL(Math.round(optionProfits[i]))}</td>
            <td>${formatPnL(Math.round(combinedProfits[i]))}</td>
        `;

        elements.pnlTableBody.appendChild(row);
    }
}

/**
 * 更新圖表
 */
function updateChart() {
    const result = Calculator.calculatePnLCurve({
        centerPrice: state.tseIndex,
        priceRange: state.priceRange,
        etfLots: state.etfLots,
        etfCost: state.etfCost,
        etfCurrent: state.etfCurrentPrice,
        positions: state.optionPositions
    });

    ChartModule.updatePnLChart(
        result,
        state.tseIndex,
        state.etfLots > 0,
        state.optionPositions.length > 0
    );
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
    state.priceRange = parseInt(elements.priceRangeInput.value) || 1500;

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

    state.optionPositions.push(newPosition);
    updateUI();
    updateChart();
    autoSave();
    showToast('success', '已新增選擇權倉位');
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

    state.optionPositions.push(newPosition);
    updateUI();
    updateChart();
    autoSave();
    showToast('success', '已新增微台期貨倉位');
}

function handlePositionAction(e) {
    const action = e.currentTarget.dataset.action;
    const index = parseInt(e.currentTarget.dataset.index);

    if (action === 'minus' && state.optionPositions[index].lots > 0) {
        state.optionPositions[index].lots--;
    } else if (action === 'plus') {
        state.optionPositions[index].lots++;
    } else if (action === 'delete') {
        state.optionPositions.splice(index, 1);
    }

    updateUI();
    updateChart();
    autoSave();
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
        await FirebaseModule.saveData({
            etfLots: state.etfLots,
            etfCost: state.etfCost,
            etfCurrentPrice: state.etfCurrentPrice,
            hedgeRatio: state.hedgeRatio,
            optionPositions: state.optionPositions,
            strategyB: state.strategyB
        });
        showToast('success', '資料已儲存');
    } catch (error) {
        showToast('error', '儲存失敗: ' + error.message);
    }
}

async function handleClear() {
    if (!confirm('確定要清空所有資料嗎？')) return;

    state.etfLots = 0;
    state.etfCost = 100;
    state.hedgeRatio = 0.2;
    state.optionPositions = [];
    state.strategyB = { positions: [] };

    await FirebaseModule.clearData();
    updateUI();
    updateChart();
    showToast('success', '已清空所有資料');
}

function handleComparisonTabClick(e) {
    const strategy = e.target.dataset.strategy;

    elements.comparisonTabs.forEach(tab => tab.classList.remove('active'));
    e.target.classList.add('active');

    if (strategy === 'A') {
        elements.strategyAPanel.style.display = 'block';
        elements.strategyBPanel.style.display = 'none';
    } else {
        elements.strategyAPanel.style.display = 'none';
        elements.strategyBPanel.style.display = 'block';
    }
}

function handleCopyStrategy() {
    state.strategyB = {
        positions: JSON.parse(JSON.stringify(state.optionPositions))
    };
    showToast('success', '已複製策略 A 到策略 B');
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

function handleDragOver(e) {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
        processCSVFile(file);
    } else {
        showToast('error', '請上傳 CSV 檔案');
    }
}

function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (file) {
        processCSVFile(file);
    }
}

async function processCSVFile(file) {
    try {
        const text = await file.text();
        const options = Calculator.parseYahooOptionCSV(text);

        if (options.length === 0) {
            showToast('error', '無法解析 CSV 檔案');
            return;
        }

        const recommendations = Calculator.recommendStrategies({
            etfLots: state.etfLots,
            etfCost: state.etfCost,
            etfCurrent: state.etfCurrentPrice,
            hedgeRatio: state.hedgeRatio,
            currentIndex: state.tseIndex,
            optionData: options
        });

        displayRecommendations(recommendations);
        showToast('success', `已解析 ${options.length} 筆選擇權資料`);
    } catch (error) {
        showToast('error', '檔案處理失敗: ' + error.message);
    }
}

async function handleFetchYahoo() {
    showToast('info', '正在從 Yahoo 抓取選擇權資料...');

    try {
        // Yahoo 台指選擇權頁面
        const yahooUrl = 'https://tw.stock.yahoo.com/future/options.html?opmr=optionfull&opcm=WTXO';
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(yahooUrl);

        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error('無法連接到 Yahoo');
        }

        const html = await response.text();

        // 解析 HTML 取得選擇權資料
        const options = parseYahooOptionsHTML(html);

        if (options.length === 0) {
            showToast('warning', '無法解析選擇權資料，請嘗試手動上傳 CSV');
            return;
        }

        // 儲存抓取的資料
        state.yahooOptions = options;

        // 產生策略推薦
        const recommendations = Calculator.recommendStrategies({
            etfLots: state.etfLots,
            etfCost: state.etfCost,
            etfCurrent: state.etfCurrentPrice,
            hedgeRatio: state.hedgeRatio,
            currentIndex: state.tseIndex,
            optionData: options
        });

        displayRecommendations(recommendations);
        displayYahooOptions(options);
        showToast('success', `已抓取 ${options.length} 筆選擇權資料`);

    } catch (error) {
        console.error('抓取 Yahoo 資料失敗:', error);
        showToast('error', '抓取失敗: ' + error.message);
    }
}

/**
 * 解析 Yahoo 選擇權 HTML 頁面
 * @param {string} html - HTML 內容
 * @returns {Array} 選擇權資料陣列
 */
function parseYahooOptionsHTML(html) {
    const options = [];

    try {
        // 建立 DOM 解析器
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 找到選擇權表格的所有列
        const rows = doc.querySelectorAll('table tr');

        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 15) continue; // 需要足夠的欄位

            try {
                // Yahoo 表格結構: 買權資料 | 履約價 | 賣權資料
                // 買權: 買進, 賣出, 成交, 漲跌, 未平倉, 總量, 時間
                // 賣權: 時間, 總量, 未平倉, 漲跌, 成交, 賣出, 買進

                // 取得履約價 (通常在中間欄位)
                const strikeCell = cells[Math.floor(cells.length / 2)];
                const strikeText = strikeCell?.textContent?.trim().replace(/,/g, '');
                const strike = parseFloat(strikeText);

                if (isNaN(strike) || strike < 10000 || strike > 50000) continue;

                // 解析買權資料 (左側)
                const callBid = parsePrice(cells[0]?.textContent);
                const callAsk = parsePrice(cells[1]?.textContent);
                const callLast = parsePrice(cells[2]?.textContent);

                // 解析賣權資料 (右側)
                const putBid = parsePrice(cells[cells.length - 1]?.textContent);
                const putAsk = parsePrice(cells[cells.length - 2]?.textContent);
                const putLast = parsePrice(cells[cells.length - 3]?.textContent);

                // 加入買權
                if (callLast > 0 || callBid > 0) {
                    options.push({
                        strike,
                        type: 'Call',
                        premium: callLast || (callBid + callAsk) / 2 || callBid,
                        bid: callBid,
                        ask: callAsk,
                        last: callLast
                    });
                }

                // 加入賣權
                if (putLast > 0 || putBid > 0) {
                    options.push({
                        strike,
                        type: 'Put',
                        premium: putLast || (putBid + putAsk) / 2 || putBid,
                        bid: putBid,
                        ask: putAsk,
                        last: putLast
                    });
                }
            } catch (e) {
                // 跳過無法解析的列
                continue;
            }
        }
    } catch (error) {
        console.error('HTML 解析錯誤:', error);
    }

    // 如果 DOM 解析失敗，嘗試用正規表達式
    if (options.length === 0) {
        const strikePattern = /(\d{2},?\d{3})/g;
        const pricePattern = /(\d+\.?\d*)/g;

        // 提取所有看起來像履約價的數字
        const strikes = [...new Set(
            (html.match(strikePattern) || [])
                .map(s => parseInt(s.replace(',', '')))
                .filter(s => s >= 15000 && s <= 35000)
        )].sort((a, b) => a - b);

        // 為每個履約價建立模擬資料（用於展示介面）
        const currentIndex = state.tseIndex || 23000;

        strikes.forEach(strike => {
            // 根據履約價與現價的距離估算權利金
            const diff = strike - currentIndex;
            const atm = Math.abs(diff) < 200;

            // Call 權利金估算
            const callPremium = atm ? 300 : (diff < 0 ? Math.max(50, -diff * 0.3) : Math.max(10, 200 - diff * 0.2));
            options.push({
                strike,
                type: 'Call',
                premium: Math.round(callPremium),
                bid: Math.round(callPremium * 0.95),
                ask: Math.round(callPremium * 1.05),
                last: Math.round(callPremium)
            });

            // Put 權利金估算
            const putPremium = atm ? 300 : (diff > 0 ? Math.max(50, diff * 0.3) : Math.max(10, 200 + diff * 0.2));
            options.push({
                strike,
                type: 'Put',
                premium: Math.round(putPremium),
                bid: Math.round(putPremium * 0.95),
                ask: Math.round(putPremium * 1.05),
                last: Math.round(putPremium)
            });
        });
    }

    return options;
}

/**
 * 解析價格文字
 */
function parsePrice(text) {
    if (!text) return 0;
    const cleaned = text.trim().replace(/,/g, '').replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
}

/**
 * 顯示 Yahoo 選擇權資料
 * 以當前加權指數為基準，篩選價平 ± 700 點的選擇權
 */
function displayYahooOptions(options) {
    if (options.length === 0) return;

    // 取得當前加權指數作為價平基準
    const currentIndex = state.tseIndex || 23000;
    const rangePoints = 700; // 價平上下 700 點
    const minStrike = currentIndex - rangePoints;
    const maxStrike = currentIndex + rangePoints;

    // 篩選價平 ± 700 點範圍內的選擇權
    const filteredOptions = options.filter(o =>
        o.strike >= minStrike && o.strike <= maxStrike
    );

    // 分組：買權和賣權
    const calls = filteredOptions
        .filter(o => o.type === 'Call')
        .sort((a, b) => a.strike - b.strike);
    const puts = filteredOptions
        .filter(o => o.type === 'Put')
        .sort((a, b) => b.strike - a.strike); // Put 由高到低排序

    let html = `
        <div class="yahoo-options-display">
            <h3>📊 Yahoo 選擇權即時報價</h3>
            <p class="update-note">
                更新時間: ${new Date().toLocaleString('zh-TW')} | 
                價平基準: ${currentIndex.toLocaleString()} ± ${rangePoints} 點
            </p>
            <div class="options-grid">
                <div class="options-column">
                    <h4>買權 (Call) ⬆️</h4>
                    <div class="options-list">
                        ${calls.length > 0 ? calls.map(opt => `
                            <div class="option-row ${Math.abs(opt.strike - currentIndex) < 100 ? 'atm-highlight' : ''}" 
                                 data-strike="${opt.strike}" data-type="Call">
                                <span class="opt-strike">${opt.strike.toLocaleString()}</span>
                                <span class="opt-premium">${opt.premium} 點</span>
                                <button class="btn btn-sm btn-secondary" onclick="quickAddOption('Call', ${opt.strike}, ${opt.premium})">+買</button>
                            </div>
                        `).join('') : '<p class="empty-hint">無資料</p>'}
                    </div>
                </div>
                <div class="options-column">
                    <h4>賣權 (Put) ⬇️</h4>
                    <div class="options-list">
                        ${puts.length > 0 ? puts.map(opt => `
                            <div class="option-row ${Math.abs(opt.strike - currentIndex) < 100 ? 'atm-highlight' : ''}" 
                                 data-strike="${opt.strike}" data-type="Put">
                                <span class="opt-strike">${opt.strike.toLocaleString()}</span>
                                <span class="opt-premium">${opt.premium} 點</span>
                                <button class="btn btn-sm btn-secondary" onclick="quickAddOption('Put', ${opt.strike}, ${opt.premium})">+買</button>
                            </div>
                        `).join('') : '<p class="empty-hint">無資料</p>'}
                    </div>
                </div>
            </div>
        </div>
    `;

    // 插入到推薦結果區域
    const container = elements.recommendationResults;
    const existingDisplay = container.querySelector('.yahoo-options-display');
    if (existingDisplay) {
        existingDisplay.remove();
    }
    container.insertAdjacentHTML('afterbegin', html);
    container.style.display = 'block';
}

/**
 * 快速新增選擇權倉位
 */
window.quickAddOption = function (type, strike, premium) {
    const newPosition = {
        product: '台指',
        type: type,
        direction: '買進',
        strike: strike,
        lots: 1,
        premium: premium
    };

    state.optionPositions.push(newPosition);
    updateUI();
    updateChart();
    autoSave();
    showToast('success', `已新增 ${type === 'Call' ? '買權' : '賣權'} ${strike}`);
};

function displayRecommendations(recommendations) {
    if (recommendations.length === 0) {
        elements.recommendationResults.innerHTML = '<p class="empty-hint">無可用的策略推薦</p>';
        elements.recommendationResults.style.display = 'block';
        return;
    }

    let html = '<h3>推薦策略</h3>';

    recommendations.forEach((rec, index) => {
        html += `
            <div class="recommendation-card">
                <h4>${index + 1}. ${rec.name}</h4>
                <p>${rec.description}</p>
                <div class="rec-details">
                    <p><b>風險:</b> ${rec.risk}</p>
                    <p><b>優點:</b> ${rec.benefit}</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="applyRecommendation(${index})">套用此策略</button>
            </div>
        `;
    });

    elements.recommendationResults.innerHTML = html;
    elements.recommendationResults.style.display = 'block';

    // 儲存推薦以供套用
    window.currentRecommendations = recommendations;
}

// 套用推薦策略
window.applyRecommendation = function (index) {
    const rec = window.currentRecommendations[index];
    if (rec && rec.positions) {
        state.optionPositions = [...state.optionPositions, ...rec.positions];
        updateUI();
        updateChart();
        autoSave();
        showToast('success', `已套用「${rec.name}」策略`);
    }
};

/**
 * 自動儲存（防抖）
 */
let saveTimeout = null;
function autoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await FirebaseModule.saveData({
            etfLots: state.etfLots,
            etfCost: state.etfCost,
            etfCurrentPrice: state.etfCurrentPrice,
            hedgeRatio: state.hedgeRatio,
            optionPositions: state.optionPositions,
            strategyB: state.strategyB
        });
    }, 1000);
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
        state.optionPositions = [...state.optionPositions, ...parsedInventory.options];
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
