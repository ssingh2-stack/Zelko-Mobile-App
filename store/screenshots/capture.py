"""Capture app screens for the store screenshots: 440x902 @3x (1320x2706), leaving room for the
9:41 status bar make.py adds. Needs the Flask backend on :5055 with the demo shop and the Expo web
build served on :8102. Usage: capture.py step...  steps: tap:TEXT tapfirst:TEXT tapre:REGEX scroll:PX shot:NAME wait:MS home"""
import sys, json, os, urllib.request
from datetime import datetime
from playwright.sync_api import sync_playwright
OUT=os.path.dirname(os.path.abspath(__file__))+'/screens/'
# Local demo shop only (never a real shop)
tok=json.load(urllib.request.urlopen(urllib.request.Request('http://localhost:5055/api/mobile/admin-login',data=json.dumps({'slug':os.environ.get('DEMO_SLUG','zelko-trial'),'password':os.environ.get('DEMO_PASSWORD','demo-pass-123')}).encode(),headers={'Content-Type':'application/json'})))
steps=sys.argv[1:]
with sync_playwright() as p:
  b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args=["--no-sandbox","--disable-web-security"])
  ctx=b.new_context(viewport={'width':440,'height':902},device_scale_factor=3,timezone_id='America/Toronto',has_touch=True,is_mobile=True)
  pg=ctx.new_page(); errs=[]
  from zoneinfo import ZoneInfo; pg.clock.install(time=datetime.now(ZoneInfo('America/Toronto')).replace(hour=11,minute=20,second=0,microsecond=0))
  pg.on('pageerror',lambda e:errs.append(str(e)[:120]))
  pg.goto('http://localhost:8102/')
  pg.evaluate("([t,p])=>{localStorage.setItem('mobile_token',t);localStorage.setItem('mobile_profile',p)}",[tok['token'],json.dumps({'role':'admin',**tok})])
  pg.reload(); pg.wait_for_timeout(4000)
  for s in steps:
    k,_,v=s.partition(':')
    try:
      if k=='tap': pg.get_by_text(v,exact=True).last.click(timeout=4000); pg.wait_for_timeout(1600)
      elif k=='tapfirst': pg.get_by_text(v,exact=True).first.click(timeout=4000); pg.wait_for_timeout(1600)
      elif k=='tapre': pg.get_by_text(__import__('re').compile(v)).first.click(timeout=4000); pg.wait_for_timeout(1600)
      elif k=='scroll': pg.mouse.move(220,600); pg.mouse.wheel(0,int(v)); pg.wait_for_timeout(800)
      elif k=='wait': pg.wait_for_timeout(int(v))
      elif k=='home': pg.goto('http://localhost:8102/'); pg.wait_for_timeout(3500)
      elif k=='texts': print(pg.evaluate("[...document.querySelectorAll('div[dir=auto]')].map(e=>e.textContent).filter(t=>t&&t.length<40).slice(0,80).join(' | ')"))
      elif k=='shot': pg.screenshot(path=OUT+v+'.png')
    except Exception as e: errs.append(f'{s}: {str(e)[:100]}')
  print('\n'.join(errs[:10]))
  b.close()
