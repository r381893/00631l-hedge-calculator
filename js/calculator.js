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


    // 使用複利模型 (Power Law) 計算槓桿效應
    // P_new = P_current * (Index_new / Index_base) ^ Leverage
    // 這能反映出隨價格上漲，曝險增加 (Gamma) 的特性，使 Delta 隨指數變化
    const indexRatio = indexPrice / baseIndex;
    const powerRatio = Math.pow(indexRatio, CONSTANTS.LEVERAGE_00631L);

    const newETFPrice = etfCurrent * powerRatio;

    // 計算損益 = (新價格 - 成本) × 股數
    const shares = etfLots * CONSTANTS.ETF_SHARES_PER_LOT;
    return (newETFPrice - etfCost) * shares;
}

/**
 * 計算已平倉部位的已實現損益
 * @param {Object} position - 倉位資料
 * @param {number} closePrice - 平倉價格
 * @returns {number} 損益金額（台幣）
 */
function calcRealizedPnL(position, closePrice) {
    if (!closePrice || isNaN(closePrice)) return 0;

    const { strike, lots, premium = 0, product = '台指', type, direction } = position;
    const isFutures = product === '微台期貨' || type === 'Futures';

    if (isFutures) {
        // 微台期貨損益計算（做空）
        // 損益 = (進場價 - 平倉價) × 口數 × 10元
        return (strike - closePrice) * lots * CONSTANTS.MICRO_OPTION_MULTIPLIER;
    } else {
        // 選擇權損益計算
        const multiplier = product === '微台'
            ? CONSTANTS.MICRO_OPTION_MULTIPLIER
            : CONSTANTS.OPTION_MULTIPLIER;

        // 買進: (平倉價 - 權利金) * ...
        // 賣出: (權利金 - 平倉價) * ...
        if (direction === '買進') {
            return (closePrice - premium) * lots * multiplier;
        } else { // 賣出
            return (premium - closePrice) * lots * multiplier;
        }
    }
}

/**
 * 計算整個策略組合在價格範圍內的損益
 * @param {Object} params - 計算參數
 * @returns {Object} 包含各價位損益陣列的物件
 */
