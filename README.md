# The Common Table

> Pull up a chair. There's always room for one more.

A relaxing, original collection of classic tabletop games. Built for quiet evenings, friendly competition and people who just want to play. **Free, open source, without accounts, tracking, ads or paywalls.**

## v0.7: Kalah Mancala at the eighth table

- **Checkers:** American Checkers with local two-player mode **or** solo play versus a built-in Ember opponent (Easy/Medium/Hard). Forced captures, multiple jumps, crowning, turn/win detection, and undo.
- **Mahjong Solitaire:** A 72-tile layered Garden layout with 18 faces, a solvable initial deal, free-tile validation, hints, and re-deal of remaining tiles. *This is the matching puzzle, not four-player Mahjong.*
- **Dominoes:** Original double-six two-player Draw Dominoes. Private local handoffs, boneyard, left/right placement, pass rules, win and blocked-hand scoring.
- **Solitaire:** Original draw-one Klondike with stock/waste recycling, four foundations, legal tableau stack moves, card reveals, undo, hints and browser saves.
- **Chess:** Original standard Chess with local two-player mode **or** solo play versus built-in Onyx (Easy/Medium/Hard). King-safety move validation, castling, en passant, all four promotion options, checkmate, stalemate, and draw detection. Includes move log, move highlights, board flip, undo and saved progress.
- **Backgammon:** A playable standard-setup, two-player local game with dice rolls, doubles, mandatory dice usage, legal destinations, blocked points, hits/bar re-entry, bearing off, win detection, undo, and browser-local saves.
- **Reversi:** Original 8×8 game with legal flipping in eight directions, forced automatic passes, final disc-count scoring, move hints, highlights, undo and saved local progress. Supports pass-and-play or an Easy/Medium/Hard browser-local opponent.
- **Mancala (Kalah):** Independent six-pit/four-stone Kalah game with counterclockwise sowing, captures, extra turns, game-end sweeping and winner/tie scoring. Play two people locally, or Ivory versus an original Easy/Medium/Hard offline Onyx opponent. Includes hint, undo and browser-local save.
- A cozy responsive parlor lobby, optional soft sound effects, browser-local saved games, and accessible button controls.
- Coming-soon previews for Go, Nine Men's Morris, and traditional four-player Mahjong.

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

Checkers supports either two people sharing a device or a single Ivory player facing the Ember computer. Rules follow American Checkers (men move and capture forward; kings in both directions; mandatory jumps; reaching the king row ends the turn). Undo and a fresh game are available.

Mahjong Solitaire begins with a removal path built into the deal. Alternative player choices can cause a dead end, so the remaining tiles can be re-dealt into another removable arrangement without changing their face counts. Re-dealing can change tile positions to repair a blocked stack. A tile is free when not covered and with at least one horizontal side unblocked.

All eight games are local-only. Games save to the current browser using localStorage; clearing browser data clears the saved games. Nothing is sent to a server.

Dominoes is **Draw Dominoes**, not All Fives or a scoring league. Each player draws one tile at a time when blocked and must play when a legal match exists. When two players pass with an empty boneyard, the lower remaining pip total wins. The player's hand is concealed during turn handoff, but this is casual hot-seat play, not secure secrecy from someone inspecting browser storage.

Solitaire is **draw-one Klondike**. Tap to select a card or a descending alternating-color stack, then tap a valid tableau column or suit foundation. The stock is recycled without a pass limit. It has no timer, leaderboards, card drag-and-drop, or automatic solving.

Chess supports **local hot-seat play** and **solo offline play** with Ivory versus the Onyx computer. The engine prevents moves that expose your king and prevents castling through check. You can promote a pawn to a queen, rook, bishop or knight. In this casual no-clock mode, threefold repetition and the fifty-move rule end games automatically as draws rather than requiring a player to claim them; the engine also recognizes stalemate and common insufficient-material positions. Move history uses readable coordinate notation, not full SAN/PGN. Undo works within the current visit (a complete human/computer exchange in solo mode); progress persists locally in the browser.

### Computer opponents (v0.4)

