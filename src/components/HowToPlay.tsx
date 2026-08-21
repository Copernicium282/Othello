import type { Tab } from '../App'
import './HowToPlay.css'

export function HowToPlay({
  onNavigate,
  onConnect,
}: {
  onNavigate: (tab: Tab) => void
  onConnect: () => void
}) {
  return (
    <div className="howtoplay-page">
      <section className="howtoplay-quick">
        <h2>Quick Play</h2>
        <p>
          No wallet, no stakes, no waiting. Jump straight into a game against the AI to
          test the mechanics, or play a quick round while your friends are busy.
        </p>
        <button className="button-primary" onClick={() => onNavigate('ai')}>
          Play vs AI
        </button>
      </section>

      <h2>Getting Started</h2>
      <p>
        Othello.s runs on the Somnia Shannon testnet, so everything you need is free.
        The setup takes about five minutes.
      </p>
      <ol className="howtoplay-steps">
        <li className="howtoplay-step">
          <div className="howtoplay-step__body">
            <strong>Install a wallet.</strong>{' '}
            <span>
              Install the MetaMask browser extension and create an account.
            </span>
          </div>
          <div className="howtoplay-step__actions">
            <a
              className="button-secondary"
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
            >
              metamask.io/download
            </a>
          </div>
        </li>
        <li className="howtoplay-step">
          <div className="howtoplay-step__body">
            <strong>Connect your wallet.</strong>{' '}
            <span>
              Click Connect Wallet in the top-left navigation. MetaMask prompts you to
              add the Somnia Shannon network (RPC{' '}
              <code>api.infra.testnet.somnia.network</code>, Chain ID <code>50312</code>
              ). Approve it and you're connected. No manual network setup needed.
            </span>
          </div>
          <div className="howtoplay-step__actions">
            <button className="button-primary" onClick={onConnect}>
              Connect Wallet
            </button>
          </div>
        </li>
        <li className="howtoplay-step">
          <div className="howtoplay-step__body">
            <strong>Get free testnet STT.</strong>{' '}
            <span>
              STT pays for transaction fees. Request it for your address from the
              Somnia Shannon faucet.
            </span>
          </div>
          <div className="howtoplay-step__actions">
            <a
              className="button-secondary"
              href="https://cloud.google.com/application/web3/faucet/somnia/shannon"
              target="_blank"
              rel="noreferrer"
            >
              Open the faucet
            </a>
          </div>
        </li>
        <li className="howtoplay-step">
          <div className="howtoplay-step__body">
            <strong>Wrap STT into YYG.</strong>{' '}
            <span>
              YYG is the token you stake on games, wrapped at the fixed rate of
              1 STT = 100,000 YYG.
            </span>
          </div>
          <div className="howtoplay-step__actions">
            <button className="button-primary" onClick={() => onNavigate('wrap')}>
              Open Wrap/Unwrap
            </button>
          </div>
        </li>
      </ol>

      <h2>Play Your First Match</h2>
      <ol className="howtoplay-steps">
        <li className="howtoplay-step">
          <div className="howtoplay-step__body">
            <strong>Create a game.</strong>{' '}
            <span>
              Pick an opponent (any wallet address) and a stake in YYG. Your wallet
              creates the game and authorizes a session key in a single transaction
              (the session key is funded with 0.1 STT so your moves need no
              confirmations).
            </span>
          </div>
          <div className="howtoplay-step__actions">
            <button className="button-primary" onClick={() => onNavigate('play')}>
              Open Play
            </button>
          </div>
        </li>
        <li className="howtoplay-step">
          <div className="howtoplay-step__body">
            <strong>Accept a game.</strong>{' '}
            <span>
              A pending challenge appears in the Play tab. Accepting matches the stake,
              locks both deposits, and starts the game with the challenger moving first.
            </span>
          </div>
          <div className="howtoplay-step__actions">
            <button className="button-secondary" onClick={() => onNavigate('play')}>
              See pending games
            </button>
          </div>
        </li>
        <li className="howtoplay-step">
          <div className="howtoplay-step__body">
            <strong>Make moves.</strong>{' '}
            <span>
              Click an empty square to place a disc. Moves go through your session key
              and settle in about a second. The status chip shows whether your session
              is active; if it expires, one click renews it.
            </span>
          </div>
        </li>
        <li className="howtoplay-step">
          <div className="howtoplay-step__body">
            <strong>Win and collect.</strong>{' '}
            <span>
              The winner automatically receives 96% of the combined pot. The remaining
              4% funds the seasonal treasury, and both players' ELO ratings are updated.
            </span>
          </div>
          <div className="howtoplay-step__actions">
            <button
              className="button-secondary"
              onClick={() => onNavigate('leaderboard')}
            >
              View Leaderboard
            </button>
          </div>
        </li>
      </ol>

      <h2>What is Othello?</h2>
      <p>
        Othello is a strategy board game played between two opponents on an 8x8 grid.
        One player controls the black discs and the other controls white. The game begins
        with four discs placed in the center: black occupies d5 and e4, while white
        occupies d4 and e5. Black always moves first. The game is famously described as
        "a minute to learn, a lifetime to master."
      </p>
      <img
        src="/images/how_to_play_othello_0.png"
        alt="Starting position: four discs in the center"
        className="howtoplay-img"
      />

      <h2>Rules</h2>
      <p>
        On your turn you place one disc on any empty square. Your disc must outflank one
        or more of your opponent's discs in a straight line: horizontally, vertically, or
        diagonally. To outflank means there is an unbroken line of opponent discs between
        your newly placed disc and one of your existing discs on the other side.
      </p>
      <img
        src="/images/how_to_play_othello_1.png"
        alt="Black's legal moves shown as translucent discs"
        className="howtoplay-img"
      />
      <p>
        All outflanked discs are flipped to your colour in a single move. After flipping,
        those discs now belong to you and can be used to outflank on future turns.
      </p>
      <img
        src="/images/how_to_play_othello_2.png"
        alt="After Black places a disc, one white disc is flipped"
        className="howtoplay-img"
      />
      <p>
        If you have no valid moves, your turn passes to your opponent. White now plays
        under the same rules with the roles reversed.
      </p>
      <img
        src="/images/how_to_play_othello_3.png"
        alt="White's legal move options"
        className="howtoplay-img"
      />
      <p>
        The game ends when neither player can place a disc. The player with the most
        discs on the board wins. If both players have the same number of discs, the game
        is a draw.
      </p>
      <img
        src="/images/how_to_play_othello_4.png"
        alt="After White plays, one black disc is flipped"
        className="howtoplay-img"
      />

      <h2>Strategy Basics</h2>
      <ul>
        <li>
          <strong>Corners are king.</strong> A disc on a corner can never be flipped
          because no line can pass through it from the opposite side. Securing corners
          early gives you a permanent foothold on the board.
        </li>
      </ul>
      <img
        src="/images/basic_strategy_othello_1.png"
        alt="Corner stability: stable discs around h8"
        className="howtoplay-img"
      />
      <ul>
        <li>
          <strong>Avoid the danger squares.</strong> The squares diagonal to each corner
          (a2, b1, g1, h2, etc.) give your opponent easy access to that corner. Playing
          into these squares is usually a mistake.
        </li>
      </ul>
      <img
        src="/images/basic_strategy_othello_2.png"
        alt="Danger zones marked near corners"
        className="howtoplay-img"
      />
      <ul>
        <li>
          <strong>Mobility over disc count.</strong> Early in the game, having more discs
          is less important than having more available moves. Limit your opponent's
          options while keeping your own open.
        </li>
      </ul>
      <img
        src="/images/basic_strategy_othello_3.png"
        alt="Mobility advantage: fewer discs but more options"
        className="howtoplay-img"
      />
      <ul>
        <li>
          <strong>Control the centre.</strong> The opening moves should focus on the
          central four-by-four region. Dominating the centre gives you flexibility and
          forces your opponent to play on the edges.
        </li>
      </ul>

      <h2>How Othello.s Works</h2>
      <p>
        Othello.s brings the classic game fully on-chain on Somnia Shannon, a network
        with 100ms block times. Here is how it all fits together.
      </p>
      <ul>
        <li>
          <strong>Wrapping.</strong> You wrap STT into YYG tokens at a fixed rate of
          1 STT = 100,000 YYG. Both players in a game must hold YYG to stake.
        </li>
        <li>
          <strong>Creating and accepting games.</strong> One player creates a game and
          posts a stake in YYG. An opponent can accept the game by matching that stake.
          Both stakes are locked in the contract until the game concludes.
        </li>
        <li>
          <strong>On-chain moves.</strong> Each move is a transaction on Somnia Shannon.
          The board is represented as a bitboard: a compact format where each of the 64
          positions maps to a single bit in a uint64 value. Move validation happens
          entirely in the smart contract, so cheating is impossible.
        </li>
        <li>
          <strong>Payouts.</strong> The winner receives 96% of the combined pot. The
          remaining 4% flows into a seasonal treasury that funds prizes for the
          leaderboard.
        </li>
        <li>
          <strong>ELO ratings.</strong> Every game updates your ELO rating through a
          standard rating system. Ratings persist across games and seasons, giving you a
          long-term measure of skill.
        </li>
        <li>
          <strong>Seasonal treasury.</strong> At the end of each season, the top 3
          players on the leaderboard split the accumulated treasury. The season deadline
          is enforced on-chain.
        </li>
        <li>
          <strong>Anti-farming.</strong> A ±400 ELO band prevents high-rated players
          from farming low-rated new accounts for easy wins and treasury share.
        </li>
      </ul>
    </div>
  )
}
