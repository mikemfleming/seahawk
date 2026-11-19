import sys,unittest,json
from pathlib import Path
from datetime import datetime,timezone
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from market_context import parse_market_history,market_snapshot
class MarketContextTests(unittest.TestCase):
 def test_weekends_and_holidays_never_select_future_closes(self):
  history={'1995-03-17':495,'1995-03-24':500,'1995-03-27':510}
  record=market_snapshot('1995-03-25',history)
  self.assertEqual(record['close_date'],'1995-03-24');self.assertEqual(record['comparison_date'],'1995-03-17');self.assertAlmostEqual(record['change_percent'],(500/495-1)*100)
  self.assertIsNone(market_snapshot('1995-04-20',history))
 def test_market_shutdown_uses_actual_prior_trading_dates(self):
  history={'2001-08-31':1133.58,'2001-09-07':1085.78,'2001-09-10':1092.54,'2001-09-17':1038.77}
  record=market_snapshot('2001-09-14',history)
  self.assertEqual(record['close_date'],'2001-09-10');self.assertEqual(record['comparison_date'],'2001-09-07');self.assertNotEqual(record['close'],1038.77)
 def test_bad_benchmarks_and_missing_closes_are_rejected(self):
  timestamps=[int(datetime(1995,3,24,21,tzinfo=timezone.utc).timestamp()),int(datetime(1995,3,25,21,tzinfo=timezone.utc).timestamp())]
  payload={'chart':{'result':[{'meta':{'symbol':'^GSPC','instrumentType':'INDEX','exchangeTimezoneName':'America/New_York'},'timestamp':timestamps,'indicators':{'quote':[{'close':[500.97,None]}]}}]}}
  self.assertEqual(parse_market_history(json.dumps(payload)),{'1995-03-24':500.97})
  payload['chart']['result'][0]['meta']['symbol']='OTHER'
  with self.assertRaises(ValueError):parse_market_history(json.dumps(payload))
if __name__=='__main__':unittest.main()
