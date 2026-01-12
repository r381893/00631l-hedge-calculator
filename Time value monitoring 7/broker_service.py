from abc import ABC, abstractmethod
import pandas as pd
from datetime import datetime
import time

class BaseBroker(ABC):
    """Abstract Base Class for a Broker"""
    
    @abstractmethod
    def place_order(self, symbol: str, action: str, quantity: int, price: float, order_type: str = "LMT"):
        """
        Place an order.
        action: "Buy" or "Sell"
        """
        pass

    @abstractmethod
    def get_positions(self):
        """Return list of current positions"""
        pass

    @abstractmethod
    def get_equity(self):
        """Return dict with 'equity', 'pnl', 'available_margin'"""
        pass

    @abstractmethod
    def get_orders(self):
        """Return list of orders"""
        pass

class MockBroker(BaseBroker):
    """Virtual Broker for Simulation"""
    
    def __init__(self, initial_balance=1000000):
        self.balance = initial_balance
        self.initial_balance = initial_balance
        self.positions = {} # {symbol: {'qty': 0, 'cost': 0}}
        self.orders = []
        self.realized_pnl = 0
        
    def place_order(self, symbol: str, action: str, quantity: int, price: float, order_type: str = "LMT"):
        """Simulate immediate fill at requested price"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Record Order
        order_id = f"MOCK-{int(time.time()*1000)}"
        order_record = {
            "order_id": order_id,
            "symbol": symbol,
            "action": action,
            "price": price,
            "quantity": quantity,
            "status": "Filled",
            "timestamp": timestamp,
            "message": "Simulated Fill"
        }
        self.orders.insert(0, order_record)
        
        # Update Position
        direction = 1 if action == "Buy" else -1
        qty_change = quantity * direction
        
        if symbol not in self.positions:
            self.positions[symbol] = {'qty': 0, 'cost': 0}
            
        current_pos = self.positions[symbol]
        
        # Calculate PnL if closing/reducing
        # Simplified: Average Cost Accounting
        # If direction matches current pos or pos is 0, just add cost
        # If direction opposite, realize PnL
        
        if current_pos['qty'] == 0 or (current_pos['qty'] > 0 and direction > 0) or (current_pos['qty'] < 0 and direction < 0):
            # Increasing position
            total_cost = (current_pos['qty'] * current_pos['cost']) + (qty_change * price)
            new_qty = current_pos['qty'] + qty_change
            new_avg_cost = total_cost / new_qty if new_qty != 0 else 0
            self.positions[symbol] = {'qty': new_qty, 'cost': new_avg_cost}
        else:
            # Closing/Reducing
            # Realize PnL on the closed portion
            closed_qty = min(abs(current_pos['qty']), abs(qty_change)) * (1 if current_pos['qty'] > 0 else -1)
            
            # PnL = (Exit Price - Entry Price) * Qty * Multiplier (Assuming 50 for Small TX for simplicity, or pass in)
            # TODO: Handle multiplier dynamically. For now assume MXF=50, TX=200. 
            multiplier = 50 if "MXF" in symbol else 200 
            
            trade_pnl = (price - current_pos['cost']) * closed_qty * multiplier
            self.realized_pnl += trade_pnl
            self.balance += trade_pnl
            
            # Update remaining qty
            new_qty = current_pos['qty'] + qty_change
            # Cost basis remains same for remaining shares
            if new_qty == 0:
                del self.positions[symbol]
            else:
                self.positions[symbol]['qty'] = new_qty

        return {"success": True, "message": f"Mock Order Filled: {action} {quantity} {symbol} @ {price}", "order_id": order_id}

    def get_positions(self):
        # Convert dict to list format expected by UI
        pos_list = []
        for sym, data in self.positions.items():
            pos_list.append({
                "symbol": sym,
                "direction": "Buy" if data['qty'] > 0 else "Sell",
                "quantity": abs(data['qty']),
                "price": data['cost'],
                "pnl": 0 # Unrealized PnL needs current price, passed in or fetched? 
                         # For simple mock, we might need to update this externally or just show 0 here
            })
        return pos_list

    def get_equity(self):
        # Simplified Equity
        return {
            "equity": self.balance, # This is actually Cash + Realized. Unrealized needs mark-to-market.
            "pnl": self.realized_pnl,
            "risk_index": 0.0
        }

    def get_orders(self):
        return self.orders
        
    def update_market_price(self, symbol, current_price):
        """Helper to update unrealized PnL (Optional usage)"""
        pass


class FubonBrokerAdapter(BaseBroker):
    """Adapter for Real Fubon DataProvider"""
    
    def __init__(self, provider):
        self.provider = provider
        
    def place_order(self, symbol: str, action: str, quantity: int, price: float, order_type: str = "LMT"):
        # Map generic args to Fubon SDK args
        # provider.place_order(strike, option_type, action, quantity, price, symbol)
        
        # Infer option_type/strike from symbol or assume Futures for now based on context
        # The app passes specific args. We might need to make the interface flexible or parse the symbol.
        # For this specific app, we are mostly trading Futures (Small TX).
        
        # If symbol starts with MXF or TXF, it's a Future.
        o_type = "Small TX"
        if symbol.startswith("TXF"):
            o_type = "TX"
            
        return self.provider.place_order(
            strike=0,
            option_type=o_type,
            action=action,
            quantity=quantity,
            price=price,
            symbol=symbol
        )

    def get_positions(self):
        return self.provider.get_positions()

    def get_equity(self):
        return self.provider.get_equity()

    def get_orders(self):
        return self.provider.get_orders()
