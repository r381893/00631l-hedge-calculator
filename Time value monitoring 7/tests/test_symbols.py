from datetime import datetime, timedelta

def get_contract_month_year(now):
    year = now.year
    month = now.month
    
    # Calculate 3rd Wednesday
    first_day = now.replace(day=1)
    first_day_weekday = first_day.weekday() # Mon=0, Sun=6
    days_to_first_wed = (2 - first_day_weekday + 7) % 7
    first_wed_date = 1 + days_to_first_wed
    third_wed_date = first_wed_date + 14
    
    print(f"Current: {now}")
    print(f"3rd Wed Date: {third_wed_date}")
    
    if now.day > third_wed_date:
        month += 1
        if month > 12:
            month = 1
            year += 1
            
    return month, year

def get_nearest_weekly_contract(now):
    today = now.date()
    
    # Find this week's Wednesday
    days_to_wed = (2 - today.weekday() + 7) % 7
    
    # Logic from data_provider.py
    if days_to_wed == 0:
        if now.hour > 13 or (now.hour == 13 and now.minute >= 30):
            days_to_wed = 7
    
    settlement_date = today + timedelta(days=days_to_wed)
    print(f"Next Settlement: {settlement_date}")
    
    # Determine week number
    settlement_month_first = settlement_date.replace(day=1)
    first_day_weekday = settlement_month_first.weekday()
    days_to_first_wed = (2 - first_day_weekday + 7) % 7
    first_wed = settlement_month_first + timedelta(days=days_to_first_wed)
    
    week_number = int((settlement_date - first_wed).days / 7) + 1
    
    return settlement_date.month, settlement_date.year, week_number

# Test with current simulated time
now = datetime(2025, 11, 28, 19, 56)
m, y = get_contract_month_year(now)
print(f"Monthly Contract: {y}-{m}")

wm, wy, ww = get_nearest_weekly_contract(now)
print(f"Weekly Contract: {wy}-{wm} Week {ww}")

# Symbol Generation
month_codes = "ABCDEFGHIJKL"
year_digit = str(y)[-1]
month_code = month_codes[m - 1]
print(f"TXF Symbol: TXF{month_code}{year_digit}")
