"""Build the App Store screenshots for Zelko.

Swiss-grid layout in the Zelko brand: paper and ink slides alternate, a visible
12-column hairline grid, flush-left Geist headlines, mono index labels, upright
iPhones cropped by the slide edge, and exactly one Klein Blue signal per slide.

    python3 make.py            # writes out/1320x2868/*.png and out/1284x2778/*.png

Needs Playwright with Chromium. App screens live in screens/ and come from
capture.py (440x902 @3x, so a 9:41 status bar fits on top without cropping).
"""
import base64
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SIZES = [(1320, 2868), (1284, 2778)]  # 6.9" (required) and 6.5"
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

PAPER, INK, BLUE = "#F7F6F1", "#0E0E0C", "#1A24C9"

# One idea per slide. `mark` is the single Klein Blue element: text on paper, a block on ink.
SLIDES = [
    dict(slug="today", theme="paper", label="Today", screen="today", layout="top",
         head=["Run the shop.", "<mark>Not the paperwork.</mark>"],
         sub="Bookings, payments and payouts for barbershops."),
    dict(slug="pay", theme="ink", label="Zelko Pay", screen="collect", layout="bottom",
         head=["Get paid", "<mark>at the chair.</mark>"],
         sub="Card or cash, with tips that go to the barber who earned them."),
    dict(slug="rebook", theme="paper", label="Zelko Booking", screen="detail", layout="top",
         head=["Book them again", "<mark>in one tap.</mark>"],
         sub="Same barber and service, two to four weeks out."),
    dict(slug="clients", theme="ink", label="Zelko Clients", screen="client", layout="top",
         head=["Every client,", "<mark>remembered.</mark>"],
         sub="Visits, spend and private notes in one place."),
    dict(slug="insights", theme="paper", label="Zelko Insights", screen="insights", layout="bottom",
         head=["Your shop,", "<mark>in numbers.</mark>"],
         sub="Revenue and every barber, against last period."),
    dict(slug="link", theme="ink", label="Zelko Booking", screen="share", layout="top",
         head=["Clients book", "<mark>from a link.</mark>"],
         sub="No app to download. No account to make."),
    dict(slug="more", theme="paper", label="Built for barbershops", screen=None, layout="list",
         head=["Everything the", "<mark>shop runs on.</mark>"],
         rows=[("Walk-ins in two taps", "Booking"), ("A waitlist when you're full", "Booking"),
               ("Deposits that hold the chair", "Pay"), ("Tips to the right barber", "Pay"),
               ("Commission and booth rent", "Team"), ("Reminders before every visit", "Clients"),
               ("Your own booking site", "Sites"), ("An end-of-day summary", "Insights")]),
]


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def top_colour(png: Path) -> str:
    """Colour of the screen's top edge, so the status bar blends into the app."""
    from PIL import Image
    im = Image.open(png).convert("RGB")
    r, g, b = im.getpixel((im.width // 2, 4))
    return f"#{r:02x}{g:02x}{b:02x}"


def is_light(hex_colour: str) -> bool:
    r, g, b = (int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))
    return (0.299 * r + 0.587 * g + 0.114 * b) > 140


FONTS = "".join(
    f"@font-face{{font-family:'{fam}';src:url('{data_uri(HERE / 'fonts' / f, 'font/woff2')}') format('woff2');font-weight:{w}}}"
    for fam, f, w in [("Geist", "Geist-Regular.woff2", 400), ("Geist", "Geist-Medium.woff2", 500),
                      ("Geist", "Geist-SemiBold.woff2", 600), ("Geist Mono", "GeistMono-Regular.woff2", 400),
                      ("Geist Mono", "GeistMono-Medium.woff2", 500)])

STATUS_ICONS = """<svg viewBox="0 0 76 14" fill="currentColor" style="height:calc(30*var(--u));width:auto">
<rect x="0" y="9" width="3.4" height="4.6" rx="1"/><rect x="4.9" y="6.6" width="3.4" height="7" rx="1"/>
<rect x="9.8" y="4" width="3.4" height="9.6" rx="1"/><rect x="14.7" y="1.4" width="3.4" height="12.2" rx="1"/>
<path d="M30.5 3.4a10.6 10.6 0 0 1 7.3 2.9l1.3-1.3a12.4 12.4 0 0 0-17.2 0l1.3 1.3a10.6 10.6 0 0 1 7.3-2.9Zm0 3.6a7 7 0 0 1 4.8 1.9l1.3-1.3a8.8 8.8 0 0 0-12.2 0l1.3 1.3A7 7 0 0 1 30.5 7Zm0 3.6c-.9 0-1.7.3-2.3.9l2.3 2.3 2.3-2.3c-.6-.6-1.4-.9-2.3-.9Z"/>
<rect x="45" y="1.2" width="25" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.1"/>
<rect x="47" y="3.2" width="21" height="8" rx="2.2"/><path d="M71.6 5.2v4a2.2 2.2 0 0 0 0-4Z" fill-opacity=".45"/></svg>"""


def phone(screen: str) -> str:
    png = HERE / "screens" / f"{screen}.png"
    bar = top_colour(png)
    fg = INK if is_light(bar) else PAPER
    return f"""<div class="phone"><div class="screen">
      <div class="status" style="background:{bar};color:{fg}"><span>9:41</span>{STATUS_ICONS}</div>
      <img src="{data_uri(png, 'image/png')}" alt="">
      <div class="island"></div></div></div>"""


def slide_html(s: dict, n: int, total: int, w: int, h: int) -> str:
    dark = s["theme"] == "ink"
    bg, fg = (INK, PAPER) if dark else (PAPER, INK)
    muted = "#A3A09A" if dark else "#5E5C57"
    rule = "rgba(243,241,236,.12)" if dark else "rgba(14,14,12,.10)"
    logo = data_uri(HERE / f"zelko-wordmark-{'paper' if dark else 'ink'}.svg", "image/svg+xml")
    head = "<br>".join(s["head"])
    grid = "".join(f'<i style="left:calc({72 + 98 * c}*var(--u))"></i>' for c in range(13))
    body = ""
    if s["layout"] == "list":
        body = '<ol class="rows">' + "".join(
            f'<li><span class="n">{i + 1:02d}</span><span class="t">{t}</span><span class="k">{k}</span></li>'
            for i, (t, k) in enumerate(s["rows"])) + "</ol>"
    else:
        body = phone(s["screen"])
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{FONTS}
:root{{--u:calc({w}px/1320);--H:{h}px}}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:{w}px;height:{h}px;overflow:hidden;background:{bg};color:{fg};font-family:Geist;-webkit-font-smoothing:antialiased}}
.grid i{{position:absolute;top:0;bottom:0;width:calc(2*var(--u));background:{rule}}}
.index{{position:absolute;left:calc(72*var(--u));right:calc(72*var(--u));top:calc(92*var(--u));height:calc(64*var(--u));display:flex;align-items:center;
  font:500 calc(26*var(--u))/1 'Geist Mono';letter-spacing:.06em;text-transform:uppercase;color:{muted};border-bottom:calc(3*var(--u)) solid {fg}}}
