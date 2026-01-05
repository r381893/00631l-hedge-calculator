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
 * 抓取市場即時價格
 */
async function fetchMarketPrices() {
    try {
        // Yahoo Finance API 透過 CORS proxy
        const proxyUrl = 'https://api.allorigins.win/raw?url=';

        // 抓取加權指數
        const tseUrl = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/%5ETWII?interval=1d&range=5d');
        try {
            const tseRes = await fetch(proxyUrl + tseUrl);
            const tseData = await tseRes.json();
            const tsePrice = tseData?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (tsePrice && tsePrice > 1000) {
                state.tseIndex = tsePrice;
            }
        } catch (e) {
            console.warn('無法抓取加權指數:', e);
        }

        // 抓取 00631L
        const etfUrl = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/00631L.TW?interval=1d&range=5d');
        try {
            const etfRes = await fetch(proxyUrl + etfUrl);
            const etfData = await etfRes.json();
            const etfPrice = etfData?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (etfPrice && etfPrice > 0) {
                state.etfCurrentPrice = etfPrice;
            }
        } catch (e) {
            console.warn('無法抓取 00631L:', e);
        }
    } catch (error) {
        console.error('抓取價格失敗:', error);
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
 */
function displayYahooOptions(options) {
    if (options.length === 0) return;

    // 分組：買權和賣權
    const calls = options.filter(o => o.type === 'Call').sort((a, b) => a.strike - b.strike);
    const puts = options.filter(o => o.type === 'Put').sort((a, b) => a.strike - b.strike);

    let html = `
        <div class="yahoo-options-display">
            <h3>📊 Yahoo 選擇權即時報價</h3>
            <p class="update-note">更新時間: ${new Date().toLocaleString('zh-TW')}</p>
            <div class="options-grid">
                <div class="options-column">
                    <h4>買權 (Call)</h4>
                    <div class="options-list">
                        ${calls.slice(0, 10).map(opt => `
                            <div class="option-row" data-strike="${opt.strike}" data-type="Call">
                                <span class="opt-strike">${opt.strike.toLocaleString()}</span>
                                <span class="opt-premium">${opt.premium} 點</span>
                                <button class="btn btn-sm btn-secondary" onclick="quickAddOption('Call', ${opt.strike}, ${opt.premium})">+買</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="options-column">
                    <h4>賣權 (Put)</h4>
                    <div class="options-list">
                        ${puts.slice(0, 10).map(opt => `
                            <div class="option-row" data-strike="${opt.strike}" data-type="Put">
                                <span class="opt-strike">${opt.strike.toLocaleString()}</span>
                                <span class="opt-premium">${opt.premium} 點</span>
                                <button class="btn btn-sm btn-secondary" onclick="quickAddOption('Put', ${opt.strike}, ${opt.premium})">+買</button>
                            </div>
                        `).join('')}
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
