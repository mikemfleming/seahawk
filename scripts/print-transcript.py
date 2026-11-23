"""Create a text-only print edition from a downloaded, published site snapshot."""
from pathlib import Path
from html import escape
import argparse, json, re, hashlib
from lxml import html
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

parser=argparse.ArgumentParser()
parser.add_argument('snapshot',type=Path)
parser.add_argument('output',type=Path)
parser.add_argument('--highlight-uncertainty',action='store_true',help='Highlight explicitly uncertain bracketed readings in yellow')
args=parser.parse_args()
raw=args.snapshot.read_bytes()
root=html.fromstring(raw.decode('utf-8'))
pages=root.xpath('//section[contains(concat(" ",normalize-space(@class)," ")," log-page ")]')
fontdir=Path('/System/Library/Fonts/Supplemental')
pdfmetrics.registerFont(TTFont('Journal',str(fontdir/'Times New Roman.ttf')))
pdfmetrics.registerFont(TTFont('JournalBold',str(fontdir/'Times New Roman Bold.ttf')))
pdfmetrics.registerFont(TTFont('Labels',str(fontdir/'Arial.ttf')))
pdfmetrics.registerFont(TTFont('UnicodeFallback',str(fontdir/'Arial Unicode.ttf')))
font=pdfmetrics.getFont('Journal')
styles={
 'title':ParagraphStyle('title',fontName='JournalBold',fontSize=26,leading=31,spaceAfter=24),
 'page':ParagraphStyle('page',fontName='Labels',fontSize=9,leading=13,spaceBefore=19,spaceAfter=10,keepWithNext=True),
 'date':ParagraphStyle('date',fontName='JournalBold',fontSize=12,leading=16,spaceBefore=12,spaceAfter=7,keepWithNext=True),
 'body':ParagraphStyle('body',fontName='Journal',fontSize=11.5,leading=16,spaceAfter=9,splitLongWords=False,allowWidows=0,allowOrphans=0),
}
def clean(text):return re.sub(r'\s+',' ',text).strip()
def encode_text(text):
 result=[]
 for char in text:
  safe=escape(char)
  result.append(safe if ord(char) in font.face.charToGlyph else '<font name="UnicodeFallback">'+safe+'</font>')
 return ''.join(result)
def uncertain(text):
 return '?' in text or bool(re.search(r'\b(?:illegible|unreadable|unclear|incomplete|missing)\b',text,re.I))
highlights=[]
def markup(text):
 text=clean(text)
 if not args.highlight_uncertainty:return encode_text(text)
 result=[];offset=0
 for match in re.finditer(r'\[[^\]]*\]',text):
  result.append(encode_text(text[offset:match.start()]))
  value=encode_text(match.group())
  if uncertain(match.group()):
   value='<span backColor="#fff176">'+value+'</span>'
   highlights.append(match.group())
  result.append(value);offset=match.end()
 result.append(encode_text(text[offset:]))
 return ''.join(result)
blocks=[('title','Captain’s Log')]
for section in pages:
 heading=section.xpath('./h2')[0]
 blocks.append(('page',clean(heading.text_content())))
 transcript=section.xpath('./div[contains(concat(" ",normalize-space(@class)," ")," transcription ")]')[0]
 # Exclude weather, charts and controls; preserve published headings, body and notes.
 content=transcript.xpath('.//p[not(ancestor::aside)] | .//h3[not(ancestor::aside)]')
 for node in content:
  text=clean(node.text_content())
  if text and (node.tag=='h3' or 'passage' in (node.get('class') or '').split() or 'entry-clarification' in (node.get('class') or '').split()):blocks.append(('date' if node.tag=='h3' else 'body',text))
args.output.parent.mkdir(parents=True,exist_ok=True)
doc=SimpleDocTemplate(str(args.output),pagesize=letter,rightMargin=58,leftMargin=58,topMargin=52,bottomMargin=49,title='Captain’s Log',author='',pageCompression=1)
flow=[Paragraph(markup(text),styles[kind]) for kind,text in blocks]
def footer(canvas,doc):
 canvas.saveState();canvas.setFont('Labels',8);canvas.setFillGray(.4)
 canvas.drawRightString(letter[0]-58,28,str(doc.page));canvas.restoreState()
doc.build(flow,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(args.output)
# Strip only the generated page number before comparing every printed block in order.
extracted=''.join(re.sub(r'^\d+\s*\n','',page.extract_text(),count=1) for page in reader.pages)
normalized=lambda value:re.sub(r'\s+','',value)
actual=normalized(extracted)
expected=normalized(''.join(text for _,text in blocks))
if actual!=expected:
 first=next((i for i,(a,b) in enumerate(zip(actual,expected)) if a!=b),min(len(actual),len(expected)))
 raise RuntimeError(f'Text verification failed at {first}: {actual[first:first+100]!r} != {expected[first:first+100]!r}')
report={'source':'https://mikemfleming.github.io/seahawk/','source_sha256':hashlib.sha256(raw).hexdigest(),'journal_pages':len(pages),'printed_pages':len(reader.pages),'text_blocks':len(blocks),'verified_exact_text':True,'yellow_highlights':len(highlights),'pdf':str(args.output)}
args.output.with_suffix('.verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
