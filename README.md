# The Common Table

> Pull up a chair. There's always room for one more.

A relaxing, original collection of classic tabletop games. Built for quiet evenings, friendly competition and people who just want to play. **Free, open source, without accounts, tracking, ads or paywalls.**

## v0.2: four tables open

- **Checkers:** Local two-player American Checkers with forced captures, multiple jumps, crowning, turn/win detection, and undo.
- **Mahjong Solitaire:** A 72-tile layered Garden layout with 18 faces, a solvable initial deal, free-tile validation, hints, and re-deal of remaining tiles. *This is the matching puzzle, not four-player Mahjong.*
- **Dominoes:** Original double-six two-player Draw Dominoes. Private local handoffs, boneyard, left/right placement, pass rules, win and blocked-hand scoring.
- **Solitaire:** Original draw-one Klondike with stock/waste recycling, four foundations, legal tableau stack moves, card reveals, undo, hints and browser saves.
- A cozy responsive parlor lobby, optional soft sound effects, browser-local saved games, and accessible button controls.
- Coming-soon previews for Chess, Backgammon, Go, and traditional four-player Mahjong.

Game logic is written independently, with no imported gameplay engines.

## Run locally

Requires Node.js 22 (Node 20.19+ also works).

```bash
npm install
npm run dev
npm test
npm run build
```

## Publish

GitHub Actions runs validation for pull requests. Merging to `main` triggers the Pages workflow, configured with Vite's `/CommonTable/` base path.

One-time setup: visit **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source. When the deploy succeeds, the site is expected at:

https://michaelwave369.github.io/CommonTable/

The URL is not live until deployment succeeds.

## Game rules and limits

Checkers currently supports two people sharing a device, not a bot. Rules follow American Checkers (men move and capture forward; kings in both directions; mandatory jumps; reaching the king row ends the turn). Undo and a fresh game are available.

Mahjong Solitaire begins with a removal path built into the deal. Alternative player choices can cause a dead end, so the remaining tiles can be re-dealt into another removable arrangement without changing their face counts. Re-dealing can change tile positions to repair a blocked stack. A tile is free when not covered and with at least one horizontal side unblocked.

All four games are local-only. Games save to the current browser using localStorage; clearing browser data clears the saved games. Nothing is sent to a server.

Dominoes is **Draw Dominoes**, not All Fives or a scoring league. Each player draws one tile at a time when blocked and must play when a legal match exists. When two players pass with an empty boneyard, the lower remaining pip total wins. The player's hand is concealed during turn handoff, but this is casual hot-seat play, not secure secrecy from someone inspecting browser storage.

Solitaire is **draw-one Klondike**. Tap to select a card or a descending alternating-color stack, then tap a valid tableau column or suit foundation. The stock is recycled without a pass limit. It has no timer, leaderboards, card drag-and-drop, or automatic solving.

## Roadmap

- Chess, Backgammon, Go, and additional Solitaire variants
- Computer opponents and difficulty settings
- Additional layouts and traditional four-player Mahjong (a separate game)
- Optional installable offline PWA and online room-based multiplayer

## License

MIT © 2026 MichaelWave369. See [LICENSE](LICENSE).
