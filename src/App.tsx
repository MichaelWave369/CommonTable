import { useEffect, useMemo, useState } from 'react';
import DominoesRoom from './components/DominoesRoom';
import SolitaireRoom from './components/SolitaireRoom';
import { applyMove, legalMoves, movesFrom, newCheckersGame, type CheckersGame, type Position } from './lib/checkers';
import { availablePairs, isFree, newMahjongGame, removePair, shuffleRemaining, type MahjongTile } from './lib/mahjong';

type Room = 'lobby' | 'checkers' | 'mahjong' | 'dominoes' | 'solitaire';

function saved<T>(key: string, fallback: () => T, validate: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem('commontable:' + key);
    if (raw) {
      const data: unknown = JSON.parse(raw);
      if (validate(data)) return data;
    }
  } catch { /* Browsers may disable local storage. */ }
  return fallback();
}
function validCheckers(value: unknown): value is CheckersGame {
  if (!value || typeof value !== 'object') return false;
  const game = value as CheckersGame;
  return (game.turn === 'ember' || game.turn === 'ivory') &&
    Array.isArray(game.board) && game.board.length === 8 &&
    game.board.every((row) => Array.isArray(row) && row.length === 8);
}
function validMahjong(value: unknown): value is MahjongTile[] {
  return Array.isArray(value) && value.length <= 72 && value.length % 2 === 0 &&
    value.every((tile) => tile && typeof tile.id === 'string' &&
      typeof tile.face === 'string' && typeof tile.row === 'number' &&
      typeof tile.col === 'number' && typeof tile.layer === 'number');
}
function persist(key: string, value: unknown): void {
  try { window.localStorage.setItem('commontable:' + key, JSON.stringify(value)); } catch { /* Optional. */ }
}
function playClick(enabled: boolean, frequency = 520): void {
  if (!enabled) return;
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.74, ctx.currentTime + 0.065);
    gain.gain.setValueAtTime(0.042, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.075);
    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => { void ctx.close(); };
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch { /* Muted if audio isn't supported. */ }
}

const upcoming = [
  { title: 'Chess', subtitle: 'A game of kings and quiet strategy.', symbol: '♞' },
  { title: 'Backgammon', subtitle: 'Roll the dice, enjoy the journey.', symbol: '⚄' },
  { title: 'Go', subtitle: 'A thousand conversations in black and white.', symbol: '●' },
  { title: 'Four-player Mahjong', subtitle: 'The full tile-table tradition.', symbol: '中' },
];

function Brand() {
  return (
    <span className="brand-lockup">
      <span className="brand-icon" aria-hidden="true">✣</span>
      <span className="brand-words"><strong>The Common Table</strong><small>A PLACE TO PLAY & UNWIND</small></span>
    </span>
  );
}

