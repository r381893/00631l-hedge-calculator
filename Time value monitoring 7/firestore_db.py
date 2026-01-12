import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import streamlit as st
import os
from dotenv import load_dotenv
import pandas as pd
from datetime import datetime

# Load environment variables
load_dotenv()

class FirestoreDB:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FirestoreDB, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        self.db = None
        self.is_connected = False
        self.error_message = None
        self._connect()
        self._initialized = True

    def _connect(self):
        """Initialize Firebase connection."""
        try:
            # Check if already initialized
            if not firebase_admin._apps:
                # Priority 1: Streamlit Secrets
                try:
                    if hasattr(st, "secrets") and "firebase" in st.secrets:
                        print("[KEY] 使用 Streamlit Secrets 連接 Firebase")
                        # Convert AttrDict to standard dict for Firebase Admin SDK
                        cred_dict = dict(st.secrets["firebase"])
                        cred = credentials.Certificate(cred_dict)
                        firebase_admin.initialize_app(cred)
                        self.db = firestore.client()
                        self.is_connected = True
                        print("[SUCCESS] Firebase Firestore 連接成功")
                        return
                except Exception as e:
                    print(f"[INFO] Streamlit Secrets 讀取失敗或不存在，嘗試使用本機檔案: {e}")
                    # Continue to Priority 2
                # Priority 2: Local File
                cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH', 'serviceAccountKey.json')
                
                if not os.path.exists(cred_path):
                    self.error_message = f"找不到金鑰檔案: {cred_path}"
                    print(f"[ERROR] {self.error_message}")
                    return

                print(f"[FILE] 使用本機金鑰檔案: {cred_path}")
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            self.is_connected = True
            print("[SUCCESS] Firebase Firestore 連接成功")
            
        except Exception as e:
            self.error_message = str(e)
            self.is_connected = False
            print(f"[ERROR] Firebase 連接失敗: {e}")

    def save_record(self, collection_name: str, data: dict) -> bool:
        """Save a single record to a collection."""
        if not self.is_connected:
            return False
            
        try:
            # Convert Timestamp/Datetime to native Python datetime for Firestore
            clean_data = data.copy()
            for k, v in clean_data.items():
                if isinstance(v, (pd.Timestamp, pd.DatetimeIndex)):
                    clean_data[k] = v.to_pydatetime()
            
            # Add server timestamp
            clean_data['created_at'] = firestore.SERVER_TIMESTAMP
            
            self.db.collection(collection_name).add(clean_data)
            return True
        except Exception as e:
            print(f"[ERROR] Firestore 寫入失敗 ({collection_name}): {e}")
            return False

    def fetch_history(self, collection_name: str, limit: int = 1000) -> list:
        """Fetch historical records ordered by creation time."""
        if not self.is_connected:
            return []
            
        try:
            docs = self.db.collection(collection_name)\
                .order_by('created_at', direction=firestore.Query.DESCENDING)\
                .limit(limit)\
                .stream()
                
            results = []
            for doc in docs:
                data = doc.to_dict()
                # Convert Firestore timestamp back to string or pd.Timestamp if needed
                # For consistency with app, we might want to keep it simple
                results.append(data)
            
            # Reverse to show oldest first if needed, or keep desc
            # App expects chronological order usually
            results.reverse()
            return results
        except Exception as e:
            print(f"[ERROR] Firestore 讀取失敗 ({collection_name}): {e}")
            return []

    def save_portfolio(self, portfolio_data: list) -> bool:
        """Overwrite portfolio data (simplest way for sync)."""
        if not self.is_connected:
            return False
        
        try:
            # Use a specific document ID for user's portfolio
            # For multi-user, we'd need user_id. Here we assume single user per deployment or shared.
            doc_ref = self.db.collection('user_data').document('portfolio')
            
            # Convert list of dicts
            clean_list = []
            for item in portfolio_data:
                clean_item = item.copy()
                # Handle types
                clean_list.append(clean_item)
            
            doc_ref.set({'positions': clean_list, 'updated_at': firestore.SERVER_TIMESTAMP})
            return True
        except Exception as e:
            print(f"[ERROR] Portfolio 同步失敗: {e}")
            return False

    def fetch_portfolio(self) -> list:
        """Fetch portfolio data."""
        if not self.is_connected:
            return []
            
        try:
            doc = self.db.collection('user_data').document('portfolio').get()
            if doc.exists:
                data = doc.to_dict()
                return data.get('positions', [])
            return []
        except Exception as e:
            print(f"[ERROR] Portfolio 讀取失敗: {e}")
            return []

    def save_pnl_history(self, history_data: list) -> bool:
        """Overwrite PnL history data."""
        if not self.is_connected:
            return False
        
        try:
            doc_ref = self.db.collection('user_data').document('pnl_history')
            
            clean_list = []
            for item in history_data:
                clean_item = item.copy()
                clean_list.append(clean_item)
            
            doc_ref.set({'history': clean_list, 'updated_at': firestore.SERVER_TIMESTAMP})
            return True
        except Exception as e:
            print(f"[ERROR] PnL History 同步失敗: {e}")
            return False

    def fetch_pnl_history(self) -> list:
        """Fetch PnL history data."""
        if not self.is_connected:
            return []
            
        try:
            doc = self.db.collection('user_data').document('pnl_history').get()
            if doc.exists:
                data = doc.to_dict()
                return data.get('history', [])
            return []
        except Exception as e:
            print(f"[ERROR] PnL History 讀取失敗: {e}")
            return []

    def delete_records(self, collection_name: str, start_datetime: datetime, end_datetime: datetime) -> int:
        """Delete records within a date range (inclusive)."""
        if not self.is_connected:
            return 0
            
        try:
            # Query documents where 'Timestamp' is within range
            # Note: This assumes the field name in Firestore is 'Timestamp'
            docs = self.db.collection(collection_name)\
                .where('Timestamp', '>=', start_datetime)\
                .where('Timestamp', '<=', end_datetime)\
                .stream()
                
            count = 0
            batch = self.db.batch()
            
            for doc in docs:
                batch.delete(doc.reference)
                count += 1
                # Commit batch every 400 items (limit is 500)
                if count % 400 == 0:
                    batch.commit()
                    batch = self.db.batch()
            
            if count % 400 != 0:
                batch.commit()
                
            return count
        except Exception as e:
            print(f"[ERROR] Firestore 刪除失敗: {e}")
            return 0

    def save_order(self, order_data: dict) -> bool:
        """Save order to 'orders' collection."""
        return self.save_record('orders', order_data)

    def fetch_orders(self, limit: int = 50) -> list:
        """Fetch latest orders from 'orders' collection."""
        return self.fetch_history('orders', limit=limit)
