/**
 * 00631L 避險計算器 - 損益計算引擎
 * 移植自 Streamlit app.py
 */

// ======== 常數設定 ========
const CONSTANTS = {
    OPTION_MULTIPLIER: 50,        // 台指選擇權每點 50 元
    MICRO_OPTION_MULTIPLIER: 10,  // 微台期貨每點 10 元
    ETF_SHARES_PER_LOT: 1000,     // 1張 = 1000股
    LEVERAGE_00631L: 2,           // 00631L 為 2 倍槓桿 ETF
    PRICE_STEP: 100               // 價格步進
};

/**
 * 計算單一選擇權/期貨倉位的損益
 * @param {Object} position - 倉位資料
 * @param {number} settlementPrice - 結算價
 * @returns {number} 損益金額（台幣）
 */
function calcPositionPnL(position, settlementPrice) {
    const { strike, lots, premium = 0, product = '台指', type, direction } = position;
    
    // 判斷是否為期貨
    const isFutures = product === '微台期貨' || type === 'Futures';
    
    if (isFutures) {
        // 微台期貨損益計算（做空）
        // 做空損益 = (進場價 - 結算價) × 口數 × 10元
        return (strike - settlementPrice) * lots * CONSTANTS.MICRO_OPTION_MULTIPLIER;
    } else {
        // 選擇權損益計算
        const multiplier = product === '微台' 
            ? CONSTANTS.MICRO_OPTION_MULTIPLIER 
            : CONSTANTS.OPTION_MULTIPLIER;
        
        // 計算內含價值
        let intrinsic = 0;
        if (type === 'Call') {
            intrinsic = Math.max(0, settlementPrice - strike);
        } else { // Put
            intrinsic = Math.max(0, strike - settlementPrice);
        }
        
        // 計算損益 = (內含價值 - 權利金) × 口數 × 乘數
        if (direction === '買進') {
            return (intrinsic - premium) * lots * multiplier;
        } else { // 賣出
            return (premium - intrinsic) * lots * multiplier;
        }
    }
}

/**
 * 計算 00631L 在不同指數價位下的損益
 * @param {number} indexPrice - 目標指數價位
 * @param {number} baseIndex - 當前指數（基準）
 * @param {number} etfLots - 持有張數
 * @param {number} etfCost - 平均成本
 * @param {number} etfCurrent - 現價
 * @returns {number} 損益金額（台幣）
 */
function calcETFPnL(indexPrice, baseIndex, etfLots, etfCost, etfCurrent) {
    if (etfLots <= 0 || baseIndex <= 0) {
        return 0;
    }
    
    // 指數變動比例
    const indexChangePct = (indexPrice - baseIndex) / baseIndex;
    
    // 00631L 是 2 倍槓桿，價格變動 = 指數變動 × 2
    const etfPriceChangePct = indexChangePct * CONSTANTS.LEVERAGE_00631L;
    
    // 新的 ETF 價格
    const newETFPrice = etfCurrent * (1 + etfPriceChangePct);
    
    // 計算損益 = (新價格 - 成本) × 股數
    const shares = etfLots * CONSTANTS.ETF_SHARES_PER_LOT;
    return (newETFPrice - etfCost) * shares;
}

/**
 * 計算整個策略組合在價格範圍內的損益
 * @param {Object} params - 計算參數
 * @returns {Object} 包含各價位損益陣列的物件
 */
function calculatePnLCurve(params) {
    const { 
        centerPrice,    // 當前指數
        priceRange,     // 模擬範圍
        etfLots,        // ETF 張數
        etfCost,        // ETF 成本
        etfCurrent,     // ETF 現價
        positions       // 選擇權/期貨倉位陣列
    } = params;
    
    const prices = [];
    const etfProfits = [];
    const optionProfits = [];
    const combinedProfits = [];
    
    // 產生價格範圍
    for (let offset = -priceRange; offset <= priceRange; offset += CONSTANTS.PRICE_STEP) {
        const price = centerPrice + offset;
        prices.push(price);
        
        // ETF 損益
        const etfPnL = calcETFPnL(price, centerPrice, etfLots, etfCost, etfCurrent);
        etfProfits.push(etfPnL);
        
        // 倉位組合損益
        let optPnL = 0;
        for (const pos of positions) {
            if (pos.lots > 0) {
                optPnL += calcPositionPnL(pos, price);
            }
        }
        optionProfits.push(optPnL);
        
        // 總損益
        combinedProfits.push(etfPnL + optPnL);
    }
    
    return {
        prices,
        etfProfits,
        optionProfits,
        combinedProfits
    };
}

