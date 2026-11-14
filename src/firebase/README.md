# Firebase Organization & Layout

Everything in Matthew Clicker runs on **Firebase Authentication** + **Firebase Realtime Database (RTDB)** — **not Firestore** (Firestore has a strict 50,000 reads/day free cap, so runtime Firestore calls have been removed).

## Clean Realtime Database Folders

- **`users/<uid>`**: Player profiles, unlocked/equipped skins, carried-over gems, cursors, pets, crates, active `seasons/season_2` save, and `probationStatus` (if flagged).
- **`usernames/<username>`**: Lightweight username -> UID login mappings + **`usernames/__admin_<uid>`** (Marshallb78's compact moderation settings, bans, broadcasts, probation resolutions, and tester allowlist).
- **`leaderboards/season_2`**: Live Season 2 leaderboard entries (and any `probation` alert metadata for Dev Tools).
- **`events/`**: Active Global Live Events & queue.
- **`admin/probation_alerts`**: Anti-cheat probation reports waiting for Marshallb78 to review (**Ban** or **Clear Probation**).
- **`clans/` & `trades/`**: Clans and player-to-player pet/skin trades.

## Quota & Cleanup

- Client polling reads **only** `usernames/__admin_<uid>` (~2 KB) every 15s instead of downloading all ~200 accounts in `usernames/`.
- You can remove leftover Season 1 clutter (`leaderboards/season_1`, `usernames/__autoban_*`, `usernames/__moderation_*`, `usernames/__test_*`, `sandbox_s2`) safely from **Dev Tools → Server Controls → Clean Up Season 1 Clutter**. Real player accounts (`usernames/<player>`), skins, and gems inside `users/<uid>` are never deleted.

