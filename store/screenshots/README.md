# App Store screenshots

Seven slides, one idea each, in the Zelko brand: paper and ink slides, a visible
12-column grid, Geist headlines, one Klein Blue signal per slide, upright iPhones
cropped by the slide edge.

| # | Slide | Screen |
|---|---|---|
| 01 | Run the shop. Not the paperwork. | Today |
| 02 | Get paid at the chair. | Take payment with a tip |
| 03 | Book them again in one tap. | Booking detail |
| 04 | Every client, remembered. | Client profile |
| 05 | Your shop, in numbers. | Insights |
| 06 | Clients book from a link. | Share your link |
| 07 | Everything the shop runs on. | Feature list |

Upload `out/1320x2868/` to the 6.9" iPhone slot in App Store Connect (in order).
`out/1284x2778/` covers the 6.5" slot if Apple asks for it.

## Regenerate

1. Run the backend locally with the demo shop, and serve the Expo web build on `:8102`.
2. Capture screens (the clock is fixed to 11:20 AM so "In the chair" looks real):
   `python3 capture.py shot:today "tapre:Chris Thompson" shot:detail "tapre:^Collect" 'tap:$10' shot:collect`
   `python3 capture.py tap:Insights shot:insights tap:Clients "tapfirst:Marcus Young" shot:client`
   `python3 capture.py tap:More "tap:Share your link" shot:share`
3. `python3 make.py` writes both sizes to `out/`. Edit copy in the `SLIDES` list at the top of `make.py`.

Use the demo shop only. Never capture a real shop's clients.