/**
 * 計算權利金收支
 * @param {Array} positions - 倉位陣列
 * @returns {Object} 權利金收支統計
 */
function calculatePremiumSummary(positions) {
    let totalPremiumIn = 0;   // 收入（賣出）
    let totalPremiumOut = 0;  // 支出（買進）
    
    for (const pos of positions) {
        if (pos.type === 'Futures' || pos.product === '微台期貨') {
            continue; // 期貨沒有權利金
        }
        
        const multiplier = pos.product === '微台' 
            ? CONSTANTS.MICRO_OPTION_MULTIPLIER 
            : CONSTANTS.OPTION_MULTIPLIER;
        
        const premiumValue = pos.premium * pos.lots * multiplier;
        
        if (pos.direction === '賣出') {
            totalPremiumIn += premiumValue;
        } else {
            totalPremiumOut += premiumValue;
        }
    }
    
    return {
        premiumIn: totalPremiumIn,
        premiumOut: totalPremiumOut,
        netPremium: totalPremiumIn - totalPremiumOut
    };
}

/**
 * 計算 ETF 庫存摘要
 * @param {Object} params - 參數
 * @returns {Object} 庫存摘要
 */
function calculateETFSummary(params) {
    const { etfLots, etfCost, etfCurrent } = params;
    
    if (etfLots <= 0) {
        return null;
    }
    
    const shares = etfLots * CONSTANTS.ETF_SHARES_PER_LOT;
    const marketValue = shares * etfCurrent;
    const costValue = shares * etfCost;
    const unrealizedPnL = marketValue - costValue;
    const pnlPercent = costValue > 0 ? (unrealizedPnL / costValue) * 100 : 0;
    
    return {
        lots: etfLots,
        shares,
        marketValue,
        costValue,
        unrealizedPnL,
        pnlPercent
    };
}

/**
 * 比較兩套策略
 * @param {Object} strategyA - 策略 A 參數
 * @param {Object} strategyB - 策略 B 參數
 * @param {Object} commonParams - 共同參數（centerPrice, priceRange, etf 資料）
 * @returns {Object} 比較結果
 */
function compareStrategies(strategyA, strategyB, commonParams) {
    const { centerPrice, priceRange, etfLots, etfCost, etfCurrent } = commonParams;
    
    // 計算策略 A 損益曲線
    const resultA = calculatePnLCurve({
        centerPrice,
        priceRange,
        etfLots,
        etfCost,
        etfCurrent,
        positions: strategyA.positions
    });
    
    // 計算策略 B 損益曲線
    const resultB = calculatePnLCurve({
        centerPrice,
        priceRange,
        etfLots,
        etfCost,
        etfCurrent,
        positions: strategyB.positions
    });
    
    // 計算各策略的關鍵指標
    const analyzeStrategy = (result) => {
        const profits = result.combinedProfits;
        return {
            maxProfit: Math.max(...profits),
            maxLoss: Math.min(...profits),
            breakeven: findBreakeven(result.prices, profits),
            profitAtCurrent: profits[Math.floor(profits.length / 2)]
        };
    };
    
    return {
        strategyA: {
            ...resultA,
            analysis: analyzeStrategy(resultA)
        },
        strategyB: {
            ...resultB,
            analysis: analyzeStrategy(resultB)
        }
    };
}

/**
 * 找出損益兩平點
 * @param {Array} prices - 價格陣列
 * @param {Array} profits - 損益陣列
 * @returns {Array} 損益兩平點陣列
 */
function findBreakeven(prices, profits) {
    const breakevens = [];
    
    for (let i = 1; i < profits.length; i++) {
        const prev = profits[i - 1];
        const curr = profits[i];
        
        // 檢查是否跨越零點
        if ((prev <= 0 && curr >= 0) || (prev >= 0 && curr <= 0)) {
            // 線性內插找出確切的兩平點
            const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
            const breakeven = prices[i - 1] + ratio * (prices[i] - prices[i - 1]);
            breakevens.push(Math.round(breakeven));
        }
    }
    
    return breakevens;
}

/**
 * 自動策略推薦 - 分析選擇權資料並建議避險策略
 * @param {Object} params - 參數
 * @returns {Array} 推薦策略列表
 */
