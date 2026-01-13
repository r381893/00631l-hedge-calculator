import requests
from bs4 import BeautifulSoup
import logging
import re
from datetime import datetime

logger = logging.getLogger(__name__)

def fetch_yahoo_futures_page():
    """Fetch the raw HTML content from Yahoo Kimo Futures page."""
    url = "https://tw.stock.yahoo.com/future"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.text
    except Exception as e:
        logger.error(f"❌ Failed to fetch Yahoo Futures page: {e}")
        return None

def parse_option_chain(html_content):
    """
    Parse the Option Chain from Yahoo Kimo Futures page HTML.
    Targeting the table with Call/Put columns.
    """
    if not html_content:
        return {}
        
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 1. 尋找特定的表格結構
    # Yahoo 的選擇權表格包含 "買權 Call" 和 "賣權 Put" 等 headers
    # 我們可以透過尋找這些關鍵字來定位表格
    
    # 嘗試定位包含 "買權 Call" 的 header
    # 實際結構比較複雜，通常是一個 div container 包含 table
    # 我們遍歷所有的 table rows
    
    option_data = {}
    
    # 抓取所有 li 元素 (Yahoo 新版網頁可能是用 list 呈現，也可能是 table，視響應式設計而定)
    # 但根據 view_content_chunk，它呈現為 Markdown table 格式，原始碼應該是 table 或 grid
    
    # 策略：尋找所有包含履約價連結的行
    # 連結範例: https://tw.stock.yahoo.com/future/WTX2F6;30700C
    # 我們可以抓取所有 href 包含 "WTX" (台指期代號) 且包含 ";" (履約價分隔) 的連結
    
    links = soup.find_all('a', href=re.compile(r'/future/WTX.*'))
    
    # 用來暫存解析到的資料，以 strike 為 key
    # strike -> { 'Call': {price, ...}, 'Put': {price, ...} }
    temp_chain = {}
    
    for link in links:
        href = link.get('href')
        text = link.text.strip().replace(',', '')
        
        # 解析 href 取得代號與履約價
        # 格式範例: /future/WTX2F6;30700C (Call) / /future/WTX2F6;30700P (Put)
        # 也有可能是 /future/WTX%26 (近月期貨) -> 這些要過濾掉
        
        match = re.search(r';(\d+)([CP])', href)
        if not match:
            continue
            
        strike = int(match.group(1))
        type_code = match.group(2) # C or P
        is_call = type_code == 'C'
        
        # 價格通常就是連結的文字
        try:
            price = float(text)
        except ValueError:
            continue
            
        if strike not in temp_chain:
            temp_chain[strike] = {}
            
        # 簡單判定：如果是連結，通常是「成交價」或「買價/賣價」中連結到的該商品頁面
        # Yahoo 的表格通常整行都是該商品的數據，但我們很難單純從一個連結推斷它是 Bid/Ask/Last
        # 不過，通常價格連結就是「最新成交價」 (Last Price)
        
        # 為了更精準，我們嘗試定位該連結的 parent row
        # 然後從該 row 中解析出完整的 Bid/Ask
        # 這裡先做簡易版：假設抓到的就是 Last Price
        
        option_type = 'Call' if is_call else 'Put'
        
        # 檢查是否已經有這個 strike + type 的資料 (避免重複抓取不同月份或重複連結)
        # 這裡我們只抓取看到的第一个 (通常是主力合約或近月)
        if option_type not in temp_chain[strike]:
            temp_chain[strike][option_type] = {
                'strike': strike,
                'type': option_type,
                'price': price,
                'bid': price, # 暫時用 Last 當 Bid/Ask，因為 Yahoo 靜態爬蟲難抓 Order Book
                'ask': price,
                'source': 'yahoo'
            }
            
    # 轉換成列表並回傳
    result = []
    for strike, data in temp_chain.items():
        if 'Call' in data:
            result.append(data['Call'])
        if 'Put' in data:
            result.append(data['Put'])
            
    logger.info(f"✅ Yahoo Scraper parsed {len(result)} option contracts")
    return result

def get_yahoo_index_price(html_content):
    """
    Parse the Index Price (WTX) from Yahoo Kimo Futures page.
    """
    if not html_content:
        return None
        
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 尋找 "台指期近一" 或類似的關鍵字
    # 根據之前的 view_content_chunk，連結文字是 "台指期近一"
    # 連結範例: https://tw.stock.yahoo.com/future/WTX%26
    
    target_link = soup.find('a', href=re.compile(r'WTX%26')) # %26 is & encoded
    if not target_link:
        target_link = soup.find('a', href=re.compile(r'WTX&'))

    if target_link:
        # 價格通常在連結後的某個兄弟元素或包含在同一個 row 內
        # 結構: Link Name ... Price ...
        # 我們嘗試找該 link 的 parent container (可能是一個 li 或 tr)
        
        # 簡易作法：在 HTML text 中搜尋 "台指期近一" 後的數字
        # 因為 BeautifulSoup 定位相對複雜，且 Yahoo 結構常變
        pass

    # Regex Fallback for Index Price
    # 尋找 "台指期近一" 相關代號 (WTX&) ... 31,000.00
    # HTML Snippet: ... WTX&amp; ... 31,010.00 ...
    # 由於 "台指期近一" 可能會有編碼問題 (Big5 vs UTF-8)，改抓其代號 "WTX&" 或 "WTX&amp;"
    
    match = re.search(r'WTX(?:&|&amp;).*?([\d,]+\.\d{2})', html_content, re.DOTALL)
    if match:
        try:
            # 優先使用台指期近一 (Futures) 作為 Index Price，以支援夜盤
            price_str = match.group(1).replace(',', '')
            logger.info(f"✅ Parsed Futures Price (WTX&): {price_str}")
            return float(price_str)
        except ValueError:
            pass

    # 如果抓不到期貨，嘗試抓加權指數 (Day session fallback)
    match_tse = re.search(r'加權指數.*?([\d,]+\.\d{2})', html_content, re.DOTALL)
    if match_tse:
        try:
            price_str = match_tse.group(1).replace(',', '')
            logger.info(f"⚠️ Fallback to TSE Index Price: {price_str}")
            return float(price_str)
        except ValueError:
            pass
            
    return None

def scrape_yahoo_option_chain():
    """Main entry point to scrape Yahoo data."""
    html = fetch_yahoo_futures_page()
    if not html:
        return None, None
        
    index_price = get_yahoo_index_price(html)
    chain_data = parse_option_chain(html)
    
    # 將 chain_data 轉為以 key 為 index 的 dict，方便 app.py 使用
    # key format: "{strike}_{C/P}"
    formatted_data = {}
    for item in chain_data:
        key = f"{item['strike']}_{'C' if item['type'] == 'Call' else 'P'}"
        item['symbol'] = f"TXO{item['strike']}{'C' if item['type'] == 'Call' else 'P'}" # Fake Symbol
        formatted_data[key] = item
        
    return index_price, formatted_data
