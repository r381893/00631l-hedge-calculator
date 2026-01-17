/**
 * 00631L 避險計算器 - 模擬實驗室 logic
 */

const SimulationModule = (function () {
    // ======== 模擬狀態 ========
    const simState = {
        indexChange: 0,
        daysPassing: 1,
        volChange: 0,
        initialDays: 15, // 假設剩餘天數
        baseIndex: 23000,
        baseVol: 0.20, // 20%
        riskFreeRate: 0.015 // 1.5%
    };

    // ======== Black-Scholes 模型 ========

    // 標準常態分佈累積分佈函數 (CDF)
    function normalCDF(x) {
        var t = 1 / (1 + .2316419 * Math.abs(x));
        var d = .3989423 * Math.exp(-x * x / 2);
        var prob = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (x > 0) prob = 1 - prob;
        return prob;
    }

    /**
     * 計算 Black-Scholes 選擇權價格
     * @param {string} type 'Call' or 'Put'
     * @param {number} S 標的價格 (Spot Price)
     * @param {number} K 履約價 (Strike Price)
     * @param {number} T 到期時間 (年) (Time to Maturity)
     * @param {number} r 無風險利率 (Risk-free Rate)
     * @param {number} sigma 波動率 (Volatility)
     * @returns {number} 選擇權理論價格
     */
    function blackScholes(type, S, K, T, r, sigma) {
        if (T <= 0) {
            // 到期時直接計算內含價值
            return type === 'Call' ? Math.max(0, S - K) : Math.max(0, K - S);
        }

        var d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
        var d2 = d1 - sigma * Math.sqrt(T);

        if (type === 'Call') {
            return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
        } else {
            return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
        }
    }

    // ======== 模擬邏輯 ========

    function init() {
        bindEvents();
        updateDisplay();
    }

    function bindEvents() {
        const indexSlider = document.getElementById('sim-index-change-slider');
        const indexInput = document.getElementById('sim-index-change-input');
        const daysSlider = document.getElementById('sim-days-slider');
        const daysInput = document.getElementById('sim-days-input');
        const initialDaysInput = document.getElementById('sim-initial-days');
        const volSlider = document.getElementById('sim-vol-change-slider');
        const volInput = document.getElementById('sim-vol-change-input');
        const btnReset = document.getElementById('btn-reset-sim');
        const btnOpen = document.getElementById('btn-open-simulation');

        // 同步 Inputs
        function linkInputs(slider, input, key) {
            slider?.addEventListener('input', (e) => {
                input.value = e.target.value;
                simState[key] = parseFloat(e.target.value);
                runSimulation();
            });
            input?.addEventListener('input', (e) => {
                slider.value = e.target.value;
                simState[key] = parseFloat(e.target.value);
                runSimulation();
            });
        }

        linkInputs(indexSlider, indexInput, 'indexChange');
        linkInputs(daysSlider, daysInput, 'daysPassing');
        linkInputs(volSlider, volInput, 'volChange');

        initialDaysInput?.addEventListener('input', (e) => {
            simState.initialDays = parseFloat(e.target.value);
            runSimulation();
        });

        btnReset?.addEventListener('click', () => {
            simState.indexChange = 0;
            simState.daysPassing = 1;
            simState.volChange = 0;

            if (indexSlider) indexSlider.value = 0;
            if (indexInput) indexInput.value = 0;
            if (daysSlider) daysSlider.value = 1;
            if (daysInput) daysInput.value = 1;
            if (volSlider) volSlider.value = 0;
            if (volInput) volInput.value = 0;

            runSimulation();
        });

        // 切換顯示
        btnOpen?.addEventListener('click', () => {
            const card = document.getElementById('simulation-card');
            if (card) {
                card.style.display = 'block';
                card.scrollIntoView({ behavior: 'smooth' });
                // 初始化基準指數為當前指數
                if (state && state.tseIndex) {
                    simState.baseIndex = state.tseIndex;
                    runSimulation();
                }
            }
        });
    }

    function runSimulation() {
        // 從 main app state 獲取當前資訊
        if (typeof state === 'undefined') return;

        const baseIndex = state.tseIndex;
        const projectedIndex = baseIndex + simState.indexChange;

        // 更新 UI 顯示的模擬指數
        const elSimIndex = document.getElementById('sim-projected-index');
        if (elSimIndex) elSimIndex.textContent = projectedIndex.toFixed(0);

        const remainingDays = Math.max(0, simState.initialDays - simState.daysPassing);
        const elRemaining = document.getElementById('sim-remaining-days');
        if (elRemaining) elRemaining.textContent = remainingDays.toFixed(1);

        const currentVol = simState.baseVol;
        const projectedVol = Math.max(0.01, currentVol + (simState.volChange / 100));
        const elVol = document.getElementById('sim-projected-vol');
        if (elVol) elVol.textContent = (projectedVol * 100).toFixed(1) + '%';


        // 1. 計算 ETF 損益
        // 00631L PnL = (NewPrice - CurrentPrice) * Lots * 1000
        // NewPrice = CurrentPrice * (NewIndex / OldIndex)^2
        const etfCurrent = state.etfCurrentPrice;
        const etfLots = state.etfLots;

        let etfNewPrice = etfCurrent;
        if (baseIndex > 0) {
            const ratio = projectedIndex / baseIndex;
            etfNewPrice = etfCurrent * Math.pow(ratio, 2); // 2倍槓桿近似
        }

        const etfPnL = (etfNewPrice - etfCurrent) * etfLots * 1000;


        // 2. 計算選擇權損益
        // 迭代當前策略的所有倉位
        let optPnL = 0;
        const currentStrategyPositions = state.strategies[state.currentStrategy] || [];

        currentStrategyPositions.forEach(pos => {
            // 如果已平倉，使用已實現損益 (假設模擬不改變過去的已實現)
            // 但這裡主要模擬"未平倉部位"的變化。已實現通常是鎖定的。
            // 為了簡單，我們只計算"持倉中"部位的損益變化。

            if (pos.isClosed) return; // 跳過已平倉

            let newPremium = 0;

            if (pos.type === 'Futures' || pos.product === '微台期貨') {
                // 期貨：損益 = (新指數 - 建倉點) * 口數 * 點值
                // 這裡計算的是"模擬後的浮動損益"
                // 模擬情境下的"新"損益 = (ProjectedIndex - Strike) * Loop * Multiplier (Example for Short)
                // 實際上我們要算的是 "Change in PnL" 還是 "Projected Total PnL"? 
                // 使用者想看 "Total Projected PnL".

                // 微台做空： (Strike - ProjectedIndex) * Lots * 10
                newPremium = 0; // 期貨沒有權利金概念，直接算差價損益
                const multiplier = 10;
                let profit = 0;
                if (pos.direction === '賣出') { // Short
                    profit = (pos.strike - projectedIndex) * pos.lots * multiplier;
                } else { // Long
                    profit = (projectedIndex - pos.strike) * pos.lots * multiplier;
                }
                optPnL += profit;

            } else {
                // 選擇權：Black-Scholes
                const T_years = remainingDays / 365.0;
                const theoreticalPrice = blackScholes(
                    pos.type,
                    projectedIndex,
                    pos.strike,
                    T_years,
                    simState.riskFreeRate,
                    projectedVol
                );

                // 計算損益
                // 買進: (NewPrice - Cost) * Lots * 50
                // 賣出: (Cost - NewPrice) * Lots * 50

                const multiplier = 50;
                if (pos.direction === '買進') {
                    optPnL += (theoreticalPrice - pos.premium) * pos.lots * multiplier;
                } else { // 賣出
                    optPnL += (pos.premium - theoreticalPrice) * pos.lots * multiplier;
                }
            }
        });

        // 加上已實現損益 (Fixed)
        const realized = state.realizedPnL[state.currentStrategy] || 0;
        const totalOptPnL = optPnL + realized;

        // 3. 顯示結果
        const totalPnL = etfPnL + totalOptPnL;

        updateResultCard('sim-total-pnl', totalPnL);
        updateResultCard('sim-etf-pnl', etfPnL);
        updateResultCard('sim-opt-pnl', totalOptPnL);

        // 顯示變化 (相對於目前)
        // 目前的損益需從 Main App 取得，或這裡重新計算 indexChange=0 的情況
        // 簡單起見，直接顯示數值即可。
    }

    function updateResultCard(id, value) {
        const el = document.getElementById(id);
        if (!el) return;

        const sign = value >= 0 ? '+' : '';
        const cls = value >= 0 ? 'profit' : 'loss';
        el.textContent = `${sign}${parseInt(value).toLocaleString()}`;
        el.className = `value ${cls}`;
    }

    // 公開 API
    return {
        init,
        runSimulation
    };
})();

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延遲一點初始化以確保主程式 ready
    setTimeout(() => {
        SimulationModule.init();
    }, 1000);
});