function recommendStrategies(params) {
    const { 
        etfLots,
        etfCost,
        etfCurrent,
        hedgeRatio,
        currentIndex,
        optionData // Yahoo 選擇權資料
    } = params;
    
    if (!optionData || optionData.length === 0) {
        return [];
    }
    
    const recommendations = [];
    const suggestedLots = Math.round(etfLots * hedgeRatio);
    
    // 1. 保護性賣權 (Protective Put)
    // 找出價外賣權（履約價略低於現價）
    const puts = optionData.filter(opt => opt.type === 'Put' && opt.strike < currentIndex);
    const protectivePuts = puts
        .sort((a, b) => b.strike - a.strike)
        .slice(0, 3);
    
    if (protectivePuts.length > 0) {
        recommendations.push({
            name: '保護性賣權 (Protective Put)',
            description: '買入賣權保護下檔風險',
            positions: protectivePuts.map(put => ({
                product: '台指',
                type: 'Put',
                direction: '買進',
                strike: put.strike,
                lots: suggestedLots,
                premium: put.premium
            })),
            risk: '最大損失 = 權利金支出',
            benefit: '完全保護下檔，保留上漲獲利'
        });
    }
    
    // 2. 領口策略 (Collar)
    // 買賣權 + 賣買權
    const calls = optionData.filter(opt => opt.type === 'Call' && opt.strike > currentIndex);
    const otmCalls = calls.sort((a, b) => a.strike - b.strike).slice(0, 3);
    
    if (protectivePuts.length > 0 && otmCalls.length > 0) {
        recommendations.push({
            name: '領口策略 (Collar)',
            description: '買賣權保護 + 賣買權降低成本',
            positions: [
                {
                    product: '台指',
                    type: 'Put',
                    direction: '買進',
                    strike: protectivePuts[0].strike,
                    lots: suggestedLots,
                    premium: protectivePuts[0].premium
                },
                {
                    product: '台指',
                    type: 'Call',
                    direction: '賣出',
                    strike: otmCalls[0].strike,
                    lots: suggestedLots,
                    premium: otmCalls[0].premium
                }
            ],
            risk: '限制上漲獲利空間',
            benefit: '低成本或零成本避險'
        });
    }
    
    // 3. 賣權價差 (Put Spread)
    if (puts.length >= 2) {
        const sortedPuts = puts.sort((a, b) => b.strike - a.strike);
        recommendations.push({
            name: '熊市價差 (Bear Put Spread)',
            description: '買高履約價賣權 + 賣低履約價賣權',
            positions: [
                {
                    product: '台指',
                    type: 'Put',
                    direction: '買進',
                    strike: sortedPuts[0].strike,
                    lots: suggestedLots,
                    premium: sortedPuts[0].premium
                },
                {
                    product: '台指',
                    type: 'Put',
                    direction: '賣出',
                    strike: sortedPuts[2]?.strike || sortedPuts[1].strike,
                    lots: suggestedLots,
                    premium: sortedPuts[2]?.premium || sortedPuts[1].premium
                }
            ],
            risk: '有限風險，有限獲利',
            benefit: '成本較低的避險方式'
        });
    }
    
    return recommendations;
}

/**
 * 解析 Yahoo CSV 選擇權資料
 * @param {string} csvText - CSV 文字內容
 * @returns {Array} 解析後的選擇權資料
 */
function parseYahooOptionCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const options = [];
    
    // 跳過標題行
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 5) continue;
        
        // 假設格式：履約價, 類型(C/P), 買價, 賣價, 成交價
        const strike = parseFloat(cols[0]);
        const type = cols[1].toUpperCase().includes('C') ? 'Call' : 'Put';
        const bid = parseFloat(cols[2]) || 0;
        const ask = parseFloat(cols[3]) || 0;
        const last = parseFloat(cols[4]) || 0;
        
        // 使用中間價或最後成交價
        const premium = last > 0 ? last : (bid + ask) / 2;
        
        if (!isNaN(strike) && premium > 0) {
            options.push({ strike, type, premium, bid, ask, last });
        }
    }
    
    return options;
}

// 匯出模組
window.Calculator = {
    CONSTANTS,
    calcPositionPnL,
    calcETFPnL,
    calculatePnLCurve,
    calculatePremiumSummary,
    calculateETFSummary,
    compareStrategies,
    findBreakeven,
    recommendStrategies,
    parseYahooOptionCSV
};
