import './pages.css'

export interface TreasuryProps {
  balance?: string
  seasonDays?: number
  seasonHours?: number
  seasonMinutes?: number
  firstPlace?: { address: string; percent: number }
  secondPlace?: { address: string; percent: number }
  thirdPlace?: { address: string; percent: number }
  seasonEnded?: boolean
  onSettle?: () => void
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function Treasury({
  balance = '0',
  seasonDays = 14,
  seasonHours = 6,
  seasonMinutes = 0,
  firstPlace,
  secondPlace,
  thirdPlace,
  seasonEnded = false,
  onSettle,
}: TreasuryProps) {
  const hasTop3 = Boolean(firstPlace && secondPlace && thirdPlace)
  return (
    <div className="treasury">
      <div className="treasury-balance">{balance}</div>
      <div className="treasury-token">YYG</div>

      <div className="card-feature treasury-card">
        <div style={{ marginBottom: 'var(--space-xxl)' }}>
          <span className="eyebrow">Current Season</span>
          <div className="season-countdown">
            {seasonDays}d {seasonHours}h {seasonMinutes}m
          </div>
          <div className="season-label">until next settlement</div>
        </div>

        {firstPlace && secondPlace && thirdPlace && (
          <div style={{ marginBottom: 'var(--space-xxl)' }}>
            <span className="eyebrow">Top 3 Payout Preview</span>
            <div className="payout-preview">
              <div className="payout-slot payout-slot--first">
                <span className="payout-rank">[1]</span>
                <span className="payout-address">
                  {truncateAddress(firstPlace.address)}
                </span>
                <span className="payout-percent">{firstPlace.percent}%</span>
                <span className="payout-percent-label">of treasury</span>
              </div>
              <div className="payout-slot payout-slot--second">
                <span className="payout-rank">[2]</span>
                <span className="payout-address">
                  {truncateAddress(secondPlace.address)}
                </span>
                <span className="payout-percent">{secondPlace.percent}%</span>
                <span className="payout-percent-label">of treasury</span>
              </div>
              <div className="payout-slot payout-slot--third">
                <span className="payout-rank">[3]</span>
                <span className="payout-address">
                  {truncateAddress(thirdPlace.address)}
                </span>
                <span className="payout-percent">{thirdPlace.percent}%</span>
                <span className="payout-percent-label">of treasury</span>
              </div>
            </div>
          </div>
        )}

        <button
          className="button-primary settle-btn"
          onClick={onSettle}
          disabled={!seasonEnded || !hasTop3}
          style={{ width: '100%' }}
        >
          Settle Season
        </button>
        <p className="settle-note">
          Settlement is permissionless, anyone can call settleSeason after the deadline
        </p>
      </div>
    </div>
  )
}

export default Treasury