function Lobby({ onEnter }: { onEnter: (room: Room) => void }) {
  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow"><span className="status-light" /> THE PARLOR IS OPEN <span className="eyebrow-line" /></div>
          <h1>A little play.<br /><em>A little peace.</em></h1>
          <p>Classic games, good company, and nowhere else you need to be. Your favorite seat is waiting.</p>
          <button className="gold-button hero-cta" onClick={() => onEnter('mahjong')}>Pull up a chair <span aria-hidden="true">↗</span></button>
          <div className="hero-note">FREE FOREVER <span>✦</span> NO ACCOUNTS <span>✦</span> JUST PLAY</div>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="lamp-glow" />
          <div className="lamp"><div className="lamp-top" /><div className="lamp-neck" /><div className="lamp-base" /></div>
          <div className="window-arch"><div className="window-moon" /><span>✦</span><span>✦</span><span>✧</span></div>
          <div className="illustration-table">
            <div className="table-felt">
              <div className="table-tiles">
                <span>三</span><span>●</span><span>六</span><span>❖</span><span>五</span>
              </div>
              <div className="table-token token-one" /><div className="table-token token-two" />
            </div>
          </div>
          <div className="hero-flourish">EST. FOR EVERYONE</div>
        </div>
      </section>

      <section className="games-section" id="tables">
        <div className="section-head">
          <div><div className="overline">01 / THE TABLES</div><h2>What shall we play?</h2></div>
          <div className="section-side">FOUR TABLES ARE READY FOR YOU <span className="little-spark">✣</span></div>
        </div>
        <div className="table-grid">
          <button className="game-card checkers-card" onClick={() => onEnter('checkers')}>
            <div className="game-card-top"><span className="game-number">TABLE NO. 01</span><span className="live-tag">● OPEN</span></div>
            <div className="checkers-preview" aria-hidden="true">
              {Array.from({ length: 64 }, (_, i) => {
                const row = Math.floor(i / 8); const col = i % 8;
                const dark = (row + col) % 2 === 1;
                return <span key={i} className={dark ? 'preview-dark' : 'preview-light'}>
                  {dark && (row < 2 || row > 5) && <i className={row < 2 ? 'preview-piece ember' : 'preview-piece ivory'} />}
                </span>;
              })}
            </div>
            <div className="game-card-bottom"><div><h3>Checkers</h3><p>Easy to learn. A lifetime to master.</p><span className="game-meta">2 PLAYERS · SAME DEVICE</span></div><span className="round-arrow">↗</span></div>
          </button>
          <button className="game-card mahjong-card" onClick={() => onEnter('mahjong')}>
            <div className="game-card-top"><span className="game-number">TABLE NO. 02</span><span className="live-tag">● OPEN</span></div>
            <div className="mahjong-preview" aria-hidden="true"><div className="preview-tile-row">
              {['二', '●', '三', '✤', '六', '一'].map((value, i) => <span key={i}>{value}<small>{i % 2 ? 'DOTS' : 'BAM'}</small></span>)}
            </div></div>
            <div className="game-card-bottom"><div><h3>Mahjong Solitaire</h3><p>Find a match. Find your calm.</p><span className="game-meta">SOLO · GARDEN LAYOUT</span></div><span className="round-arrow">↗</span></div>
          </button>
          <button className="game-card dominoes-card" onClick={() => onEnter('dominoes')}>
            <div className="game-card-top"><span className="game-number">TABLE NO. 03</span><span className="live-tag">● OPEN</span></div>
            <div className="domino-preview" aria-hidden="true">
              <span><b>●</b><b>••</b></span><span><b>•••</b><b>●</b></span><span><b>••</b><b>•••</b></span>
              <span><b>●</b><b>●</b></span>
            </div>
            <div className="game-card-bottom"><div><h3>Dominoes</h3><p>One more round, one more tile.</p><span className="game-meta">2 PLAYERS · DRAW DOMINOES</span></div><span className="round-arrow">↗</span></div>
          </button>
          <button className="game-card solitaire-card" onClick={() => onEnter('solitaire')}>
            <div className="game-card-top"><span className="game-number">TABLE NO. 04</span><span className="live-tag">● OPEN</span></div>
            <div className="solitaire-preview" aria-hidden="true"><span>♠<small>A</small></span><span>♥<small>Q</small></span><span>♣<small>7</small></span><span>♦<small>K</small></span></div>
            <div className="game-card-bottom"><div><h3>Solitaire</h3><p>A little peace and a deck of cards.</p><span className="game-meta">SOLO · DRAW-ONE KLONDIKE</span></div><span className="round-arrow">↗</span></div>
          </button>
        </div>
      </section>
      <section className="coming-section">
        <div className="section-head"><div><div className="overline">02 / ON THE HORIZON</div><h2>More seats to fill.</h2></div><span className="coming-phrase">THE BEST THINGS TAKE THEIR TIME</span></div>
        <div className="upcoming-grid">
          {upcoming.map((game) => <div className="upcoming-card" key={game.title}>
            <span className="upcoming-symbol" aria-hidden="true">{game.symbol}</span>
            <h3>{game.title}</h3><p>{game.subtitle}</p><span className="upcoming-label">COMING SOON</span>
          </div>)}
        </div>
      </section>
      <section className="invitation"><span className="invitation-star">✣</span><p>No pressure. No scoreboards to chase.<br />Just a good game and a moment to yourself.</p><span className="invitation-star">✣</span></section>
    </main>
  );
}

