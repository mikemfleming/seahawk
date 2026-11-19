"""Key-free historical S&P 500 closes and calendar-week comparisons."""
from bisect import bisect_right
from datetime import datetime,date,timedelta,timezone
from math import isfinite
from zoneinfo import ZoneInfo
import json
SOURCE_URL='https://finance.yahoo.com/quote/%5EGSPC/history/'
START=int(datetime(1994,1,1,tzinfo=timezone.utc).timestamp())
END=int(datetime(2005,1,1,tzinfo=timezone.utc).timestamp())
DOWNLOAD_URL=f'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1={START}&period2={END}&interval=1d'
def parse_market_history(body):
 payload=json.loads(body)
 chart=payload.get('chart',{})
 if chart.get('error') or not chart.get('result'):raise ValueError('Market history unavailable')
 result=chart['result'][0];meta=result.get('meta',{})
 if meta.get('symbol')!='^GSPC' or meta.get('instrumentType')!='INDEX':raise ValueError('Unexpected market benchmark')
 if meta.get('exchangeTimezoneName')!='America/New_York':raise ValueError('Unexpected market timezone')
 timestamps=result.get('timestamp',[]);closes=result.get('indicators',{}).get('quote',[{}])[0].get('close',[])
 if len(timestamps)!=len(closes):raise ValueError('Market dates and closes differ')
 history={}
 for timestamp,close in zip(timestamps,closes):
  if isinstance(close,bool) or not isinstance(close,(int,float)) or not isfinite(close) or close<=0:continue
  when=datetime.fromtimestamp(timestamp,ZoneInfo('America/New_York')).date().isoformat()
  if when in history:raise ValueError('Duplicate market date')
  history[when]=float(close)
 if not history:raise ValueError('No valid historical closes')
 return history

def market_snapshot(day,history):
 target=date.fromisoformat(day);baseline=(target-timedelta(days=7)).isoformat();days=sorted(history)
 def previous(when):
  index=bisect_right(days,when)-1
  if index<0:return None
  found=days[index]
  # Do not quietly bridge a missing historical dataset with a stale quote.
  if (date.fromisoformat(when)-date.fromisoformat(found)).days>7:return None
  return found
 close_day=previous(day);base_day=previous(baseline)
 if not close_day or not base_day or close_day<=base_day:return None
 close=history[close_day];base=history[base_day]
 return {'symbol':'^GSPC','name':'S&P 500','as_of':day,'close_date':close_day,'close':round(close,2),'comparison_target':baseline,'comparison_date':base_day,'comparison_close':round(base,2),'change_percent':(close/base-1)*100,'source':'Yahoo Finance','source_url':SOURCE_URL,'download_url':DOWNLOAD_URL,'measure':'Price index close; excludes dividends'}
