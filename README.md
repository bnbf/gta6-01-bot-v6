# gta6-01-bot-v6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bnbf/gta6-01-bot-v6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bnbf/gta6-01-bot-v6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

LUMEN BAY: Neon Heat — open-world crime in a neon coastal city: 12 story missions, police helicopter + roadblocks, 4 weapons, 4 radio stations, garage upgrades, shops, safehouse, NOS, saves.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, plain static files (game/index.html and its ES modules).

---

<sub>Entered on [make.fun](https://make.fun/?ref=bsqaxrmg&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

## The game

You are Milo Kade, fresh out of a Solmar Bay lockup, trying to take the city back from Big Lou. The world is a deterministic seeded coastal city — six districts (Downtown, Neon Strip, Marina, Industrial, Old Town, Beachfront) with their own palettes and landmarks, a beach and a sea, roads, buildings, parks and palms, all with real collision.

- **Drive and steal** — walk, run, steal any parked car (theft raises the heat once per car), arcade driving with NOS, car damage and smoke.
- **The heat** — 0–5 wanted stars. The PD chases, rams and busts; at 4 stars the helicopter arrives with a spotlight (shoot it down for +$500) and the roads get sealed with roadblocks. Break line of sight for 4 seconds and the heat starts to fall.
- **Fight** — mouse-aim hitscan shooting, 4 weapons (pistol, SMG, shotgun, rifle) with magazines and reload, drive-by shooting, foot officers who chase and bust.
- **12 story missions** — from First Wheels to Kingpin's Fall, plus taxi fares and the Bay Circuit street race.
- **Spend it** — gun shop, diner, Volt Garage (armor / engine / NOS tiers, 6 paints, repairs), safehouse that heals and saves.
- **Listen** — 4 procedural WebAudio synthwave stations (NEON FM, SUNSET DRIVE, BAY BASS, PALM LO-FI); all sound effects are synthesized, no audio files.
- **Light** — golden dusk at 18:40 sliding into neon night at 20:00: neon signs, lamps, headlights and light pools.

Controls: WASD / arrows move, E enter or interact, R reload, Q radio, T taxi, M mute, Shift run / NOS, mouse aim + click shoot, 1–4 weapons, Space start / pause.

## Self-test

Open `game/index.html?test=1` — the game runs a 25-check self-test (city, districts, traffic, police, helicopter, roadblocks, wanted decay, drive-by, missions, save/load, garage, radio, shop, safehouse, taxi, race, NOS) and prints the verdict on screen. Run it 3 times; all 25 must pass.

## Screenshots

`shots.json` stages four real renders from the game itself: a 4-star chase with helicopter and roadblock, the title screen, an on-foot shootout, and a 5-star bank escape.
