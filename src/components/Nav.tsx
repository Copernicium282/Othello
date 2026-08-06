import type { Tab } from '../App'
import './Nav.css'

export interface NavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  account: string | null
  onConnect: () => void
  isConnecting: boolean
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'wrap', label: 'Wrap/Unwrap' },
]

export function Nav({ activeTab, onTabChange, account, onConnect, isConnecting }: NavProps) {
  return (
    <nav className="primary-nav">
      <div className="nav-inner">
        <div className="nav-logo">Othello.s</div>

        <div className="nav-links">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-link ${activeTab === tab.id ? 'nav-link--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          className="button-primary nav-wallet-btn"
          onClick={onConnect}
          disabled={isConnecting}
        >
          {account
            ? `${account.slice(0, 6)}...${account.slice(-4)}`
            : isConnecting
              ? 'Connecting...'
              : 'Connect Wallet'
          }
        </button>
      </div>
    </nav>
  )
}

export default Nav