function Checkers({ sound }: { sound: boolean }) {
  const [game, setGame] = useState<CheckersGame>(() => saved('checkers', newCheckersGame, validCheckers));
  const [selected, setSelected] = useState<Position | null>(null);
  const [history, setHistory] = useState<CheckersGame[]>([]);
  const moves = useMemo(() => legalMoves(game), [game]);
  const targets = selected ? movesFrom(game, selected) : [];
  useEffect(() => { persist('checkers', game); }, [game]);

  function choose(row: number, col: number) {
    if (game.winner) return;
    const target = targets.find((move) => move.to.row === row && move.to.col === col);
    if (target) {
      const next = applyMove(game, target);
      if (next === game) return;
      setHistory((stack) => [...stack, game]);
      setGame(next);
      setSelected(next.forcedFrom);
      playClick(sound, target.jumped ? 380 : 510);
      return;
    }
    const piece = game.board[row][col];
    if (piece?.player === game.turn && moves.some((m) => m.from.row === row && m.from.col === col)) {
      setSelected({ row, col }); playClick(sound, 640);
    } else if (!game.forcedFrom) {
      setSelected(null);
    }
  }
  const reset = () => { setGame(newCheckersGame()); setHistory([]); setSelected(null); playClick(sound); };
  const undo = () => {
    if (!history.length) return;
    setGame(history[history.length - 1]);
    setHistory((stack) => stack.slice(0, -1));
    setSelected(null);
    playClick(sound);
  };
  const counts = {
    ivory: game.board.flat().filter((p) => p?.player === 'ivory').length,
    ember: game.board.flat().filter((p) => p?.player === 'ember').length,
  };
  return (
    <section className="game-room">
      <div className="room-heading"><span className="overline">TABLE NO. 01 / THE CLASSICS</span><h1>Checkers<span className="heading-dot">.</span></h1><p>Just you, your opponent, and sixty-four little squares.</p></div>
      <div className="play-layout">
        <div className="play-surface checker-surface">
          <div className="table-edge"><div className="checkers-board" role="group" aria-label="Checkers board">
            {game.board.flatMap((line, row) => line.map((piece, col) => {
              const dark = (row + col) % 2 === 1;
              const active = selected?.row === row && selected.col === col;
              const destination = targets.some((m) => m.to.row === row && m.to.col === col);
              return <button key={row + '-' + col} type="button" className={[
                'checker-cell', dark ? 'dark' : 'light', active ? 'selected' : '', destination ? 'destination' : '',
              ].join(' ')} disabled={!dark} onClick={() => choose(row, col)}
              aria-label={'Row ' + (row + 1) + ', column ' + (col + 1) +
                (piece ? ', ' + piece.player + (piece.king ? ' king' : ' piece') : ', empty') +
                (destination ? ', legal move' : '')}
              aria-pressed={active}>
                {piece && <span className={'checker-piece ' + piece.player + (piece.king ? ' king' : '')}><span>{piece.king ? '✦' : ''}</span></span>}
                {destination && <span className="move-indicator" aria-hidden="true" />}
              </button>;
            }))}
          </div></div>
          <div className="board-caption">AMERICAN CHECKERS · 8 × 8</div>
        </div>
        <aside className="game-aside">
          <div className="aside-overline">THE GAME IS ON</div>
          <h2>{game.winner ? (game.winner === 'ivory' ? 'Ivory wins!' : 'Ember wins!') : (game.turn === 'ivory' ? "Ivory's turn" : "Ember's turn")}</h2>
          <p className="game-message">{game.winner ? 'A game well played. Fancy another?' :
            game.forcedFrom ? 'Keep jumping! Your capture continues.' :
            moves.some((move) => move.jumped) ? 'A capture is available. Jumps are required.' :
            'Select one of your pieces, then a highlighted square.'}</p>
          <div className="player-strip"><span><i className="mini-piece ivory" /> IVORY</span><strong>{counts.ivory}</strong></div>
          <div className="player-strip"><span><i className="mini-piece ember" /> EMBER</span><strong>{counts.ember}</strong></div>
          <div className="aside-controls">
            <button className="gold-button" onClick={reset}>New game ↺</button>
            <button className="quiet-button" onClick={undo} disabled={!history.length}>Undo last move</button>
          </div>
          <div className="how-to"><h3>At this table</h3><p>Two players share this device. Ivory goes first. Move diagonally on dark squares, jump to capture, and reach the far side to become a king.</p><p>Captures are mandatory. A chain of jumps must be completed. Crowning ends the turn.</p></div>
        </aside>
      </div>
    </section>
  );
}

