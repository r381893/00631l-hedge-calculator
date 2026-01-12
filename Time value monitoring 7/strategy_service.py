import pandas as pd

def calculate_hedge_signal(
    current_index: float,
    ma_value: float,
    etf_qty: int,
    current_mxf_qty: int,
    config: dict
) -> dict:
    """
    Calculate hedging signal based on deviation from MA.
    
    Args:
        current_index: Current market index (or proxy)
        ma_value: Moving Average value
        etf_qty: Number of 00631L shares (e.g., 50)
        current_mxf_qty: Current Short position in MXF (positive int means shorting X contracts)
                         Wait, usually we track position as net. 
                         If Short 1, position is -1. 
                         But the UI logic seemed to treat 'current_mxf_qty' as absolute count of shorts?
                         Let's standardize: Input 'current_position_net' (Short is negative).
                         
                         Re-reading app.py logic:
                         "目前: {current_mxf_qty} 口"
                         And "Short" action means "Need more hedge".
                         
                         Let's stick to the app's logic for now but clean it up.
                         Let's assume input `current_short_qty` (positive integer representing short contracts).
        config: Dictionary containing thresholds and ratios
                {
                    'hedge_threshold_1': 2.0, 'hedge_ratio_1': 0.25,
                    'hedge_threshold_2': 4.0, 'hedge_ratio_2': 0.50,
                    'hedge_threshold_3': 6.0, 'hedge_ratio_3': 1.00,
                    'rebound_threshold_1': 1.5, ...
                }
    
    Returns:
        dict: {
            'action': 'Short' | 'Cover' | 'Hold',
            'quantity': int, # Number of contracts to trade
            'target_qty': int, # Target total short position
            'reason': str,
            'detail': dict # Calculation details for UI
        }
    """
    
    # 1. Calculate Deviation
    diff_points = current_index - ma_value
    diff_percent = (diff_points / ma_value) * 100
    
    # 2. Calculate Exposure & Target Hedge
    # 00631L is 2x leverage. 1 share ~ approx exposure. 
    # But precise calc: ETF Price * Qty * 2? 
    # In app.py: exposure_value = etf_market_value * 2 (roughly)
    # But here we just need the ratio logic.
    # The app uses a simplified "Hedge Ratio" applied to "Full Hedge Qty".
    # Full Hedge Qty = (ETF Qty * 2 * ETF Price) / (Index * 50) ?
    # Actually app.py logic seems to be:
    # target_hedge_ratio determined by diff_percent.
    # target_qty = (Total Exposure / Contract Value) * target_hedge_ratio
    
    # We need ETF Price to calculate exposure accurately.
    # Let's add etf_price to inputs.
    pass

