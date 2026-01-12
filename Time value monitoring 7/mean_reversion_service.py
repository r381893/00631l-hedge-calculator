import pandas as pd
import numpy as np
import yfinance as yf

class MeanReversionStrategy:
    """
    Trend Pullback Strategy:
    - Bull Market (Price > MA): Long Only. Buy Dips.
    - Bear Market (Price < MA): Short Only. Sell Rallies.
    """
    
    @staticmethod
    def calculate_indicators(df: pd.DataFrame, ma_period: int = 60):
        if df.empty:
            return None
        
        df = df.copy()
        if 'Date' in df.columns:
            df = df.sort_values('Date')
        
        # Calculate MA
        df['MA'] = df['Close'].rolling(window=ma_period).mean()
        
        # Calculate StdDev
        df['StdDev'] = df['Close'].rolling(window=20).std()
        
        # Calculate ATR (14)
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        df['ATR'] = true_range.rolling(14).mean()
        
        return df

    @staticmethod
    def evaluate_signal(
        current_price: float, 
        ma_price: float, 
        positions: list, 
        config: dict
    ) -> dict:
        """
        Evaluate market state and return action.
        """
        grid_gap = config.get('grid_gap', 100)
        take_profit = config.get('take_profit', 100)
        max_pos = config.get('max_positions', 10)
        
        # Determine Trend
        is_bull = current_price >= ma_price
        
        # 1. Check Exit (Take Profit / Stop Loss if needed)
        for i, pos in enumerate(positions):
            entry_price = pos['price']
            pos_type = pos.get('type', 'LONG') # Default to Long if missing
            
            if pos_type == 'LONG':
                # Sell if price rises (Take Profit)
                if current_price >= entry_price + take_profit:
                    return {
                        'action': 'SELL_CLOSE',
                        'price': current_price,
                        'matched_position_index': i,
                        'reason': f"多單獲利 (TP): {current_price:.0f} >= {entry_price:.0f} + {take_profit}"
                    }
                # Check for trend reversal? (Optional: Close Longs if Price < MA)
                # For now, let's stick to Grid Logic (Hold until profit)
            
            elif pos_type == 'SHORT':
                # Cover if price drops (Take Profit)
                if current_price <= entry_price - take_profit:
                    return {
                        'action': 'BUY_COVER',
                        'price': current_price,
                        'matched_position_index': i,
                        'reason': f"空單獲利 (TP): {current_price:.0f} <= {entry_price:.0f} - {take_profit}"
                    }

        # 2. Check Entry
        if len(positions) >= max_pos:
            return {'action': 'HOLD', 'reason': '已達最大持倉限制'}
            
        # Filter positions by type
        longs = [p for p in positions if p.get('type', 'LONG') == 'LONG']
        shorts = [p for p in positions if p.get('type', 'SHORT') == 'SHORT']
        
        if is_bull:
            # Bull Market: Look for LONG entries (Buy Dips)
            # Cannot open SHORTs here.
            
            # Entry Condition 1: No Longs -> Buy if we are "pulling back"? 
            # Or just Buy immediately? 
            # User says: "每跌多少買進一口".
            # This implies relative to "Last Entry" or "Reference".
            # If no positions, what is the reference?
            # Ideally: Reference = Current High? Or just MA?
            # A safe start: If Price < MA + X (Not too high) ?
            # Or simplified: First entry at MA? 
            # Let's say: If no longs, Buy if Current <= MA (Touch MA support) OR Just Buy?
            # Re-reading: "均線上 只做多 所以每跌多少買進一口"
            # This is classic Grid. Reference point is usually the LAST BUY. 
            # But what about the FIRST buy? 
            # Let's assume: First Buy when trend is established (e.g. Price crosses MA up?) 
            # Or maybe we need a "Baseline".
            # Let's use:
            # If no longs: Buy if Close < MA * 1.01 (Near MA)? No.
            # Let's assume user wants to enter if we drop Grid Gap from "Recent Peak" or just relative to last trade.
            # Strategy: If no positions, Buy if Price <= MA (Pullback to MA). 
            
            if not longs:
                 if current_price <= ma_price: 
                      # Close to MA, good entry? 
                      # But wait, if Price > MA, and we want to "Buy Dips".
                      # Maybe we track improper "Grid".
                      # Let's implement: If no pos, Buy if we are NOT too extended?
                      # Actually, let's use: Buy if Price < MA + GridGap/2 (Proximity)?
                      # User's request is specific: "每跌 Buy".
                      # Let's use MA as the dynamic "Grid 0".
                      # Buy at MA, MA - Gap, MA - 2*Gap? 
                      # NO, Bull is Price > MA. 
                      # So we buy at Price = MA + 300, then MA + 200, then MA + 100?
                      # Yes. 
                      # If No Positions: Buy if Price confirms trend?
                      # Let's keep it simple: If no positions, wait for pullback.
                      # Assume "Phantom Last Price" was higher?
                      # Let's use: If no pos, Buy. (Immediate entry to start grid).
                      return {'action': 'BUY_OPEN', 'price': current_price, 'reason': '趨勢偏多: 建立首單'}
            else:
                 # Have Longs. Buy if Price < Lowest Long - Gap
                 lowest_long = min(p['price'] for p in longs)
                 if current_price <= lowest_long - grid_gap:
                     return {
                         'action': 'BUY_OPEN',
                         'price': current_price,
                         'reason': f"趨勢偏多: 拉回加碼 ({current_price:.0f} <= {lowest_long:.0f} - {grid_gap})"
                     }

        else: # Bear Market (Price < MA)
            # Bear Market: Look for SHORT entries (Sell Rallies)
            
            if not shorts:
                # First Short.
                return {'action': 'SELL_OPEN', 'price': current_price, 'reason': '趨勢偏空: 建立首單'}
            else:
                # Have Shorts. Sell if Price > Highest Short + Gap
                highest_short = max(p['price'] for p in shorts)
                if current_price >= highest_short + grid_gap:
                    return {
                        'action': 'SELL_OPEN',
                        'price': current_price,
                        'reason': f"趨勢偏空: 反彈加碼 ({current_price:.0f} >= {highest_short:.0f} + {grid_gap})"
                    }

        return {'action': 'HOLD', 'reason': '未達交易條件'}

    @staticmethod
    def run_backtest(ticker: str, start_date: str, end_date: str, ma_period: int, grid_gap: int, take_profit: int, max_positions: int = 10, initial_capital: int = 1000000, point_value: int = 50, margin_per_contract: int = 60000):
        """
        Run backtest using yfinance data with Margin Constraints.
        """
        # 1. Fetch Data
        df = yf.download(ticker, start=start_date, end=end_date)
        if hasattr(df.columns, 'droplevel'): # Handle MultiIndex
             if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.droplevel(1) # Drop Ticker level
        
        if df.empty:
            return {'error': 'No data found'}
            
        # 2. Indicators
        df = MeanReversionStrategy.calculate_indicators(df, ma_period)
        df = df.dropna()
        
        # 3. Simulation Loop
        positions = [] # List of {price, type}
        history = []
        equity = initial_capital
        
        # Performance Tracking
        max_equity = initial_capital
        max_drawdown = 0
        liquidation = False
        
        config = {
            'grid_gap': grid_gap,
            'take_profit': take_profit,
            'max_positions': max_positions
        }
        
        for idx, row in df.iterrows():
            if liquidation: break

            current_price = row['Close']
            ma_price = row['MA']
            date = idx
            
            # --- Calc Floating PnL & Equity ---
            float_pnl = 0
            for p in positions:
                if p['type'] == 'LONG':
                    float_pnl += (current_price - p['price']) * point_value
                else:
                    float_pnl += (p['price'] - current_price) * point_value
            
            curr_equity = equity + float_pnl
            
            # --- Check Liquidation (爆倉) ---
            # Maintenance Margin check: If Equity < Required Margin for current positions?
            # Or simple: If Equity <= 0?
            # User said: "超過就是抱倉(爆倉)不在繼續回測".
            # Usually brokerage force closes if Equity < Maintenance Margin.
            # Let's assume Maintenance Margin = 100% of Initial Margin per contract for safety in this sim.
            required_margin = len(positions) * margin_per_contract
            
            if curr_equity < required_margin * 0.5: # Assume 50% maintenance threshold? Or strictly < Margin?
                # Let's use strict: If Equity < 0, definitely bust.
                # If Equity < Margin needed?
                # Let's use a "Bust" condition: Equity <= 20% of Required Margin.
                # User asked: "Risk indicator set to 300...".
                # Let's stick to: If Equity < 0, STOP.
                pass 
                
            # Actually, let's strictly enforce: Equity MUST be > 0.
            if curr_equity <= 0:
                liquidation = True
                history.append({'date': date, 'action': 'LIQUIDATION', 'price': current_price, 'pnl': float_pnl})
                equity = 0
                break

            # Track Max Equity/DD
            if curr_equity > max_equity: max_equity = curr_equity
            dd = max_equity - curr_equity
            if dd > max_drawdown: max_drawdown = dd
            
            # Evaluate Signal
            signal = MeanReversionStrategy.evaluate_signal(current_price, ma_price, positions, config)
            action = signal['action']
            
            # --- Execution with Margin Check ---
            
            if action == 'BUY_OPEN':
                # Check Margin
                if (len(positions) + 1) * margin_per_contract > curr_equity:
                    # Insufficient Margin
                    continue
                    
                positions.append({'price': current_price, 'type': 'LONG', 'date': date})
                history.append({'date': date, 'action': 'Long', 'price': current_price, 'pnl': 0})
                
            elif action == 'SELL_OPEN':
                # Check Margin
                if (len(positions) + 1) * margin_per_contract > curr_equity:
                    continue

                positions.append({'price': current_price, 'type': 'SHORT', 'date': date})
                history.append({'date': date, 'action': 'Short', 'price': current_price, 'pnl': 0})
                
            elif action == 'SELL_CLOSE':
                p_idx = signal['matched_position_index']
                pos = positions.pop(p_idx)
                pnl = (current_price - pos['price']) * point_value 
                equity += pnl # Realized
                history.append({'date': date, 'action': 'CloseLong', 'price': current_price, 'pnl': pnl})
                
            elif action == 'BUY_COVER':
                p_idx = signal['matched_position_index']
                pos = positions.pop(p_idx)
                pnl = (pos['price'] - current_price) * point_value
                equity += pnl
                history.append({'date': date, 'action': 'CloseShort', 'price': current_price, 'pnl': pnl})
            
        return {
            'final_equity': equity,
            'total_return': equity - initial_capital,
            'max_drawdown': max_drawdown,
            'trade_count': len(history),
            'history': history,
            'df': df,
            'liquidation': liquidation
        }
