/**
 * 00631L 避險計算器 - 圖表模組
 * 使用 Chart.js 繪製損益曲線
 */

// 全域圖表實例
let pnlChart = null;
let comparisonChart = null;

// Chart.js 預設配置
const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: {
        legend: {
            display: true,
            position: 'top',
            labels: {
                color: '#94a3b8',
                font: {
                    family: "'Noto Sans TC', sans-serif",
                    size: 12
                },
                usePointStyle: true,
                padding: 20
            }
        },
        tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#f1f5f9',
            borderColor: 'rgba(59, 130, 246, 0.5)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: {
                family: "'Noto Sans TC', sans-serif",
                size: 14,
                weight: 'bold'
            },
            bodyFont: {
                family: "'Noto Sans TC', sans-serif",
                size: 13
            },
            callbacks: {
                label: function (context) {
                    const value = context.parsed.y;
                    const formatted = value >= 0
                        ? `+${value.toLocaleString()}`
                        : value.toLocaleString();
                    return `${context.dataset.label}: ${formatted} 元`;
                }
            }
        }
    },
    scales: {
        x: {
            grid: {
                color: 'rgba(148, 163, 184, 0.1)',
                drawBorder: false
            },
            ticks: {
                color: '#94a3b8',
                font: {
                    family: "'Noto Sans TC', sans-serif",
                    size: 11
                },
                callback: function (value, index) {
                    // 只顯示部分標籤避免擁擠
                    if (index % 3 === 0) {
                        return this.getLabelForValue(value);
                    }
                    return '';
                }
            },
            title: {
                display: true,
                text: '結算指數',
                color: '#94a3b8',
                font: {
                    family: "'Noto Sans TC', sans-serif",
                    size: 12
                }
            }
        },
        y: {
            grid: {
                color: 'rgba(148, 163, 184, 0.1)',
                drawBorder: false
            },
            ticks: {
                color: '#94a3b8',
                font: {
                    family: "'Noto Sans TC', sans-serif",
                    size: 11
                },
                callback: function (value) {
                    return value.toLocaleString();
                }
            },
            title: {
                display: true,
                text: '損益 (元)',
                color: '#94a3b8',
                font: {
                    family: "'Noto Sans TC', sans-serif",
                    size: 12
                }
            }
        }
    }
};

/**
 * 初始化損益曲線圖表
 * @param {string} canvasId - Canvas 元素 ID
 */
function initPnLChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // 如果已存在圖表，先銷毀
    if (pnlChart) {
        pnlChart.destroy();
    }

    pnlChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                annotation: {
                    annotations: {}
                }
            }
        }
    });

    return pnlChart;
}

/**
 * 更新損益曲線圖表
 * @param {Object} data - 計算結果
 * @param {number} currentIndex - 當前指數
 * @param {boolean} showETF - 是否顯示 ETF 曲線
 * @param {boolean} showOptions - 是否顯示選擇權曲線
 */
function updatePnLChart(data, currentIndex, showETF = true, showOptions = true) {
    if (!pnlChart) {
        initPnLChart('pnl-chart');
    }

    if (!pnlChart || !data) return;

    const { prices, etfProfits, optionProfits, combinedProfits } = data;

    // 格式化標籤
    const labels = prices.map(p => p.toLocaleString());

    // 建立資料集
    const datasets = [];

    if (showETF && etfProfits.some(v => v !== 0)) {
        datasets.push({
            label: '00631L',
            data: etfProfits,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.1,
            fill: false
        });
    }

    if (showOptions && optionProfits.some(v => v !== 0)) {
        datasets.push({
            label: '選擇權組合',
            data: optionProfits,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.1,
            fill: false
        });
    }

    // 總損益曲線（始終顯示）
    datasets.push({
        label: '組合總損益',
        data: combinedProfits,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.1,
        fill: true
    });

    // 更新圖表
    pnlChart.data.labels = labels;
    pnlChart.data.datasets = datasets;

    // 新增零線標註
    pnlChart.options.plugins.annotation = {
        annotations: {
            zeroLine: {
                type: 'line',
                yMin: 0,
                yMax: 0,
                borderColor: 'rgba(148, 163, 184, 0.5)',
                borderWidth: 1
            },
            currentLine: {
                type: 'line',
                xMin: labels.indexOf(currentIndex.toLocaleString()),
                xMax: labels.indexOf(currentIndex.toLocaleString()),
                borderColor: 'rgba(239, 68, 68, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    display: true,
                    content: '現價',
                    position: 'start',
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    color: 'white',
                    font: {
                        size: 11
                    }
                }
            }
        }
    };

    pnlChart.update('none');
}

/**
 * 更新策略比較圖表
 * @param {Object} comparisonData - 比較結果
 * @param {number} currentIndex - 當前指數
 */
function updateComparisonChart(comparisonData, currentIndex) {
    const ctx = document.getElementById('comparison-chart');
    if (!ctx) return;

    // 如果已存在圖表，先銷毀
    if (comparisonChart) {
        comparisonChart.destroy();
    }

    const { strategyA, strategyB } = comparisonData;

    const labels = strategyA.prices.map(p => p.toLocaleString());

    comparisonChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '策略 A',
                    data: strategyA.combinedProfits,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '策略 B',
                    data: strategyB.combinedProfits,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                title: {
                    display: true,
                    text: '策略損益比較',
                    color: '#f1f5f9',
                    font: {
                        family: "'Noto Sans TC', sans-serif",
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        bottom: 20
                    }
                }
            }
        }
    });
}

/**
 * 銷毀所有圖表
 */
function destroyCharts() {
    if (pnlChart) {
        pnlChart.destroy();
        pnlChart = null;
    }
    if (comparisonChart) {
        comparisonChart.destroy();
        comparisonChart = null;
    }
}

/**
 * 匯出圖表為圖片
 * @param {string} chartId - 圖表 ID
 * @returns {string} Base64 圖片資料
 */
function exportChartAsImage(chartId) {
    let chart = null;
    if (chartId === 'pnl-chart') {
        chart = pnlChart;
    } else if (chartId === 'comparison-chart') {
        chart = comparisonChart;
    }

    if (!chart) return null;

    return chart.toBase64Image('image/png', 1);
}

// 匯出模組
window.ChartModule = {
    initPnLChart,
    updatePnLChart,
    updateComparisonChart,
    destroyCharts,
    exportChartAsImage
};
