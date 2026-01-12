import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime
import streamlit as st

@st.cache_data
def fetch_data(start_date, end_date):
    print(f"📥 Fetching data from {start_date} to {end_date}...")
    etf_df = yf.download("00631L.TW", start=start_date, end=end_date, progress=False)
    index_df = yf.download("^TWII", start=start_date, end=end_date, progress=False)
    return etf_df, index_df

def run_backtest_engine(initial_capital=1_200_000, ma_period=13, entry_thresholds=[-0.5, -1.0, -1.5], exit_thresholds=[0.5, 1.0, 1.5]):
    # --- 1. Data Fetching ---
    start_date = "2014-01-01"
    end_date = datetime.now().strftime("%Y-%m-%d")
    
    etf_df, index_df = fetch_data(start_date, end_date)
    
    if etf_df.empty or index_df.empty:
        return None, None

    # Align Data
    df = pd.DataFrame(index=etf_df.index)
    df['ETF_Close'] = etf_df['Close']
    df['Index_Close'] = index_df['Close']
    df['Index_Close'] = df['Index_Close'].ffill()
    df = df.dropna()
    
    # --- 2. Strategy Parameters ---
    # Split capital for simulation: 1M ETF, Rest Cash
    initial_etf_capital = 1_000_000 
    initial_cash = initial_capital - initial_etf_capital
    
    hedge_ratios = [0.33, 0.66, 1.0]
    
    # Costs
    futures_comm = 50 
    futures_tax_rate = 2e-5
    etf_comm_rate = 0.001425 * 0.6
    etf_tax_rate = 0.001
    
    # --- 3. Indicators ---
    df['MA'] = df['Index_Close'].rolling(window=ma_period).mean()
    
    # --- 4. Simulation ---
    cash = initial_cash
    current_hedge_qty = 0
    current_hedge_ratio_state = 0.0 
    
    # Buy ETF
    start_price = df['ETF_Close'].iloc[0]
    etf_qty = int(initial_etf_capital / (start_price * (1 + etf_comm_rate)))
    cash_spent = etf_qty * start_price * (1 + etf_comm_rate)
    
    history = []
    
    for i in range(len(df)):
        if i < ma_period:
            continue
            
        date = df.index[i]
        price = df['ETF_Close'].iloc[i]
        idx_close = df['Index_Close'].iloc[i]
        ma = df['MA'].iloc[i]
        
        # Signals
        diff_points = idx_close - ma
        diff_percent = (diff_points / ma) * 100
        
        # --- Hysteresis Logic ---
        # 1. Check Entry (Increase Hedge)
        entry_target = 0.0
        if diff_percent < entry_thresholds[2]: entry_target = hedge_ratios[2] # 1.0
        elif diff_percent < entry_thresholds[1]: entry_target = hedge_ratios[1] # 0.66
        elif diff_percent < entry_thresholds[0]: entry_target = hedge_ratios[0] # 0.33
        
        # 2. Check Exit (Decrease Hedge)
        max_allowed = 1.0
        if diff_percent > exit_thresholds[2]: max_allowed = 0.0 
        elif diff_percent > exit_thresholds[1]: max_allowed = hedge_ratios[0] # 0.33
        elif diff_percent > exit_thresholds[0]: max_allowed = hedge_ratios[1] # 0.66
        
        # Update State
        if entry_target > current_hedge_ratio_state:
            current_hedge_ratio_state = entry_target
        elif max_allowed < current_hedge_ratio_state:
            current_hedge_ratio_state = max_allowed
            
        # Target Qty
        etf_value = etf_qty * price
        exposure = etf_value * 2
        contract_value = idx_close * 10
        
        target_qty = int(round((exposure * current_hedge_ratio_state) / contract_value))
        
        # Trade
        trade_qty = target_qty - current_hedge_qty
        cost = 0
        if trade_qty != 0:
            cost = abs(trade_qty) * futures_comm
            cost += abs(trade_qty) * contract_value * futures_tax_rate
            
        cash -= cost
        
        # Daily Futures PnL
        daily_futures_pnl = 0
        if i > 0:
            prev_idx = df['Index_Close'].iloc[i-1]
            daily_futures_pnl = -1 * current_hedge_qty * (idx_close - prev_idx) * 10
            
        cash += daily_futures_pnl
        current_hedge_qty = target_qty
        
        total_equity = cash + (etf_qty * price)
        
        history.append({
            'Date': date,
            'Equity': total_equity,
            'Hedge_Ratio': current_hedge_ratio_state,
            'Hedge_Qty': current_hedge_qty,
            'Index': idx_close,
            'MA': ma,
            'Diff_Pct': diff_percent,
            'ETF_Price': price
        })
        
    # --- Analysis ---
    res_df = pd.DataFrame(history).set_index('Date')
    
    # Benchmark
    initial_total = initial_capital
    bench_shares = int(initial_total / (start_price * (1 + etf_comm_rate)))
    res_df['Benchmark'] = bench_shares * res_df['ETF_Price']
    
    # Drawdown
    res_df['Peak'] = res_df['Equity'].cummax()
    res_df['DD'] = (res_df['Equity'] - res_df['Peak']) / res_df['Peak']
    
    res_df['Bench_Peak'] = res_df['Benchmark'].cummax()
    res_df['Bench_DD'] = (res_df['Benchmark'] - res_df['Bench_Peak']) / res_df['Bench_Peak']
    
    return res_df, initial_total

if __name__ == "__main__":
    # Test run
    df, init = run_backtest_engine()
    if df is not None:
        print(f"Backtest complete. Final Equity: {df['Equity'].iloc[-1]:.2f}")
