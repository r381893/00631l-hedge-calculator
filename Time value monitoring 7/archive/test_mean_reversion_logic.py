import pandas as pd
import numpy as np
import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

from mean_reversion_service import MeanReversionStrategy

def test_indicators():
    print("Testing Indicators...")
    # Create fake DF
    dates = pd.date_range(start='2024-01-01', periods=100)
    prices = [15000 + i*10 + np.random.normal(0, 50) for i in range(100)]
    df = pd.DataFrame({'Date': dates, 'Close': prices, 'High': prices, 'Low': prices})
    
    df_res = MeanReversionStrategy.calculate_indicators(df, ma_period=10)
    
    if 'MA' in df_res.columns and 'ATR' in df_res.columns:
        print("[OK] Indicators calculated successfully")
        print(f"Last MA: {df_res['MA'].iloc[-1]:.2f}")
    else:
        print("[FAIL] Indicators missing")

def test_signals():
    print("\nTesting Signal Logic...")
    
    config = {
        'grid_gap': 100,
        'take_profit': 100,
        'max_positions': 5
    }
    
    ma = 15000
    
    # Test 1: Price Drops below MA -> BUY
    price = 14800 # 15000 - 200
    res = MeanReversionStrategy.evaluate_signal(price, ma, [], config)
    print(f"Test 1 (Drop): {res['action']} - Expect BUY")
    assert res['action'] == 'BUY'
    
    # Test 2: Price Rises -> HOLD (No positions)
    price = 15100
    res = MeanReversionStrategy.evaluate_signal(price, ma, [], config)
    print(f"Test 2 (Rise): {res['action']} - Expect HOLD")
    assert res['action'] == 'HOLD'
    
    # Test 3: Have position, price drops more -> BUY (Add)
    positions = [{'price': 14800, 'qty': 1}]
    price = 14600 # 14800 - 200 (Gap > 100)
    res = MeanReversionStrategy.evaluate_signal(price, ma, positions, config)
    print(f"Test 3 (Add): {res['action']} - Expect BUY")
    assert res['action'] == 'BUY'
    
    # Test 4: Have position, price rises -> SELL (Take Profit)
    positions = [{'price': 14800, 'qty': 1}]
    price = 15000 # 14800 + 200 (TP > 100)
    res = MeanReversionStrategy.evaluate_signal(price, ma, positions, config)
    print(f"Test 4 (Profit): {res['action']} - Expect SELL")
    assert res['action'] == 'SELL'

if __name__ == "__main__":
    test_indicators()
    test_signals()