function calculatePnLCurve(params) {
    const {
        centerPrice,    // 當前指數 (Simulation Center)
        referenceIndex, // 基準指數 (Base Index for ETF PnL) - Optional
        priceRange,     // 模擬範圍
        etfLots,        // ETF 張數
        etfCost,        // ETF 成本
        etfCurrent,     // ETF 現價
        positions       // 選擇權/期貨倉位陣列
    } = params;

    const baseIndex = referenceIndex || centerPrice; // Default to centerPrice if no reference provided

    const prices = [];
    const etfProfits = [];
    const optionProfits = [];
    const combinedProfits = [];

    // 產生價格範圍
    for (let offset = -priceRange; offset <= priceRange; offset += CONSTANTS.PRICE_STEP) {
        const price = centerPrice + offset;
        prices.push(price);

        // ETF 損益 (Use baseIndex)
        const etfPnL = calcETFPnL(price, baseIndex, etfLots, etfCost, etfCurrent);
        etfProfits.push(etfPnL);

        // 倉位組合損益
        let optPnL = 0;
        for (const pos of positions) {
            // 如果已平倉，加總已實現損益 (對所有模擬價格皆為常數)
            if (pos.isClosed && pos.closePrice !== undefined) {
                optPnL += calcRealizedPnL(pos, pos.closePrice);
            }
            // 未平倉且有口數，計算模擬損益
            else if (pos.lots > 0) {
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

// ======== Black-Scholes Implementations ========

/**
 * Normal Distribution Probability Density Function (PDF)
 */
function probabilityDensity(x) {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/**
 * Normal Distribution Cumulative Distribution Function (CDF)
 */
function cumulativeDistribution(x) {
    var sign = 1.0;
    if (x < 0) {
        sign = -1.0;
        x = -x;
    }
    x = 1.0 / (1.0 + 0.2316419 * x);
    var y = 1.0 - probabilityDensity(x / sign) * (
        0.319381530 * x +
        -0.356563782 * x * x +
        1.781477937 * x * x * x +
        -1.821255978 * x * x * x * x +
        1.330274429 * x * x * x * x * x
    );
    return sign < 0 ? 1.0 - y : y;
}

/**
 * Calculate Option Theta using Black-Scholes Model
 * @param {number} S - Current Underlying Price
 * @param {number} K - Strike Price
 * @param {number} T - Time to Expiration (in years)
 * @param {number} r - Risk-free Interest Rate (annual, e.g., 0.01 for 1%)
 * @param {number} sigma - Volatility (annual, e.g., 0.2 for 20%)
 * @param {string} type - 'Call' or 'Put'
 * @returns {number} Daily Theta (Price change per day)
 */
function calculateBSTheta(S, K, T, r, sigma, type) {
    if (T <= 0) return 0;

    // Validate inputs to prevent NaN
    if (S <= 0 || K <= 0 || sigma < 0) return 0;

    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;

    const pdfD1 = probabilityDensity(d1);
    const cdfD2 = cumulativeDistribution(d2);
    const cdfNegD2 = cumulativeDistribution(-d2);

    let thetaAnnual = 0;

    // First term common to both
    const term1 = -(S * pdfD1 * sigma) / (2 * sqrtT);

    if (type === 'Call') {
        const term2 = r * K * Math.exp(-r * T) * cdfD2;
        thetaAnnual = term1 - term2;
    } else { // Put
        const term2 = r * K * Math.exp(-r * T) * cdfNegD2;
        thetaAnnual = term1 + term2;
    }

    // Convert to Daily Theta (divide by 365)
    return thetaAnnual / 365;
}

/**
 * Calculate Portfolio Theta
 * @param {Array} positions - List of option positions
 * @param {number} indexPrice - Current Index Price
 * @param {number} daysToExpiry - Days remaining until expiration
 * @param {number} volatility - Annual Volatility (e.g., 0.20 for 20%), default 20%
 * @param {number} riskFreeRate - Annual Risk-Free Rate, default 1.5%
 * @returns {number} Total Portfolio Theta (Daily PnL Decay)
 */
function calculatePortfolioTheta(positions, indexPrice, daysToExpiry, volatility = 0.2, riskFreeRate = 0.015) {
    if (!positions || positions.length === 0) return 0;

    // Convert days to years
    const T = Math.max(daysToExpiry, 0.5) / 365; // Avoid T=0, use 0.5 day as min

    let totalThetaPnL = 0;

    for (const pos of positions) {
        // Skip ETF or closed positions
        if (pos.product !== '台指' && pos.product !== '微台' && pos.type !== 'Call' && pos.type !== 'Put') continue;
        if (pos.isClosed || pos.lots <= 0) continue;

        const isMicro = pos.product === '微台';
        const multiplier = isMicro ? CONSTANTS.MICRO_OPTION_MULTIPLIER : CONSTANTS.OPTION_MULTIPLIER;
        const type = pos.type; // 'Call' or 'Put'
        const strike = parseFloat(pos.strike);

        // Calculate Unit Theta (Price change per day)
        const unitTheta = calculateBSTheta(indexPrice, strike, T, riskFreeRate, volatility, type);

        // Theta PnL = Unit Theta * Multiplier * Lots * Direction
        // If Buy (Long): Theta is negative (you lose value). Direction 1.
        // If Sell (Short): Theta is positive (you gain value). Direction -1.
        // However, BS Theta is typically negative for Long positions.
        // My BS formula returns the negative number.
        // So Long: (-Theta) * Lots * Mult.
        // Short: -(-Theta) * Lots * Mult = Positive.

        const directionMult = pos.direction === '買進' ? 1 : -1;
        const thetaValue = unitTheta * multiplier * pos.lots * directionMult;

        totalThetaPnL += thetaValue;
    }

    return totalThetaPnL;
}

// 匯出模組
window.Calculator = {
    CONSTANTS,
    calcPositionPnL,
    calcRealizedPnL,
    calcETFPnL,
    calculatePnLCurve,
    calculatePremiumSummary,
    calculateETFSummary,
    compareStrategies,
    findBreakeven,
    recommendStrategies,
    parseYahooOptionCSV,
    calculatePortfolioTheta // New function
};
