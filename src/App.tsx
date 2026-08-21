import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import { formatUnits, formatEther, parseUnits, MaxUint256, EventLog } from 'ethers'
import type { BrowserProvider, Contract, JsonRpcSigner } from 'ethers'
import { useWallet } from './hooks/useWallet'
import { useContracts } from './hooks/useContracts'
import { useGame } from './hooks/useGame'
import { useAIGame } from './hooks/useAIGame'
import type { AIGameState } from './hooks/useAIGame'
import type { Difficulty } from './lib/ai'
import { useSession } from './hooks/useSession'
import type { SessionResult } from './hooks/useSession'
import { PromoBanner } from './components/PromoBanner'
import { Nav } from './components/Nav'
import { YinYangStripe } from './components/YinYangStripe'
import { Footer } from './components/Footer'
import { GameView } from './components/GameView'
import { AIGameView } from './components/AIGameView'
import type { Player } from './components/Leaderboard'
import { HowToPlay } from './components/HowToPlay'
import { ADDRESSES, parseCustomError } from './lib/contracts'
import { ToastContainer, toast } from './components/Toast'
import './App.css'

const Leaderboard = lazy(() => import('./components/Leaderboard').then(m => ({ default: m.Leaderboard })))
const Treasury = lazy(() => import('./components/Treasury').then(m => ({ default: m.Treasury })))
const WrapUnwrap = lazy(() => import('./components/WrapUnwrap').then(m => ({ default: m.WrapUnwrap })))
const Team = lazy(() => import('./components/Team').then(m => ({ default: m.Team })))

export type Tab = 'play' | 'ai' | 'leaderboard' | 'treasury' | 'wrap' | 'team' | 'howtoplay'

// 0.1 STT funded to the session key, enough for ~12 moves at ~0.008 STT each.
const SESSION_FUND_WEI = 10n ** 17n

/** Extract the GameCreated gameId from a transaction receipt, if present. */
function parseGameId(
  receipt: { logs: Array<{ topics: string[]; data: string }> } | undefined,
  game: Contract,
): string | null {
  if (!receipt) return null
  for (const log of receipt.logs) {
    try {
      // SAFETY: parseLog decodes the receipt log against the GameCreated
      // event ABI; args.gameId is a uint256 indexed param (bigint).
      const parsed = game.interface.parseLog({ topics: log.topics, data: log.data })
      if (parsed && parsed.name === 'GameCreated') return String(parsed.args.gameId)
    } catch {
      // Not a GameCreated log
    }
  }
  return null
}