function TileFace({ face }: { face: string }) {
  const suit = face[0];
  return <span className={'face-contents suit-' + suit.toLowerCase()}>
    <span className="tile-glyph" aria-hidden="true">{suit === 'B' ? '❖' : suit === 'C' ? '●' : '◈'}</span>
    <strong>{face.slice(1)}</strong>
    <small>{suit === 'B' ? 'BAM' : suit === 'C' ? 'DOT' : 'CHR'}</small>
  </span>;
}
function Mahjong({ sound }: { sound: boolean }) {
  const [tiles, setTiles] = useState<MahjongTile[]>(() => saved('mahjong', newMahjongGame, validMahjong));
  const [selected, setSelected] = useState<string | null>(null);
  const [hintIds, setHintIds] = useState<string[]>([]);
  const [shuffles, setShuffles] = useState(0);
  const pairs = useMemo(() => availablePairs(tiles), [tiles]);
  useEffect(() => { persist('mahjong', tiles); }, [tiles]);
  function choose(tile: MahjongTile) {
    if (!isFree(tiles, tile)) return;
    setHintIds([]);
    if (selected === tile.id) { setSelected(null); return; }
    if (selected) {
      const next = removePair(tiles, selected, tile.id);
      if (next !== tiles) {
        setTiles(next); setSelected(null); playClick(sound, 700); return;
      }
    }
    setSelected(tile.id); playClick(sound, 560);
  }
  function hint() {
    if (!pairs.length) return;
    setHintIds([pairs[0][0].id, pairs[0][1].id]);
    setSelected(null); playClick(sound, 760);
  }
  function shuffle() {
    if (tiles.length === 0) return;
    setTiles(shuffleRemaining(tiles)); setShuffles((n) => n + 1);
    setSelected(null); setHintIds([]); playClick(sound, 400);
  }
  const reset = () => { setTiles(newMahjongGame()); setSelected(null); setHintIds([]); setShuffles(0); playClick(sound); };
  return (
    <section className="game-room">
      <div className="room-heading"><span className="overline">TABLE NO. 02 / A QUIET MOMENT</span><h1>Mahjong <em>Solitaire</em><span className="heading-dot">.</span></h1><p>A little pattern-finding. A lot of peace and quiet.</p></div>
      <div className="play-layout">
        <div className="play-surface mahjong-surface">
          <div className="mahjong-table">
            <div className="mahjong-board" role="group" aria-label="Mahjong solitaire Garden board">
              {tiles.map((tile) => {
                const free = isFree(tiles, tile);
                const active = selected === tile.id;
                const highlighted = hintIds.includes(tile.id);
                return <button type="button" key={tile.id}
                  className={['mahjong-tile', tile.layer ? 'top-layer' : 'base-layer', !free ? 'blocked' : '', active ? 'selected' : '', highlighted ? 'hint' : ''].join(' ')}
                  style={{ left: (tile.col / 9 * 100) + '%', top: (tile.row / 6 * 100) + '%' }}
                  disabled={!free} onClick={() => choose(tile)}
                  aria-label={tile.face[1] + ' ' + (tile.face[0] === 'B' ? 'bamboo' : tile.face[0] === 'C' ? 'dots' : 'characters') + (free ? ', free' : ', blocked')}
                  aria-pressed={active}>
                  <TileFace face={tile.face} />
                </button>;
              })}
            </div>
          </div>
          <div className="board-caption">THE GARDEN · 72 TILES · MATCH OPEN PAIRS</div>
        </div>
        <aside className="game-aside">
          <div className="aside-overline">SLOW DOWN & STAY A WHILE</div>
          <h2>{tiles.length === 0 ? 'Beautifully done!' : tiles.length + ' tiles left'}</h2>
          <p className="game-message">{tiles.length === 0 ? 'The table is clear. Another round?' :
            pairs.length === 0 ? 'No free pairs left. Re-deal to keep going.' :
            'Find two identical tiles with an open side and nothing on top.'}</p>
          <div className="stat-strip"><div><small>PAIRS TO GO</small><strong>{tiles.length / 2}</strong></div><div><small>MOVES AVAILABLE</small><strong>{pairs.length}</strong></div><div><small>SHUFFLES</small><strong>{shuffles}</strong></div></div>
          <div className="aside-controls">
            <button className="gold-button" onClick={reset}>New layout ↺</button>
            <button className="quiet-button" onClick={hint} disabled={!pairs.length}>Show a pair ✧</button>
            <button className="quiet-button" onClick={shuffle} disabled={!tiles.length}>Re-deal remaining tiles</button>
          </div>
          <div className="how-to"><h3>At this table</h3><p>Match two tiles with the same number and suit. A tile is free when nothing covers it and at least one horizontal side is open.</p><p>This is Mahjong Solitaire, a matching puzzle. Traditional four-player Mahjong is planned as a separate game.</p></div>
        </aside>
      </div>
    </section>
  );
}