.index img{{height:calc(34*var(--u));display:block}}
.index .sec{{position:absolute;left:calc(392*var(--u))}}
.index .num{{margin-left:auto;color:{fg}}}
.copy{{position:absolute;left:calc(72*var(--u));right:calc(72*var(--u))}}
.copy.top{{top:calc(220*var(--u))}}
.copy.bottom{{bottom:calc(150*var(--u))}}
h1{{font-weight:400;font-size:calc(150*var(--u));line-height:.96;letter-spacing:-.045em;white-space:nowrap}}
h1 mark{{background:none;color:{'inherit' if dark else BLUE}}}
{'h1 mark{background:'+BLUE+';color:#fff;padding:0 calc(18*var(--u)) calc(6*var(--u));margin-left:calc(-18*var(--u));box-decoration-break:clone;-webkit-box-decoration-break:clone}' if dark else ''}
.sub{{margin-top:calc(40*var(--u));font-size:calc(44*var(--u));line-height:1.25;letter-spacing:-.01em;color:{muted};max-width:calc(1000*var(--u))}}
.phone{{position:absolute;left:calc(136*var(--u));width:calc(1048*var(--u));padding:calc(24*var(--u));border-radius:calc(149*var(--u));
  background:#0E0E0C;box-shadow:inset 0 0 0 calc(4*var(--u)) {'#5A5A55' if dark else '#3B3B37'},inset 0 0 0 calc(7*var(--u)) #0E0E0C;
  filter:{'drop-shadow(0 0 calc(2*var(--u)) rgba(243,241,236,.35)) drop-shadow(0 calc(30*var(--u)) calc(60*var(--u)) rgba(0,0,0,.5))' if dark else 'drop-shadow(0 calc(3*var(--u)) calc(2*var(--u)) rgba(14,14,12,.28)) drop-shadow(0 calc(22*var(--u)) calc(34*var(--u)) rgba(14,14,12,.14))'}}}
