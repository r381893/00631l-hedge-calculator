import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def calculate_atr(df, period=14):
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    return true_range.rolling(period).mean()

def simulate_grid_strategy(df, grid_gap, take_profit_points, initial_capital=1000000):
    """
    Simulate a simple grid buying strategy.
    Buy 1 unit when price drops by grid_gap from the last entry price (or initial ref price).
    Sell when price rises by take_profit_points from the entry price.
    """
    cash = initial_capital
    positions = [] # List of buy prices
    total_pnl = 0
    
    # Use a moving average as a baseline for "mean"
    df['MA60'] = df['Close'].rolling(window=60).mean()
    
    # Start simulation from where we have MA
    sim_data = df.dropna().copy()
    
    trade_log = []
    max_drawdown = 0
    
    # Initial reference price (could be MA or previous close)
    last_ref_price = sim_data.iloc[0]['Close']
    
    for index, row in sim_data.iterrows():
        current_price = row['Close']
        
        # Check for Sells (Take Profit)
        # Iterate backwards to remove items safely
        for i in range(len(positions) - 1, -1, -1):
            buy_price = positions[i]
            if current_price >= buy_price + take_profit_points:
                # Sell!
                pnl = (current_price - buy_price) * 50 # Micro Tai is 50 TWD per point
                total_pnl += pnl
                positions.pop(i)
                trade_log.append(f"SELL at {current_price:.0f}, Buy was {buy_price:.0f}, PnL: {pnl}")
        
        # Check for Buys (Grid Entry)
        # If no positions, buy if price is below MA by grid_gap (Mean Reversion logic)
        # If positions exist, buy if price drops grid_gap below last buy price
        
        should_buy = False
        if len(positions) == 0:
            # First entry logic: Price is significantly below Mean (MA60)
            if current_price < row['MA60'] - grid_gap:
                should_buy = True
        else:
            # Add to position logic: Price drops another grid_gap from lowest buy
            last_buy_price = min(positions)
            if current_price < last_buy_price - grid_gap:
                should_buy = True
                
        if should_buy:
            positions.append(current_price)
            trade_log.append(f"BUY at {current_price:.0f}")
            
        # Calculate Floating PnL for Drawdown
        floating_pnl = sum([(current_price - p) * 50 for p in positions])
        if floating_pnl < max_drawdown:
            max_drawdown = floating_pnl

    return {
        'grid_gap': grid_gap,
        'total_pnl': total_pnl,
        'max_drawdown': max_drawdown,
        'final_positions': len(positions),
        'trade_count': len(trade_log)
    }

def main():
    print("下載台股大盤資料中 (Download TAIEX data)...")
    # TAIEX index
    ticker = "^TWII" 
    df = yf.download(ticker, period="2y", interval="1d")
    
    if df.empty:
        print("無法取得資料，請檢查網路或代號 (No data found).")
        return

    # Flatten MultiIndex columns if present (yfinance update)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # Calculate Volatility Metrics
    df['ATR'] = calculate_atr(df)
    df['StdDev'] = df['Close'].rolling(20).std()
    
    current_atr = df['ATR'].iloc[-1]
    current_std = df['StdDev'].iloc[-1]
    current_price = df['Close'].iloc[-1]
    
    print(f"\n=== 市場波動度分析 (Market Volatility Analysis) ===")
    print(f"目前大盤指數 (Current Index): {current_price:.0f}")
    print(f"平均真實波幅 (ATR, 14日): {current_atr:.0f} 點")
    print(f"標準差 (StdDev, 20日): {current_std:.0f} 點")
    print(f"建議網格間距 (1.0 ATR): ~{current_atr:.0f} 點")
    print(f"建議網格間距 (2.0 StdDev): ~{current_std * 2:.0f} 點")
    
    print(f"\n=== 歷史回測模擬 (Historical Backtest Simulation) ===")
    print("假設策略：跌破60MA後開始承接，每跌 X 點買一口微台 (50元/點)，反彈 X 點獲利平倉")
    print("(Simulating: Buy Micro Tai when price drops X points below 60MA, add every X points drop. Sell on X points rebound.)")
    
    # Test different grid gaps
    gaps_to_test = [100, 150, 200, 250, 300, 400, 500]
    results = []
    
    print(f"{'間距 (Gap)':<10} | {'總損益 (PnL)':<15} | {'最大浮虧 (Max DD)':<15} | {'交易次數 (Trades)':<10}")
    print("-" * 60)
    
    for gap in gaps_to_test:
        res = simulate_grid_strategy(df, grid_gap=gap, take_profit_points=gap)
        results.append(res)
        print(f"{res['grid_gap']:<10} | {res['total_pnl']:<15.0f} | {res['max_drawdown']:<15.0f} | {res['trade_count']:<10}")

    # Find best parameter by PnL / Drawdown ratio (Calmar-like)
    best_res = sorted(results, key=lambda x: x['total_pnl'], reverse=True)[0]
    print(f"\n歷史最佳間距 (Best Historical Gap): {best_res['grid_gap']} 點")
    print(f"注意：最大浮虧曾達到 {best_res['max_drawdown']:.0f} 元，請確保保證金足夠。")

if __name__ == "__main__":
    main()