export default function App() {
  const [room, setRoom] = useState<Room>('lobby');
  const [sound, setSound] = useState(() => saved('sound', () => true, (v): v is boolean => typeof v === 'boolean'));
  useEffect(() => { persist('sound', sound); }, [sound]);
  function enter(next: Room) {
    setRoom(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    playClick(sound);
  }
  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="brand-button" onClick={() => enter('lobby')} aria-label="Back to the Common Table lobby"><Brand /></button>
        <nav className="header-actions" aria-label="Main navigation">
          <button className={room === 'lobby' ? 'nav-active' : ''} onClick={() => enter('lobby')}>The Parlor</button>
          <button className={room === 'checkers' ? 'nav-active' : ''} onClick={() => enter('checkers')}>Checkers</button>
          <button className={room === 'mahjong' ? 'nav-active' : ''} onClick={() => enter('mahjong')}>Mahjong</button>
          <button className={room === 'dominoes' ? 'nav-active' : ''} onClick={() => enter('dominoes')}>Dominoes</button>
          <button className={room === 'solitaire' ? 'nav-active' : ''} onClick={() => enter('solitaire')}>Solitaire</button>
          <button className="sound-button" onClick={() => setSound((v) => !v)} aria-label={sound ? 'Mute sound effects' : 'Enable sound effects'} aria-pressed={sound}>{sound ? '♫' : '♩'}</button>
        </nav>
      </header>
      {room === 'lobby' ? <Lobby onEnter={enter} /> :
        room === 'checkers' ? <Checkers sound={sound} /> :
        room === 'mahjong' ? <Mahjong sound={sound} /> :
        room === 'dominoes' ? <DominoesRoom onSound={() => playClick(sound, 420)} /> :
        <SolitaireRoom onSound={() => playClick(sound, 600)} />}
      <footer className="site-footer"><span>✣ THE COMMON TABLE</span><span>MADE FOR THE JOY OF A GOOD GAME · FREE & OPEN SOURCE</span><span>EST. 2026</span></footer>
    </div>
  );
}
