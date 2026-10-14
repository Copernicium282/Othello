import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import { formatUnits, formatEther, parseUnits, MaxUint256, isError } from 'ethers'
import type { AbstractProvider, Contract, Signer } from 'ethers'
import { useWallet } from './hooks/useWallet'
import { useLocalWallet } from './hooks/useLocalWallet'
import { LocalWalletModal } from './components/LocalWalletModal'
import { useContracts } from './hooks/useContracts'
import { useGame } from './hooks/useGame'
import { useAIGame } from './hooks/useAIGame'
import type { AIGameState } from './hooks/useAIGame'
import type { Difficulty } from './lib/ai'
import { useSession } from './hooks/useSession'
import type { SessionResult } from './hooks/useSession'
import { Nav } from './components/Nav'
import { YinYangStripe } from './components/YinYangStripe'
import { Footer } from './components/Footer'
import { GameView } from './components/GameView'
import { AIGameView } from './components/AIGameView'
import type { Player } from './components/Leaderboard'
import { HowToPlay } from './components/HowToPlay'
import { ADDRESSES, parseCustomError } from './lib/contracts'
import { toast } from './lib/toastBus'
import { ToastContainer } from './components/Toast'
import './App.css'

const Leaderboard = lazy(() => import('./components/Leaderboard').then(m => ({ default: m.Leaderboard })))
const Treasury = lazy(() => import('./components/Treasury').then(m => ({ default: m.Treasury })))
const WrapUnwrap = lazy(() => import('./components/WrapUnwrap').then(m => ({ default: m.WrapUnwrap })))
const Team = lazy(() => import('./components/Team').then(m => ({ default: m.Team })))

export type Tab = 'play' | 'ai' | 'leaderboard' | 'treasury' | 'wrap' | 'team' | 'howtoplay'