The Chess and Checkers tables include a **Who’s Sitting Across?** mode switch and Easy/Medium/Hard difficulty setting. Computer turns are chosen using a small independent browser-local heuristic minimax/alpha-beta search. No online AI subscription, downloads, server calls, model weights, or account is required. Their moves pass through the games’ existing legality engines; Checkers continues all forced jumps automatically.

**Solo mode:** Human plays Ivory (White); computer plays Ember (Checkers) or Onyx (Chess). Switching modes resets the current game to avoid silently changing a two-player match into a bot match. Difficulty may be adjusted midgame. Solo Undo rewinds through the computer's reply and your previous turn when available. Two-player Undo still reverses a single move. Solo settings save per game; clearing local browser data clears them.

Easy uses shallow tactical evaluation; Medium searches a little further; Hard searches still further with a node budget to protect slower devices. These are **casual lightweight opponents**, not rated engines. Chess calculations may briefly occupy the main browser thread on slower hardware.

### Backgammon (v0.5)

Two people share the device. Ivory moves checkers from point 24 toward point 1, while Onyx travels from point 1 toward point 24. Roll to begin a turn. Play all dice when possible; doubles grant four moves. If only one of two distinct dice can be played, the higher die must be used. Opponent points containing two or more checkers cannot be entered. Hitting a single opposing checker sends it to the bar; bar checkers must re-enter first. Bear off once all fifteen of your checkers have reached home. The first side to bear off all fifteen wins.

This relaxed implementation has no doubling cube, gammon/backgammon match scoring, opening-roll competition, or computer opponent. Ivory starts and rolls first. The remaining dice and legal destinations are displayed, and turns automatically pass when no legal continuation exists. Browser saves persist current state; undo history lasts until refresh.

### Checkers visual correction (v0.5)

Fixed 8 equal grid row heights and square 1:1 checker-piece dimensions. Crown symbols are absolutely positioned inside pieces so kings cannot distort the board layout. This only changes presentation; the original king movement rules remain unchanged.

### Reversi (v0.6)

The seventh table is **Reversi**: Onyx plays first, with Ivory as the second player. A legal placement must bracket one or more opposing discs in at least one of eight straight directions, flipping every enclosed line. If a player has no legal placement, their turn automatically passes. The game ends when neither player can move, and the higher disc count wins. Equal totals draw.

Choose **Two players** for on-device pass-and-play, or **Solo** to play Ivory against Onyx (the computer opens). The optional computer uses an independently written browser-local positional evaluation and bounded Easy (1-ply), Medium (2-ply), and Hard (4-ply) alpha-beta search. Hints suggest a legal placement. Neither network access nor an external game engine is required. These are casual opponents, not competitive rated engines.

Browser-local saves preserve your current game and opponent settings. Undo history is available during the current visit and can revert a complete player/computer exchange. Changing Solo/Two Players modes starts a fresh game. No web accounts, timer or server-side game state.

### Mancala / Kalah (v0.7)

The eighth table is **Kalah**, one particular two-player Mancala ruleset. Each side has six pits with four stones apiece, plus one scoring store. Ivory moves first. A player picks any nonempty pit on their side and sows all its stones counterclockwise, one at a time, skipping the opposing store. Landing your last stone in your own store grants another move. If the last stone lands in an empty pit on your own side opposite an occupied enemy pit, you capture both the last stone and those opposite stones into your store. When either side's six pits empty, the other player sweeps their remaining stones into their store. Most stored stones wins, equal scores tie. This release has no tournament clock or alternate regional Mancala variants.

Choose **Two players** for local pass-and-play or **Solo** to play as Ivory against the browser-only Onyx computer. Easy uses a one-ply static evaluation, Medium three-ply and Hard six-ply bounded lookahead. These are casual search opponents, not professional solvers. Current game and options are kept in local browser storage, while undo history is retained only during the visit. Solo Undo reverses to the latest Ivory decision, including any intervening Onyx moves. Switching modes starts a new game; changing difficulty does not.

## Roadmap

- Go, Nine Men's Morris, traditional four-player Mahjong, and additional Solitaire variants
- Stronger search, computer-versus-computer lab mode, optional side selection, and opening books
- Additional layouts and traditional four-player Mahjong (a separate game)
- Optional installable offline PWA and online room-based multiplayer

## License

MIT © 2026 MichaelWave369. See [LICENSE](LICENSE).
