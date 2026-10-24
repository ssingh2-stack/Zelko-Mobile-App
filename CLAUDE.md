# Zelko mobile app

The Zelko iOS app (formerly Clipd), Expo SDK 54 and React Native 0.81. Talks to the Flask backend at `app.zelko.ca` (repo `ssingh2-stack/Zelko`). Set `EXPO_PUBLIC_API_URL` to point a dev build at staging or a local backend.

- The product is **Zelko** (formerly Clipd). Never write "Clipd" in new code, copy or assets. The bundle ID `ca.getclipd.app`, EAS slug `clipd-app` and project ID stay as they are: changing them would create a new App Store app.
- Colours come only from `C` in `src/lib/theme.js` (mirrors `brand/tokens.css`): Klein Blue `C.blue` for primary actions and selected states; `C.spark` only as a small highlight (the chosen tip, New client), never a button or large fill; paper, surface, sunk, line, ink and muted for everything else. Charging money uses `C.night`. No other blues.
- Type: Geist for UI and body, Geist Mono for uppercase labels and data. Custom fonts pick weight by family, so use `F.regular`, `F.medium`, `F.semibold`, `F.mono`, `F.monoMedium`, never `fontWeight`. Headlines are `F.regular`; hierarchy from size. Money uses `fontVariant: ["tabular-nums"]`.
- Logos: use `Wordmark` and `Symbol` from `src/components/Brand.js`; never retype the wordmark.
- Copy: sentence case, short sentences, no exclamation marks, no emoji. Say "clients", "shop", "barber".
- Never promise payout timing; show Stripe's expected arrival date. Label unshipped features "Early access".
- Status is always a word plus colour (Paid ✓, Booked, No-show), never colour alone. Text contrast at least 4.5:1.
- Before building a screen, check `brand/components/<Name>/README.md` in the Zelko repo for the pattern.