// 0.005 CELO funded to the session key, enough for dozens of moves at sub-cent gas fees.
const SESSION_FUND_WEI = 5n * (10n ** 15n)

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
  activeGames,
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
  beginnerProtection,
}: {
  activeTab: Tab
  contracts: ReturnType<typeof useContracts>
  signer: Signer | null
  provider: AbstractProvider | null
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
  activeGames: Array<{ gameId: string; black: string; white: string; stake: string }>
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
  beginnerProtection?: {
    active: boolean
    matchesPlayed: number
    onToggle: (enabled: boolean) => Promise<void>
    toggling?: boolean
  }
}) {
  const { game, refreshGame } = useGame(gameId, contracts, account)

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
          onRefreshGame={refreshGame}
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
              const custom = isError(err, 'CALL_EXCEPTION') ? parseCustomError(err) : null
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
              const status = Number(gameData?.[4])
              if (status === 1) {
                // Game is already active! Just open it directly.
                toast('success', `Joined active Game #${id}`)
                return
              } else if (status === 2) {
                toast('error', `Game #${id} has already finished.`)
                setGameId(null)
                return
              }

              const stakeWei = gameData?.[2]?.[3]
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
              const custom = isError(err, 'CALL_EXCEPTION') ? parseCustomError(err) : null
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
          activeGames={activeGames}
          session={session}
          showFlipCounts={showFlipCounts}
          onToggleFlipCounts={onToggleFlipCounts}
          onRenewSession={onRenewSession}
          onRevokeSession={onRevokeSession}
          beginnerProtection={beginnerProtection}
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
      // eslint-disable-next-line react/purity
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
  const localWallet = useLocalWallet()
  const [useLocal, setUseLocal] = useState(false)
  const [showLocalWalletModal, setShowLocalWalletModal] = useState(false)
  const activeWallet = useLocal && localWallet.account ? localWallet : wallet
  const contracts = useContracts(activeWallet.provider, activeWallet.signer)

  const [yygBalance, setYygBalance] = useState('0')
  const [sttBalance, setSttBalance] = useState('0.000000')
  const [gameId, setGameIdState] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const fromUrl = params.get('game')
      if (fromUrl) return fromUrl
    } catch {
      // ignore malformed URL state
    }
    return localStorage.getItem('othello.activeGameId')
  })
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
  const [activeGames, setActiveGames] = useState<Array<{ gameId: string; black: string; white: string; stake: string }>>([])
  const [showFlipCounts, setShowFlipCounts] = useState(() => localStorage.getItem('othello.flipBadges') === '1')
  const [beginnerProtectionActive, setBeginnerProtectionActive] = useState<boolean>(true)
  const [matchesPlayed, setMatchesPlayed] = useState<number>(0)
  const [togglingProtection, setTogglingProtection] = useState<boolean>(false)
  const aiGame = useAIGame()
  const session = useSession({
    provider: activeWallet.provider,
    signer: activeWallet.signer,
    account: activeWallet.account,
  })

  const toggleFlipCounts = useCallback(() => {
    setShowFlipCounts(prev => !prev)
  }, [])

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (gameId) {
        url.searchParams.set('game', gameId)
      } else {
        url.searchParams.delete('game')
      }
      window.history.replaceState({}, '', url)
    } catch {
      // ignore environments without history support
    }
  }, [gameId])

  useEffect(() => {
    localStorage.setItem('othello.flipBadges', showFlipCounts ? '1' : '0')
  }, [showFlipCounts])

  const fetchBalances = useCallback(async () => {
    const account = activeWallet.account
    const provider = activeWallet.provider
    if (!account) {
      setYygBalance('0')
      setSttBalance('0.000000')
      return
    }
    if (contracts) {
      try {
        const raw = await contracts.yyg.balanceOf(account)
        setYygBalance(formatUnits(raw, 18))
      } catch {
        setYygBalance('0')
      }
    }
    if (provider) {
      try {
        const raw = await provider.getBalance(account)
        setSttBalance(formatEther(raw))
      } catch {
        setSttBalance('0.000000')
      }
    }
  }, [contracts, activeWallet.account, activeWallet.provider])

  const fetchBeginnerProtection = useCallback(async () => {
    const account = activeWallet.account
    if (!account || !contracts) return
    try {
      const [active, count] = await Promise.all([
        contracts.readOnlyGame.isBeginnerProtectionActive(account),
        contracts.readOnlyGame.totalMatchesPlayed(account),
      ])
      setBeginnerProtectionActive(Boolean(active))
      setMatchesPlayed(Number(count))
    } catch (err) {
      console.warn('Failed to fetch beginner protection:', err)
    }
  }, [contracts, activeWallet.account])

  const toggleBeginnerProtection = useCallback(async (enable: boolean) => {
    if (!contracts || !activeWallet.signer) {
      toast('error', 'Connect wallet first')
      return
    }
    setTogglingProtection(true)
    try {
      const tx = await contracts.game.setBeginnerProtection(enable)
      await tx.wait()
      setBeginnerProtectionActive(enable)
      toast('success', enable ? 'Beginner protection enabled' : 'Beginner protection disabled')
      await fetchBeginnerProtection()
    } catch (err) {
      console.error('toggleBeginnerProtection failed:', err)
      toast('error', 'Failed to toggle protection')
    } finally {
      setTogglingProtection(false)
    }
  }, [contracts, activeWallet.signer, fetchBeginnerProtection])

  const fetchLeaderboard = useCallback(async () => {
    if (!contracts) return
    try {
      const nextId = Number(await contracts.readOnlyGame.nextGameId())
      const playerMap = new Map<string, { wins: number; losses: number; elo: number }>()

      // Scan games to find unique players
      for (let i = 0; i < nextId; i++) {
        try {
          const gameData = await contracts.readOnlyGame.games(i)
          const p1 = String(gameData?.[2]?.[0] ?? '')
          const p2 = String(gameData?.[3]?.[0] ?? '')
          const status = Number(gameData?.[4])
          const blackBits = BigInt(gameData?.[0] ?? 0)
          const whiteBits = BigInt(gameData?.[1] ?? 0)

          if (p1 && p1 !== '0x0000000000000000000000000000000000000000') {
            if (!playerMap.has(p1)) playerMap.set(p1, { wins: 0, losses: 0, elo: 1200 })
          }
          if (p2 && p2 !== '0x0000000000000000000000000000000000000000') {
            if (!playerMap.has(p2)) playerMap.set(p2, { wins: 0, losses: 0, elo: 1200 })
          }

          if (status === 2 && (blackBits !== 0n || whiteBits !== 0n)) {
            // Count finished games
            const bCount = (blackBits.toString(2).match(/1/g) || []).length
            const wCount = (whiteBits.toString(2).match(/1/g) || []).length
            if (bCount > wCount) {
              if (playerMap.has(p1)) playerMap.get(p1)!.wins++
              if (playerMap.has(p2)) playerMap.get(p2)!.losses++
            } else if (wCount > bCount) {
              if (playerMap.has(p2)) playerMap.get(p2)!.wins++
              if (playerMap.has(p1)) playerMap.get(p1)!.losses++
            }
          }
        } catch {
          // ignore single game error
        }
      }

      const playerList: Player[] = []
      for (const [address, stats] of playerMap) {
        try {
          const eloRaw = await contracts.readOnlyElo.getELO(address)
          stats.elo = Number(formatUnits(eloRaw, 18))
        } catch {
          stats.elo = 1200
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
      const nextId = Number(await contracts.readOnlyGame.nextGameId())
      const pending: Array<{ gameId: string; challenger: string; stake: string }> = []
      const active: Array<{ gameId: string; black: string; white: string; stake: string }> = []
      const start = Math.max(0, nextId - 50)

      for (let i = start; i < nextId; i++) {
        try {
          const gameData = await contracts.readOnlyGame.games(i)
          // gameData[4] is status: 0 = PENDING, 1 = ACTIVE, 2 = FINISHED
          const status = Number(gameData?.[4])
          if (status === 0) {
            pending.push({
              gameId: String(i),
              challenger: String(gameData?.[2]?.[0] ?? ''),
              stake: formatUnits(BigInt(gameData?.[2]?.[3] ?? 0), 18),
            })
          } else if (status === 1) {
            active.push({
              gameId: String(i),
              black: String(gameData?.[2]?.[0] ?? ''),
              white: String(gameData?.[3]?.[0] ?? ''),
              stake: formatUnits(BigInt(gameData?.[2]?.[3] ?? 0), 18),
            })
          }
        } catch {
          // Ignore
        }
      }
      setPendingGames(pending.reverse().slice(0, 10))
      setActiveGames(active.reverse().slice(0, 10))
    } catch (err) {
      console.error('Failed to fetch pending games:', err)
    }
  }, [contracts])

  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchBalances()
    fetchBeginnerProtection()
  }, [fetchBalances, fetchBeginnerProtection])

  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchLeaderboard()
    fetchTreasury()
    fetchPendingGames()
    fetchBeginnerProtection()
    const id = setInterval(() => {
      fetchLeaderboard()
      fetchTreasury()
      fetchPendingGames()
      fetchBeginnerProtection()
    }, 30000)
    return () => clearInterval(id)
  }, [fetchLeaderboard, fetchTreasury, fetchPendingGames, fetchBeginnerProtection])

  return (
    <div className="app">
      <Nav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        account={activeWallet.account}
        onConnect={() => {
          setUseLocal(false)
          void wallet.connect()
        }}
        isConnecting={wallet.isConnecting || localWallet.isConnecting}
        onOpenLocalWallet={() => setShowLocalWalletModal(true)}
      />
      <ToastContainer />
      <main className="page-content">
        <Suspense fallback={<div className="page-content">Loading...</div>}>
          <PageContent
            activeTab={activeTab}
            contracts={contracts}
            signer={activeWallet.signer}
            provider={activeWallet.provider}
            yygBalance={yygBalance}
            sttBalance={sttBalance}
            account={activeWallet.account}
            onBalanceRefresh={fetchBalances}
            gameId={gameId}
            setGameId={setGameId}
            txPending={txPending}
            setTxPending={setTxPending}
            players={players}
            treasuryBalance={treasuryBalance}
            seasonDeadline={seasonDeadline}
            pendingGames={pendingGames}
            activeGames={activeGames}
            session={session}
            fetchTreasury={fetchTreasury}
            showFlipCounts={showFlipCounts}
            onToggleFlipCounts={toggleFlipCounts}
            onRenewSession={async (id: string) =>
              session.renewSession({ gameId: id, durationBlocks: 5000 })
            }
            onRevokeSession={async () => session.revokeSession()}
            onNavigate={setActiveTab}
            onConnect={() => {
              setUseLocal(false)
              void wallet.connect()
            }}
            aiGameState={aiGame.state}
            onAIStart={aiGame.startGame}
            onAIPlayerMove={aiGame.playerMove}
            beginnerProtection={activeWallet.account ? {
              active: beginnerProtectionActive,
              matchesPlayed,
              onToggle: toggleBeginnerProtection,
              toggling: togglingProtection,
            } : undefined}
          />
        </Suspense>
      </main>
      <YinYangStripe />
      <Footer onNavigate={setActiveTab} />
      <LocalWalletModal
        open={showLocalWalletModal}
        onClose={() => setShowLocalWalletModal(false)}
        wallet={localWallet}
        onUnlocked={() => setUseLocal(true)}
      />
    </div>
  )
}

export default App