def calculate_strategy_state(
    current_index: float,
    ma_value: float,
    etf_qty: int,
    etf_price: float,
    current_short_qty: int, # Positive value for short contracts
    settings: dict
) -> dict:
    """
    Pure function to determine strategy state and required action.
    """
    
    # 1. Market Status
    diff_points = current_index - ma_value
    diff_percent = (diff_points / ma_value) * 100
    
    # 2. Determine Target Hedge Ratio based on Deviation
    # Logic from app.py
    target_hedge_ratio = 0.0
    hedge_status = "正常 (Normal)"
    
    # Unpack settings
    h1 = settings.get('hedge_threshold_1', 2.0)
    r1 = settings.get('hedge_ratio_1', 0.25)
    h2 = settings.get('hedge_threshold_2', 4.0)
    r2 = settings.get('hedge_ratio_2', 0.50)
    h3 = settings.get('hedge_threshold_3', 6.0)
    r3 = settings.get('hedge_ratio_3', 1.00)
    
    # Rebound settings (hysteresis)
    # In app.py, rebound thresholds are used to "Cover".
    # Logic: If we are currently hedged at Level 2 (50%), do we drop to Level 1?
    # Usually requires dropping below a lower threshold (e.g. rebound_threshold_2).
    
    # Simplified State Machine:
    # Calculate target ratio based on current deviation purely first?
    # Or do we need state?
    # App.py logic:
    # if diff_percent < -h3: ratio = r3
    # elif diff_percent < -h2: ratio = r2
    # elif diff_percent < -h1: ratio = r1
    # else: ratio = 0
    
    # BUT, app.py also has "Rebound" logic which implies hysteresis.
    # However, for the "Auto-Pilot", we might want to be stateless or stateful?
    # Stateless is safer. Let's look at how app.py does it.
    # It seems app.py calculates `target_hedge_ratio` purely on current `diff_percent`?
    # Wait, lines 812 "Rebound Logic" seems to be for display "Projection".
    # The actual `target_hedge_ratio` calculation logic is needed.
    
    # Let's assume standard tiered hedging for now:
    if diff_percent <= -h3:
        target_hedge_ratio = r3
        hedge_status = "⚠️ 強力避險 (Level 3)"
    elif diff_percent <= -h2:
        target_hedge_ratio = r2
        hedge_status = "⚠️ 中度避險 (Level 2)"
    elif diff_percent <= -h1:
        target_hedge_ratio = r1
        hedge_status = "⚠️ 輕度避險 (Level 1)"
    else:
        target_hedge_ratio = 0.0
        hedge_status = "✅ 無需避險 (Normal)"
        
    # 3. Calculate Target Quantity
    # Exposure = ETF Qty * Price * 2 (Leverage) ? 
    # Or just Market Value? 00631L tracks 2x daily return.
    # To hedge $1,000,000 of 00631L, we need to short $1,000,000 worth of Index?
    # Yes, roughly.
    
    etf_market_value = etf_qty * 1000 * etf_price # Qty is in "Zhang" (1000 shares) usually? 
    # App.py: st.info(f"**持有部位**\n\n00631L: {etf_qty} 張") -> Yes, Zhang.
    
    # Exposure Value. 
    # If 00631L is $200, 1 Zhang = $200,000.
    # To hedge, we need equivalent notional in Futures.
    # Small TX = Index * 50.
    # If Index = 20000, Contract = 1,000,000.
    # So 5 Zhang ($1M) needs 1 Small TX ($1M).
    
    # Wait, 00631L is 2x leverage. 
    # If we hold $1M of 00631L, it behaves like $2M of Index?
    # Yes. So Exposure = Market Value * 2?
    # Let's check app.py logic if possible, or assume standard delta hedging.
    # Assuming Exposure = Market Value (Simple) or Market Value * 2 (Delta).
    # Let's use a config 'leverage_factor' default to 1.0 or 2.0.
    # For safety, let's assume 1:1 hedging of market value for now, or check app.py.
    
    # Re-reading app.py snippet from memory/previous turns:
    # "約當曝險: ${exposure_value:,.0f}"
    # We need to know how app.py calculates this.
    
    exposure_value = etf_market_value # Default assumption
    
    contract_value = current_index * 50 # MXF
    
    if contract_value == 0:
        full_hedge_qty = 0
    else:
        full_hedge_qty = exposure_value / contract_value
        
    target_qty_float = full_hedge_qty * target_hedge_ratio
    target_qty_int = round(target_qty_float)
    
    # 4. Determine Action
    qty_diff = target_qty_int - current_short_qty
    
    action = "Hold"
    trade_qty = 0
    
    if qty_diff > 0:
        action = "Short"
        trade_qty = qty_diff
    elif qty_diff < 0:
        action = "Cover"
        trade_qty = abs(qty_diff)
        
    return {
        "action_needed": action,
        "trade_quantity": trade_qty,
        "target_mxf_qty": target_qty_int,
        "current_short_quantity": current_short_qty,
        "hedge_status": hedge_status,
        "diff_percent": diff_percent,
        "diff_points": diff_points,
        "target_hedge_ratio": target_hedge_ratio,
        "qty_diff": qty_diff,
        "market_info": {
            "index": current_index,
            "ma": ma_value,
            "etf_price": etf_price,
            "exposure": exposure_value
        }
    }