function PageContent({
  activeTab,
  contracts,
  signer,
  provider,
  session,
  yygBalance,
  sttBalance,
  account,
  onBalanceRefresh,
  gameId,
  setGameId,
  txPending,
  setTxPending,
  players,
  treasuryBalance,
  seasonDeadline,
  pendingGames,
  fetchTreasury,
  showFlipCounts,
  onToggleFlipCounts,
  onRenewSession,
  onRevokeSession,
  onNavigate,
  onConnect,
  aiGameState,
  onAIStart,
  onAIPlayerMove,
}: {
  activeTab: Tab
  contracts: ReturnType<typeof useContracts>
  signer: JsonRpcSigner | null
  provider: BrowserProvider | null
  session: ReturnType<typeof useSession>
  yygBalance: string
  sttBalance: string
  account: string | null
  onBalanceRefresh: () => void
  gameId: string | null
  setGameId: (id: string | null) => void
  txPending: boolean
  setTxPending: (v: boolean) => void
  players: Player[]
  treasuryBalance: string
  seasonDeadline: number
  pendingGames: Array<{ gameId: string; challenger: string; stake: string }>
  fetchTreasury: () => void
  showFlipCounts: boolean
  onToggleFlipCounts: () => void
  onRenewSession: (gameId: string) => Promise<SessionResult>
  onRevokeSession: () => Promise<SessionResult>
  onNavigate: (tab: Tab) => void
  onConnect: () => void
  aiGameState: AIGameState
  onAIStart: (difficulty: Difficulty) => void
  onAIPlayerMove: (position: number) => void
}) {
  const game = useGame(gameId, contracts, account)

  switch (activeTab) {
    case 'play':
      return (
        <GameView
          game={game}
          contracts={contracts}
          account={account}
          gameId={gameId}
          txPending={txPending}
          onMovePending={setTxPending}
          onCreateGame={async (opponent, stake) => {
            if (!contracts || !account || !signer || !provider) return
            setTxPending(true)
            try {
              const stakeWei = parseUnits(stake, 18)
              // SAFETY: yygBalance is produced by formatUnits(value, 18), so
              // parsing it back with the same decimals cannot throw.
              if (parseUnits(yygBalance, 18) < stakeWei) {
                toast('error', 'Not enough YYG for that stake. Wrap STT into YYG first.')
                setTxPending(false)
                return
              }
              // One-ever allowance: only the first game ever needs an approve.
              // SAFETY: allowance is a uint256 view result; comparison is bigint.
              const allowance: bigint = await contracts.yyg.allowance(account, ADDRESSES.game)
              if (allowance < stakeWei) {
                const approveTx = await contracts.yyg.approve(ADDRESSES.game, MaxUint256)
                await approveTx.wait()
              }
              const tx = await contracts.game.createGameWithSession(
                opponent,
                stakeWei,
                session.sessionKey.address,
                5000,
                { value: SESSION_FUND_WEI },
              )
              const receipt = await tx.wait()
              const parsedGameId = parseGameId(receipt, contracts.game)
              let newGameId = parsedGameId
              if (newGameId === null) {
                const nextId = await contracts.game.nextGameId()
                newGameId = String(BigInt(nextId) - 1n)
              }
              setGameId(newGameId)
              toast('success', 'Game created! Game #' + newGameId)
            } catch (err) {
              console.error('createGame failed:', err)
              const custom = parseCustomError(err)
              const reason = custom || (err instanceof Error ? err.message : String(err))
              toast('error', ('Failed to create game: ' + reason).slice(0, 120))
            } finally {
              setTxPending(false)
            }
          }}
          onAcceptGame={async (id) => {
            if (!contracts || !account || !signer || !provider) return
            setGameId(id)
            setTxPending(true)
            try {
              const gameData = await contracts.game.games(id)
              const status = Number(gameData[4])
              if (status === 1) {
                // Game is already active! Just open it directly.
                toast('success', `Joined active Game #${id}`)
                return
              } else if (status === 2) {
                toast('error', `Game #${id} has already finished.`)
                setGameId(null)
                return
              }

              const stakeWei = gameData[2][3]
              if (parseUnits(yygBalance, 18) < stakeWei) {
                toast('error', 'Not enough YYG to match this stake. Wrap STT into YYG first.')
                setTxPending(false)
                return
              }
              const allowance: bigint = await contracts.yyg.allowance(account, ADDRESSES.game)
              if (allowance < stakeWei) {
                const approveTx = await contracts.yyg.approve(ADDRESSES.game, MaxUint256)
                await approveTx.wait()
              }
              const tx = await contracts.game.acceptGameWithSession(
                id,
                stakeWei,
                session.sessionKey.address,
                5000,
                { value: SESSION_FUND_WEI },
              )
              await tx.wait()
              toast('success', 'Game accepted!')
            } catch (err) {
              console.error('acceptGame failed:', err)
              const custom = parseCustomError(err)
              const reason = custom || (err instanceof Error ? err.message : String(err))
              toast('error', ('Failed to accept game: ' + reason).slice(0, 120))
            } finally {
              setTxPending(false)
            }
          }}
          onSelectGame={(id) => {
            setGameId(id)
            toast('info', `Opened Game #${id}`)
          }}
          pendingGames={pendingGames}
          session={session}
          showFlipCounts={showFlipCounts}
          onToggleFlipCounts={onToggleFlipCounts}
          onRenewSession={onRenewSession}
          onRevokeSession={onRevokeSession}
        />
      )
    case 'ai':
      return (
        <AIGameView
          state={aiGameState}
          onStartGame={onAIStart}
          onPlayerMove={onAIPlayerMove}
          showFlipCounts={showFlipCounts}
          onToggleFlipCounts={onToggleFlipCounts}
        />
      )
    case 'leaderboard':
      return (
        <Leaderboard
          players={players}
          totalGames={Math.floor(players.reduce((sum, p) => sum + p.wins + p.losses, 0) / 2)}
          treasuryBalance={treasuryBalance}
          totalPlayers={players.length}
        />
      )
    case 'treasury': {
      const now = Math.floor(Date.now() / 1000)
      const remaining = Math.max(0, seasonDeadline - now)
      const days = Math.floor(remaining / 86400)
      const hours = Math.floor((remaining % 86400) / 3600)
      const minutes = Math.floor((remaining % 3600) / 60)
      const top3 = players.slice(0, 3)
      return (
        <Treasury
          balance={treasuryBalance}
          seasonDays={days}
          seasonHours={hours}
          seasonMinutes={minutes}
          seasonEnded={remaining <= 0}
          firstPlace={top3[0] ? { address: top3[0].address, percent: 50 } : undefined}
          secondPlace={top3[1] ? { address: top3[1].address, percent: 30 } : undefined}
          thirdPlace={top3[2] ? { address: top3[2].address, percent: 20 } : undefined}
          onSettle={async () => {
            if (!contracts) return
            try {
              const top3 = players.slice(0, 3).map(p => p.address)
              if (top3.length < 3) {
                toast('error', 'Need at least 3 players with ELO to settle')
                return
              }
              const tx = await contracts.treasury.settleSeason(top3)
              await tx.wait()
              toast('success', 'Season settled! Top 3 paid.')
              onBalanceRefresh()
              fetchTreasury()
            } catch (err) {
              console.error(err)
              toast('error', 'Settle failed: season may not have ended yet')
            }
          }}
        />
      )
    }
    case 'wrap':
      return (
        <WrapUnwrap
          account={account}
          yygBalance={yygBalance}
          sttBalance={sttBalance}
          contracts={contracts}
          onBalanceRefresh={onBalanceRefresh}
        />
      )
    case 'team':
      return <Team />
    case 'howtoplay':
      return <HowToPlay onNavigate={onNavigate} onConnect={onConnect} />
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('howtoplay')
  const wallet = useWallet()
  const contracts = useContracts(wallet.provider, wallet.signer)
  const [yygBalance, setYygBalance] = useState('0')
  const [sttBalance, setSttBalance] = useState('0.000000')
  const [gameId, setGameIdState] = useState<string | null>(() => localStorage.getItem('othello.activeGameId'))
  const [txPending, setTxPending] = useState(false)

  const setGameId = useCallback((id: string | null) => {
    setGameIdState(id)
    if (id) {
      localStorage.setItem('othello.activeGameId', id)
    } else {
      localStorage.removeItem('othello.activeGameId')
    }
  }, [])
  const [players, setPlayers] = useState<Player[]>([])
  const [treasuryBalance, setTreasuryBalance] = useState('0')
  const [seasonDeadline, setSeasonDeadline] = useState(0)
  const [pendingGames, setPendingGames] = useState<Array<{ gameId: string; challenger: string; stake: string }>>([])
  const [showFlipCounts, setShowFlipCounts] = useState(() => localStorage.getItem('othello.flipBadges') === '1')
  const aiGame = useAIGame()
  const session = useSession({
    provider: wallet.provider,
    signer: wallet.signer,
    account: wallet.account,
  })

  const toggleFlipCounts = useCallback(() => {
    setShowFlipCounts(prev => !prev)
  }, [])

  useEffect(() => {
    localStorage.setItem('othello.flipBadges', showFlipCounts ? '1' : '0')
  }, [showFlipCounts])

  const fetchBalances = useCallback(async () => {
    if (!wallet.account) {
      setYygBalance('0')
      setSttBalance('0.000000')
      return
    }
    if (contracts) {
      try {
        const raw = await contracts.yyg.balanceOf(wallet.account)
        setYygBalance(formatUnits(raw, 18))
      } catch {
        setYygBalance('0')
      }
    }
    if (wallet.provider) {
      try {
        const raw = await wallet.provider.getBalance(wallet.account)
        setSttBalance(formatEther(raw))
      } catch {
        setSttBalance('0.000000')
      }
    }
  }, [contracts, wallet.account, wallet.provider])

  const fetchLeaderboard = useCallback(async () => {
    if (!contracts) return
    try {
      // SAFETY: queryFilter returns EventLog[] when given a string filter, per ethers v6.
      const logs = await contracts.elo.queryFilter('ELOUpdated', 0, 'latest') as EventLog[]
      const playerMap = new Map<string, { wins: number; losses: number; elo: number }>()

      for (const log of logs) {
        // SAFETY: ELOUpdated emits (address indexed winner, ..., address indexed loser, ...).
        const winner = log.args.winner as string
        // SAFETY: loser is the second indexed address in ELOUpdated.
        const loser = log.args.loser as string

        const winnerEntry = playerMap.get(winner) ?? { wins: 0, losses: 0, elo: 0 }
        winnerEntry.wins++
        playerMap.set(winner, winnerEntry)

        const loserEntry = playerMap.get(loser) ?? { wins: 0, losses: 0, elo: 0 }
        loserEntry.losses++
        playerMap.set(loser, loserEntry)
      }

      const playerList: Player[] = []
      for (const [address, stats] of playerMap) {
        try {
          const eloRaw = await contracts.elo.getELO(address)
          stats.elo = Number(formatUnits(eloRaw, 18))
        } catch {
          stats.elo = 0
        }
        playerList.push({ address, elo: stats.elo, wins: stats.wins, losses: stats.losses })
      }

      playerList.sort((a, b) => b.elo - a.elo)
      setPlayers(playerList.slice(0, 10))
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err)
    }
  }, [contracts])

  const fetchTreasury = useCallback(async () => {
    if (!contracts) return
    try {
      const [rawBalance, deadline] = await Promise.all([
        contracts.yyg.balanceOf(ADDRESSES.treasury),
        contracts.treasury.seasonDeadline(),
      ])
      setTreasuryBalance(formatUnits(rawBalance, 18))
      setSeasonDeadline(Number(deadline))
    } catch (err) {
      console.error('Failed to fetch treasury data:', err)
    }
  }, [contracts])

  const fetchPendingGames = useCallback(async () => {
    if (!contracts) return
    try {
      // SAFETY: queryFilter returns EventLog[] when given a string filter, per ethers v6.
      const logs = await contracts.game.queryFilter('GameCreated', 0, 'latest') as EventLog[]
      const pending: Array<{ gameId: string; challenger: string; stake: string }> = []
      for (const log of logs) {
        // SAFETY: GameCreated emits (uint256 indexed gameId, address indexed challenger, uint256 stake).
        const logGameId = String(log.args.gameId as bigint)
        // SAFETY: challenger is the indexed address in GameCreated.
        const challenger = log.args.challenger as string
        // SAFETY: stake is the third, non-indexed uint256 in GameCreated.
        const stakeRaw = log.args.stake as bigint
        try {
          const gameData = await contracts.game.games(logGameId)
          if (Number(gameData[4]) === 0) {
            pending.push({
              gameId: logGameId,
              challenger,
              stake: formatUnits(stakeRaw, 18),
            })
          }
        } catch {
          // Game might not exist or be settled
        }
      }
      setPendingGames(pending.slice(-10))
    } catch {
      // Failed to fetch pending games
    }
  }, [contracts])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  useEffect(() => {
    fetchLeaderboard()
    fetchTreasury()
    fetchPendingGames()
    const id = setInterval(() => {
      fetchLeaderboard()
      fetchTreasury()
      fetchPendingGames()
    }, 30000)
    return () => clearInterval(id)
  }, [fetchLeaderboard, fetchTreasury, fetchPendingGames])

  return (
    <div className="app">
      <PromoBanner />
      <Nav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        account={wallet.account}
        onConnect={wallet.connect}
        isConnecting={wallet.isConnecting}
      />
      <ToastContainer />
      <main className="page-content">
        <Suspense fallback={<div className="page-content">Loading...</div>}>
          <PageContent
            activeTab={activeTab}
            contracts={contracts}
            signer={wallet.signer}
            provider={wallet.provider}
            yygBalance={yygBalance}
            sttBalance={sttBalance}
            account={wallet.account}
            onBalanceRefresh={fetchBalances}
            gameId={gameId}
            setGameId={setGameId}
            txPending={txPending}
            setTxPending={setTxPending}
            players={players}
            treasuryBalance={treasuryBalance}
            seasonDeadline={seasonDeadline}
            pendingGames={pendingGames}
            session={session}
            fetchTreasury={fetchTreasury}
            showFlipCounts={showFlipCounts}
            onToggleFlipCounts={toggleFlipCounts}
            onRenewSession={async (id: string) =>
              session.renewSession({ gameId: id, durationBlocks: 5000 })
            }
            onRevokeSession={async () => session.revokeSession()}
            onNavigate={setActiveTab}
            onConnect={wallet.connect}
            aiGameState={aiGame.state}
            onAIStart={aiGame.startGame}
            onAIPlayerMove={aiGame.playerMove}
          />
        </Suspense>
      </main>
      <YinYangStripe />
      <Footer onNavigate={setActiveTab} />
    </div>
  )
}

export default App
