"""Prepare key-free historical events and vintage economic snapshots offline."""
from pathlib import Path
from datetime import date,timedelta
from concurrent.futures import ThreadPoolExecutor,as_completed
import csv,hashlib,io,json,re,urllib.request,time
from lxml import html
from market_context import DOWNLOAD_URL,parse_market_history,market_snapshot
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'data/intake/seahawk/weekly-context-cache';CACHE.mkdir(parents=True,exist_ok=True)
context=json.loads((ROOT/'content/entry-context.json').read_text())
dates=sorted({entry['date'] for page in context['pages'].values() for entry in page['entries'] if entry.get('date')})
MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December']
def download(url):
 path=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.txt')
 if path.exists():return path.read_text()
 request=urllib.request.Request(url,headers={'User-Agent':'SeahawkJournal/1.0 (https://github.com/mikemfleming/seahawk; historical context preparation)'})
 with urllib.request.urlopen(request,timeout=25) as response:body=response.read().decode('utf-8')
 path.write_text(body);return body

def events_for_year(year):
 url=f'https://en.wikipedia.org/wiki/{year}';root=html.fromstring(download(url));events=[]
 for month_number,month in enumerate(MONTHS,1):
  heading=root.xpath(f'//*[@id="{month}"]')
  if not heading:continue
  parent=heading[0].getparent()
  if parent.tag!='div':parent=heading[0]
  for sibling in parent.itersiblings():
   if sibling.tag in ('h2','h3') or sibling.xpath('./h2|./h3'):break
   if sibling.tag!='ul':continue
   for item in sibling.xpath('./li'):
    # Remove reference markers without removing article links or altering prose.
    for sup in item.xpath('.//sup'):sup.drop_tree()
    own=' '.join(item.xpath('./text()|./*[not(self::ul)]//text()'))
    own=re.sub(r'\s+',' ',own).strip()
    match=re.match(rf'^{month} (\d{{1,2}})(?:\s*[–—-]\s*|\s*$)',own)
    if not match:continue
    try:when=date(year,month_number,int(match[1])).isoformat()
    except ValueError:continue
    nested=item.xpath('./ul/li')
    descriptions=[re.sub(r'\s+',' ',child.text_content()).strip() for child in nested] if nested else [own[match.end():].strip()]
    for description in descriptions:
     if not description or len(description)>450 or re.match(r'^\d{1,2}\s*[–—-]',description):continue
     events.append({'date':when,'text':description,'source_url':url+'#'+month,'source_title':f'Wikipedia contributors, {year}','license':'CC BY-SA 4.0','license_url':'https://creativecommons.org/licenses/by-sa/4.0/'})
 return events

def economic_series(day,series):
 # A vintage parameter applies only to the first series in a multi-series
 # download. Fetch separately and verify the date encoded in each CSV header.
 year=int(day[:4]);start=f'{year-2}-01-01'
 url=f'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id={series}&cosd={start}&coed={day}&vintage_date={day}'
 rows=list(csv.DictReader(io.StringIO(download(url))))
 column=series+'_'+day.replace('-','')
 if not rows or column not in rows[0]:raise ValueError('Requested vintage not honored')
 values={row['observation_date']:float(row[column]) for row in rows if row.get(column) not in ('','.','NaN',None) and row['observation_date']<=day}
 if not values:raise ValueError('No observations available by this date')
 latest=max(values);record={'series':series,'period':latest,'value':values[latest],'vintage':day,'source_url':f'https://alfred.stlouisfed.org/series?seid={series}','download_url':url}
 if series=='CPIAUCSL':
  prior=f'{int(latest[:4])-1}{latest[4:]}'
  if prior not in values:raise ValueError('Prior-year inflation baseline absent')
  record['value']=(values[latest]/values[prior]-1)*100
  record['calculation']='Year-over-year change in seasonally adjusted CPI, using the same historical vintage'
 return record

result={'generated_at':date.today().isoformat(),'method':'Trailing seven calendar days ending on the entry date; economic data vintage fixed to the entry date.','snapshots':{day:{'start_date':(date.fromisoformat(day)-timedelta(days=6)).isoformat(),'end_date':day,'events':[],'economy':{}} for day in dates}}
events=[]
for year in sorted({int(day[:4]) for day in dates}):
 try:
  records=events_for_year(year);events.extend(records);print(f'Events {year}: {len(records)}',flush=True)
 except Exception as error:print(f'Events unavailable {year}: {error}',flush=True)
for day,snapshot in result['snapshots'].items():
 candidates=[event for event in events if snapshot['start_date']<=event['date']<=day]
 # Chronological samples, at most one excerpt per event date, three in total.
 seen=set()
 for event in sorted(candidates,key=lambda item:item['date'],reverse=True):
  if event['date'] in seen:continue
  snapshot['events'].append(event);seen.add(event['date'])
  if len(snapshot['events'])==3:break
 snapshot['events'].reverse()
completed=0
with ThreadPoolExecutor(max_workers=3) as pool:
 jobs={pool.submit(economic_series,day,series):(day,series) for day in dates for series in ['UNRATE','CPIAUCSL']}
 for future in as_completed(jobs):
  day,series=jobs[future]
  try:result['snapshots'][day]['economy'][series]=future.result()
  except Exception as error:result['snapshots'][day].setdefault('unavailable',[]).append(series)
  completed+=1
  if completed%60==0:print(f'Economic observations: {completed}/{len(jobs)}',flush=True)
try:
 history=parse_market_history(download(DOWNLOAD_URL))
 for day,snapshot in result['snapshots'].items():
  market=market_snapshot(day,history)
  if market:snapshot['market']=market
 print('S&P 500 snapshots: '+str(sum('market' in item for item in result['snapshots'].values())),flush=True)
except Exception as error:
 print('S&P 500 unavailable: '+str(error),flush=True)
(ROOT/'content/weekly-context.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'dates':len(dates),'dates_with_events':sum(bool(s['events']) for s in result['snapshots'].values()),'economic_observations':sum(len(s['economy']) for s in result['snapshots'].values())}),flush=True)
