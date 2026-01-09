/**
 * 00631L 避險計算器 - 圖表模組
 * 使用 Chart.js 繪製損益曲線
 */

// 全域圖表實例
let pnlChart = null;
// comparisonChart 已移除（比較功能現整合於 pnlChart）

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
                title: function (context) {
                    const y = context[0].parsed.y;
                    return `結算指數: ${y.toLocaleString()}`;
                },
                label: function (context) {
                    const value = context.parsed.x;
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
                callback: function (value, index) {
                    // 只顯示部分標籤避免擁擠
                    if (index % 2 === 0) {
                        return value.toLocaleString();
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
        type: 'scatter',
        data: {
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
 * 更新損益曲線圖表 (支援 A/B 比較)
 * X軸 = 損益（元），Y軸 = 結算指數
 * @param {Object} data - 策略 A 計算結果
 * @param {number} currentIndex - 當前指數
 * @param {boolean} showETF - 是否顯示 ETF 曲線
 * @param {boolean} showOptions - 是否顯示選擇權曲線
 * @param {Object} dataB - 策略 B 計算結果 (選填)
 */
function updatePnLChart(data, currentIndex, showETF = true, showOptions = true, dataB = null, dataC = null) {
    if (!pnlChart) {
        initPnLChart('pnl-chart');
    }

    if (!pnlChart || !data) return;

    const { prices, etfProfits, optionProfits, combinedProfits } = data;

    // 轉換為 scatter 格式：{x: 損益, y: 指數}
    const toScatterData = (profits) => {
        return prices.map((price, i) => ({ x: profits[i], y: price }));
    };

    // 建立資料集
    const datasets = [];

    // 只有在沒有比較資料時才顯示 ETF 和選擇權個別曲線，以免圖表太亂
    if (!dataB && !dataC) {
        if (showETF && etfProfits.some(v => v !== 0)) {
            datasets.push({
                label: '00631L',
                data: toScatterData(etfProfits),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.1,
                fill: false,
                showLine: true
            });
        }

        if (showOptions && optionProfits.some(v => v !== 0)) {
            datasets.push({
                label: '選擇權',
                data: toScatterData(optionProfits),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.1,
                fill: false,
                showLine: true
            });
        }
    }

    // 策略 A 總損益
    datasets.push({
        label: (dataB || dataC) ? '策略 A 損益' : '組合總損益',
        data: toScatterData(combinedProfits),
        borderColor: '#ef4444', // 红色
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.1,
        fill: (!dataB && !dataC), // 如果有比較，就不填滿背景
        showLine: true
    });

    // 策略 B 總損益 (如果有)
    if (dataB) {
        datasets.push({
            label: '策略 B 損益',
            data: toScatterData(dataB.combinedProfits),
            borderColor: '#3b82f6', // 藍色
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            borderDash: [5, 5], // 虛線
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0.1,
            fill: false,
            showLine: true
        });
    }

    // 策略 C 總損益 (如果有)
    if (dataC) {
        datasets.push({
            label: '策略 C 損益',
            data: toScatterData(dataC.combinedProfits),
            borderColor: '#69f0ae', // 綠色
            backgroundColor: 'rgba(105, 240, 174, 0.1)',
            borderWidth: 3,
            borderDash: [5, 5], // 虛線
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0.1,
            fill: false,
            showLine: true
        });
    }

    // 更新圖表
    pnlChart.data.datasets = datasets;

    // 新增標註線（X=0 零線 和 Y=現價 水平線）
    pnlChart.options.plugins.annotation = {
        annotations: {
            zeroLine: {
                type: 'line',
                xMin: 0,
                xMax: 0,
                borderColor: 'rgba(148, 163, 184, 0.5)',
                borderWidth: 1
            },
            currentLine: {
                type: 'line',
                yMin: currentIndex,
                yMax: currentIndex,
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

// updateComparisonChart 已移除（新版比較功能整合於 updatePnLChart）

/**
 * 銷毀所有圖表
 */
function destroyCharts() {
    if (pnlChart) {
        pnlChart.destroy();
        pnlChart = null;
    }
}

/**
 * 匯出圖表為圖片
 * @param {string} chartId - 圖表 ID
 * @returns {string} Base64 圖片資料
 */
function exportChartAsImage(chartId) {
    if (chartId === 'pnl-chart' && pnlChart) {
        return pnlChart.toBase64Image('image/png', 1);
    }
    return null;
}

// 匯出模組
window.ChartModule = {
    initPnLChart,
    updatePnLChart,
    destroyCharts,
    exportChartAsImage
};
