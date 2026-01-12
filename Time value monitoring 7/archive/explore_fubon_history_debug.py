from fubon_neo.sdk import FubonSDK
import inspect

def explore_fubon():
    sdk = FubonSDK()
    print("SDK Attributes:", dir(sdk))
    
    if hasattr(sdk, 'marketdata'):
        print("\nMarketData Attributes:", dir(sdk.marketdata))
        if hasattr(sdk.marketdata, 'rest_client'):
            print("\nRest Client Attributes:", dir(sdk.marketdata.rest_client))
            if hasattr(sdk.marketdata.rest_client, 'stock'):
                 print("\nStock Rest Client Attributes:", dir(sdk.marketdata.rest_client.stock))
                 if hasattr(sdk.marketdata.rest_client.stock, 'historical'):
                     print("\nStock Historical:", dir(sdk.marketdata.rest_client.stock.historical))
            
            if hasattr(sdk.marketdata.rest_client, 'futopt'):
                 print("\nFutOpt Rest Client Attributes:", dir(sdk.marketdata.rest_client.futopt))

if __name__ == "__main__":
    try:
        explore_fubon()
    except Exception as e:
        print(f"Error: {e}")
