
import logging
from yahoo_scraper import fetch_yahoo_futures_page, get_yahoo_index_price
import re

# Set up logging to console
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_scraper():
    print("Fetching Yahoo Futures page...")
    html = fetch_yahoo_futures_page()
    
    if not html:
        print("❌ Failed to fetch HTML")
        return

    print(f"HTML received. Length: {len(html)}")
    
    # Dump a snippet around "台指期近一" to see the structure
    print("\n--- HTML Snippet (around WTX&) ---")
    
    # Try multiple search patterns to find the location
    patterns = ["WTX&", "台指期近一"]
    for p in patterns:
        idx = html.find(p)
        if idx != -1:
            start = max(0, idx - 100)
            end = min(len(html), idx + 300)
            print(f"Pattern '{p}' found at {idx}:")
            print(html[start:end])
            print("-----------------------------------")
        else:
            print(f"Pattern '{p}' NOT found")

    print("\n--- Parsing Index Price ---")
    price = get_yahoo_index_price(html)
    print(f"Parsed Index Price: {price}")

if __name__ == "__main__":
    debug_scraper()