.screen{{position:relative;width:calc(1000*var(--u));height:calc(2173*var(--u));border-radius:calc(125*var(--u));overflow:hidden;background:{PAPER}}}
.status{{height:calc(123*var(--u));display:flex;align-items:center;justify-content:space-between;padding:calc(18*var(--u)) calc(66*var(--u)) 0 calc(96*var(--u));
  font:600 calc(40*var(--u))/1 Geist;letter-spacing:-.01em}}
.screen img{{display:block;width:100%;height:calc(2050*var(--u))}}
.island{{position:absolute;top:calc(26*var(--u));left:50%;transform:translateX(-50%);width:calc(290*var(--u));height:calc(86*var(--u));border-radius:999px;background:#000}}
.layout-top .phone{{top:calc(var(--H) - 2010*var(--u))}}
.layout-bottom .phone{{top:calc(-250*var(--u))}}
/* Phone hangs from the top: the index row moves down to sit above the headline */
.layout-bottom .index{{top:auto;bottom:calc(var(--copyh) + 190*var(--u))}}
.rows{{list-style:none;position:absolute;left:calc(72*var(--u));right:calc(72*var(--u));top:calc(860*var(--u))}}
.rows li{{display:flex;align-items:baseline;gap:calc(32*var(--u));padding:calc(64*var(--u)) 0;border-top:calc(2*var(--u)) solid {rule.replace('.10', '.22')}}}
.rows li:last-child{{border-bottom:calc(2*var(--u)) solid {rule.replace('.10', '.22')}}}
.rows .n,.rows .k{{font:500 calc(28*var(--u))/1 'Geist Mono';letter-spacing:.06em;text-transform:uppercase;color:{muted}}}
.rows .n{{width:calc(64*var(--u))}}
.rows .t{{flex:1;font-size:calc(72*var(--u));letter-spacing:-.03em;line-height:1.1}}
</style></head><body class="layout-{s['layout']}">
<div class="grid">{grid}</div>
<div class="index"><img src="{logo}" alt="Zelko"><span class="sec">{s['label']}</span><span class="num">{n:02d} / {total:02d}</span></div>
{body}
<div class="copy {'bottom' if s['layout'] == 'bottom' else 'top'}"><h1>{head}</h1>{f'<p class="sub">{s["sub"]}</p>' if s.get('sub') else ''}</div>
<script>
  // Fit the headline: the widest line may use at most 1176 of 1320 units
  document.fonts.ready.then(() => {{
    const h = document.querySelector('h1'), u = {w} / 1320;
    let size = 150;
    while (h.scrollWidth > 1176 * u && size > 96) {{ size -= 2; h.style.fontSize = (size * u) + 'px'; }}
    const c = document.querySelector('.copy.bottom');
    if (c) document.documentElement.style.setProperty('--copyh', c.offsetHeight + 'px');
    document.body.dataset.ready = '1';
  }});
</script></body></html>"""


def main():
    only = set(sys.argv[1:])
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for w, h in SIZES:
            out = HERE / "out" / f"{w}x{h}"
            out.mkdir(parents=True, exist_ok=True)
            page = browser.new_page(viewport={"width": w, "height": h})
            for i, s in enumerate(SLIDES, 1):
                if only and s["slug"] not in only:
                    continue
                tmp = HERE / "out" / ".slide.html"
                tmp.write_text(slide_html(s, i, len(SLIDES), w, h), encoding="utf8")
                page.goto(tmp.as_uri())
                page.wait_for_selector("body[data-ready='1']")
                page.screenshot(path=str(out / f"{i:02d}-{s['slug']}.png"))
                print(out / f"{i:02d}-{s['slug']}.png")
            page.close()
        (HERE / "out" / ".slide.html").unlink(missing_ok=True)
        browser.close()


if __name__ == "__main__":
    main()
