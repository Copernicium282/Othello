import { useState, useEffect, useCallback } from 'react'
import { formatUnits, formatEther, parseUnits, MaxUint256, EventLog } from 'ethers'
import { useWallet } from './hooks/useWallet'
import { useContracts } from './hooks/useContracts'
import { useGame } from './hooks/useGame'
import { PromoBanner } from './components/PromoBanner'
import { Nav } from './components/Nav'
import { YinYangStripe } from './components/YinYangStripe'
import { Footer } from './components/Footer'
import { GameView } from './components/GameView'
import { Leaderboard } from './components/Leaderboard'
import type { Player } from './components/Leaderboard'
import { Treasury } from './components/Treasury'
import { WrapUnwrap } from './components/WrapUnwrap'
import { Team } from './components/Team'
import { HowToPlay } from './components/HowToPlay'
import { ADDRESSES } from './lib/contracts'
import { ToastContainer, toast } from './components/Toast'
import './App.css'

export type Tab = 'play' | 'leaderboard' | 'treasury' | 'wrap' | 'team' | 'howtoplay'

function PageContent({
  activeTab,
  contracts,
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
}: {
  activeTab: Tab
  contracts: ReturnType<typeof useContracts>
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
            if (!contracts) return
            setTxPending(true)
            try {
              const stakeWei = parseUnits(stake, 18)
              const approveTx = await contracts.yyg.approve(
                contracts.game.target,
                MaxUint256
              )
              await approveTx.wait()
              const tx = await contracts.game.createGame(opponent, stakeWei)
              await tx.wait()
              const nextId = await contracts.game.nextGameId()
              const newGameId = String(BigInt(nextId) - 1n)
              setGameId(newGameId)
              toast('success', 'Game created! Game #' + newGameId)
            } catch {
              toast('error', 'Failed to create game')
            } finally {
              setTxPending(false)
            }
          }}
          onAcceptGame={async (id) => {
            if (!contracts) return
            setGameId(id)
            setTxPending(true)
            try {
              const gameData = await contracts.game.games(id)
              const stakeWei = gameData[2][3]
              const approveTx = await contracts.yyg.approve(
                contracts.game.target,
                MaxUint256
              )
              await approveTx.wait()
              const tx = await contracts.game.acceptGame(id, stakeWei)
              await tx.wait()
              toast('success', 'Game accepted!')
            } catch {
              toast('error', 'Failed to accept game')
              setGameId(null)
            } finally {
              setTxPending(false)
            }
          }}
          pendingGames={pendingGames}
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
      return (
        <Treasury
          balance={treasuryBalance}
          seasonDays={days}
          seasonHours={hours}
          seasonMinutes={minutes}
          seasonEnded={remaining <= 0}
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
              toast('error', 'Settle failed — season may not have ended yet')
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
      return <HowToPlay />
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('play')
  const wallet = useWallet()
  const contracts = useContracts(wallet.provider, wallet.signer)
  const [yygBalance, setYygBalance] = useState('0')
  const [sttBalance, setSttBalance] = useState('0.000000')
  const [gameId, setGameId] = useState<string | null>(null)
  const [txPending, setTxPending] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [treasuryBalance, setTreasuryBalance] = useState('0')
  const [seasonDeadline, setSeasonDeadline] = useState(0)
  const [pendingGames, setPendingGames] = useState<Array<{ gameId: string; challenger: string; stake: string }>>([])

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
      const logs = await contracts.elo.queryFilter('ResultRecorded', 0, 'latest') as EventLog[]
      const playerMap = new Map<string, { wins: number; losses: number; elo: number }>()

      for (const log of logs) {
        const winner = log.args.winner as string
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
      const logs = await contracts.game.queryFilter('GameCreated', 0, 'latest') as EventLog[]
      const pending: Array<{ gameId: string; challenger: string; stake: string }> = []
      for (const log of logs) {
        const logGameId = String(log.args.gameId as bigint)
        const challenger = log.args.challenger as string
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
      setPendingGames(pending.slice(0, 10))
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
        <PageContent
          activeTab={activeTab}
          contracts={contracts}
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
          fetchTreasury={fetchTreasury}
        />
      </main>
      <YinYangStripe />
      <Footer onNavigate={(page) => setActiveTab(page as Tab)} />
    </div>
  )
}

export default App
