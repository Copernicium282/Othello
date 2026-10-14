import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { useLocalWallet } from '../hooks/useLocalWallet'

type Wallet = ReturnType<typeof useLocalWallet>

interface Props {
  open: boolean
  onClose: () => void
  wallet: Wallet
  onUnlocked?: () => void
}

const tabStyle: CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--color-hairline-medium, rgba(240,237,232,0.18))',
  background: 'var(--color-surface-raised, #1C1C20)',
  color: 'var(--color-slate, #908C88)',
  cursor: 'pointer',
  marginRight: '6px',
  borderRadius: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const activeTabStyle: CSSProperties = {
  ...tabStyle,
  background: 'var(--color-surface-elevated, #242428)',
  color: 'var(--color-ink, #F0ECE8)',
  fontWeight: 600,
  borderColor: 'var(--color-hairline-strong, rgba(240,237,232,0.28))',
}

export function LocalWalletModal({ open, onClose, wallet, onUnlocked }: Props) {
  const [tab, setTab] = useState<'unlock' | 'create' | 'import'>(wallet.hasKeystore ? 'unlock' : 'create')
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!open) return null

  const reset = () => {
    setPassword('')
    setPrivateKey('')
    setMessage(null)
    setBusy(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleUnlock = async () => {
    setBusy(true)
    setMessage(null)
    const result = await wallet.unlock(password)
    setBusy(false)
    if (result.ok) {
      setMessage('Browser wallet unlocked.')
      onUnlocked?.()
      handleClose()
    } else {
      setMessage(result.reason ?? 'Unlock failed.')
    }
  }

  const handleCreate = async () => {
    setBusy(true)
    setMessage(null)
    const result = await wallet.create(password)
    setBusy(false)
    if (result.ok) {
      setMessage(`Created browser wallet: ${result.address}`)
      onUnlocked?.()
      handleClose()
    } else {
      setMessage(result.reason ?? 'Create failed.')
    }
  }

  const handleImport = async () => {
    setBusy(true)
    setMessage(null)
    const result = await wallet.importPrivateKey(privateKey, password)
    setBusy(false)
    if (result.ok) {
      setMessage(`Imported browser wallet: ${result.address}`)
      onUnlocked?.()
      handleClose()
    } else {
      setMessage(result.reason ?? 'Import failed.')
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    marginTop: '4px',
    padding: '10px 12px',
    borderRadius: 0,
    border: '1px solid var(--color-hairline-medium, rgba(240,237,232,0.18))',
    background: 'var(--color-surface-raised, #1C1C20)',
    color: 'var(--color-ink, #F0ECE8)',
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.64)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-lg, 24px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'var(--color-surface-elevated, #242428)',
          padding: 'var(--space-xl, 32px)',
          borderRadius: 0,
          width: 'min(520px, 92vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid var(--color-hairline-strong, rgba(240,237,232,0.28))',
          color: 'var(--color-ink, #F0ECE8)',
          fontFamily: 'var(--font-mono)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, fontFamily: 'var(--font-heading)', fontSize: '24px', color: 'var(--color-ink)' }}>
          Browser Wallet (Testnet)
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-slate)' }}>
          No MetaMask needed. Keys are encrypted with your password and stored only in this browser.
          Loss of password means loss of access. Use for STT/YYG testnet play only.
        </p>

        <div style={{ marginBottom: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" style={tab === 'unlock' ? activeTabStyle : tabStyle} onClick={() => setTab('unlock')} disabled={!wallet.hasKeystore}>Unlock</button>
          <button type="button" style={tab === 'create' ? activeTabStyle : tabStyle} onClick={() => setTab('create')}>Create</button>
          <button type="button" style={tab === 'import' ? activeTabStyle : tabStyle} onClick={() => setTab('import')}>Import</button>
        </div>

        {wallet.hasKeystore && wallet.storedAddress && (
          <p style={{ fontSize: '13px', wordBreak: 'break-all', color: 'var(--color-slate)' }}>
            Stored wallet: {wallet.storedAddress}
          </p>
        )}

        {tab === 'unlock' && (
          <div>
            <label style={{ color: 'var(--color-ink-tint)' }}>
              Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            </label>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button type="button" className="button-primary" onClick={handleUnlock} disabled={busy || !password}>Unlock</button>
              <button type="button" className="button-secondary" onClick={wallet.deleteWallet} disabled={busy}>Delete wallet</button>
            </div>
          </div>
        )}

        {tab === 'create' && (
          <div>
            <label style={{ color: 'var(--color-ink-tint)' }}>
              New password (min 6)
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            </label>
            <div style={{ marginTop: '12px' }}>
              <button type="button" className="button-primary" onClick={handleCreate} disabled={busy || password.length < 6}>Create wallet</button>
            </div>
          </div>
        )}

        {tab === 'import' && (
          <div>
            <label style={{ color: 'var(--color-ink-tint)' }}>
              Private key
              <input value={privateKey} onChange={e => setPrivateKey(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginTop: '8px', color: 'var(--color-ink-tint)' }}>
              Password (min 6)
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            </label>
            <div style={{ marginTop: '12px' }}>
              <button type="button" className="button-primary" onClick={handleImport} disabled={busy || !privateKey || password.length < 6}>Import</button>
            </div>
          </div>
        )}

        {message && <p style={{ marginTop: '12px', color: 'var(--color-yin)' }}>{message}</p>}

        <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--color-slate)' }}>
          <p>Funding: get CELO from the <a href="https://faucet.celo.org/sepolia" target="_blank" rel="noreferrer" style={{ color: 'var(--color-yin)' }}>Sepolia CELO faucet</a>, then wrap CELO into YYG on the Wrap/Unwrap tab.</p>
          {wallet.account && (
            <p>Address (copy): <code style={{ wordBreak: 'break-all', color: 'var(--color-ink-tint)' }}>{wallet.account}</code></p>
          )}
        </div>

        <div style={{ marginTop: '12px', textAlign: 'right' }}>
          <button type="button" className="button-secondary" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
