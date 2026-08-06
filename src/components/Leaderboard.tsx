import './pages.css'

export interface Player {
  address: string
  elo: number
  wins: number
  losses: number
}

export interface LeaderboardProps {
  players: Player[]
  totalGames?: number
  treasuryBalance?: string
  totalPlayers?: number
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatElo(elo: number): string {
  return elo.toFixed(2)
}

function formatRecord(wins: number, losses: number): string {
  return `${wins}W / ${losses}L`
}

export function Leaderboard({
  players,
  totalGames = 0,
  treasuryBalance = '0',
  totalPlayers = 0,
}: LeaderboardProps) {
  const sorted = [...players].sort((a, b) => b.elo - a.elo)

  return (
    <div className="leaderboard">
      <div className="stat-row">
        <div className="stat-cell">
          <span className="stat-number">{totalGames.toLocaleString()}</span>
          <span className="stat-label">Total Games</span>
        </div>
        <div className="stat-cell">
          <span className="stat-number">{treasuryBalance}</span>
          <span className="stat-label">Treasury Balance</span>
        </div>
        <div className="stat-cell">
          <span className="stat-number">{totalPlayers.toLocaleString()}</span>
          <span className="stat-label">Total Players</span>
        </div>
      </div>

      <div className="leaderboard-header">
        <span>Rank</span>
        <span>Player</span>
        <span>Elo</span>
        <span>Record</span>
      </div>

      {sorted.length === 0 ? (
        <div className="leaderboard-empty">
          No games played yet this season
        </div>
      ) : (
        sorted.map((player, index) => (
          <div className="leaderboard-row" key={player.address}>
            <span className="leaderboard-rank">
              [{index + 1}]
            </span>
            <span className="leaderboard-address">
              {truncateAddress(player.address)}
            </span>
            <span className="leaderboard-elo">
              {formatElo(player.elo)}
            </span>
            <span className="leaderboard-record">
              {formatRecord(player.wins, player.losses)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

export default Leaderboard
