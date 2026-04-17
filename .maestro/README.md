# Maestro mobile e2e tests

Catches the Hermes-API-missing class of bugs that `expo export` doesn't —
i.e., the code bundles fine but crashes on a real JS engine.

## One-time setup

1. **Install Maestro CLI** (macOS, bundled Temurin 17 JDK lives in `~/.maestro/jdk`):

   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   # If you don't have Java system-wide, use the JDK we already bundled:
   export JAVA_HOME="$HOME/.maestro/jdk/jdk-17.0.18+8/Contents/Home"
   export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
   ```

   These exports are appended to `~/.zshrc` so new shells pick them up
   automatically.

2. **Boot the iOS Simulator and install the dev build** of Clipd:

   ```bash
   cd ~/clipd-app
   npm run ios            # expo prebuild + run on simulator
   ```

3. **Create a test shop on staging** (don't run against prod — the flow
   exercises login + screen mutations). Use the super-admin seed:

   ```bash
   curl -X POST \
     "https://staging.getclipd.ca/clipd-admin/seed-trial-demo?password=<STAGING_SUPER_ADMIN_KEY>&slug=maestro-smoke"
   ```

   Note the slug + password that seeds returns. Export them for the
   runner:

   ```bash
   export MAESTRO_TEST_SHOP_SLUG=maestro-smoke
   export MAESTRO_TEST_SHOP_PASSWORD=<password from seed>
   ```

## Run the suite

```bash
# Single flow
maestro test .maestro/00_login.yaml

# Entire directory, in declared order (00_*, 01_*, 02_*, 03_*)
maestro test .maestro
```

Each flow is self-contained and starts with `runFlow: 00_login.yaml` so
you can run any of them individually without re-implementing login.

## What each flow covers

| File | Covers |
|---|---|
| `00_login.yaml` | JS bundle boots, LoginScreen renders, api.adminLogin succeeds, TodayScreen renders "Today" strip |
| `01_schedule_loads.yaml` | Tab-bar navigation works; DayCalendarView imports resolve; `/api/admin/schedule` returns a shape the UI can handle |
| `02_verify_banner_dismisses.yaml` | AC-3-001 mobile banner surfaces for unverified shops; "I've verified" polls `/api/admin/settings` and dismisses cleanly |
| `03_logout.yaml` | Settings screen renders; `clearSession` + token revocation on logout works; RoleProvider tears down without crashing |

## Validating flow YAML without a simulator

Maestro's parser catches YAML errors and selector typos without needing
an actual simulator — useful in CI pre-flight:

```bash
maestro test --dry-run .maestro
```

## When a flow fails

Maestro writes a screenshot + view hierarchy dump to
`~/.maestro/tests/<run-id>/` on failure. Read `commands.yaml` and
`screenshots/` to see exactly where it broke.

## Future work

- Wire `maestro test --dry-run` into CI so flow YAML regressions are
  caught at PR time.
- Add a `staff_login.yaml` flow once the staff login screen stabilises.
- Add a booking-detail-modal flow once we have fixture data we can rely
  on (need a shop seeded with a visible booking for the test date).
