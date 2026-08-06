import { useState } from 'react'
import type { Contract } from 'ethers'
import { parseEther, parseUnits } from 'ethers'
import type { useContracts } from '../hooks/useContracts'
import { toast } from './Toast'
import './pages.css'

const RATIO = 100_000

export interface WrapUnwrapProps {
  yygBalance?: string
  sttBalance?: string
  account?: string | null
  contracts: ReturnType<typeof useContracts>
  onBalanceRefresh?: () => void
}

export function WrapUnwrap({
  yygBalance = '0',
  sttBalance = '0.000000',
  account,
  contracts,
  onBalanceRefresh,
}: WrapUnwrapProps) {
  const [sttAmount, setSttAmount] = useState('')
  const [yygAmount, setYygAmount] = useState('')
  const [unwrapAmount, setUnwrapAmount] = useState('')
  const [sttOutput, setSttOutput] = useState('')
  const [isWrapping, setIsWrapping] = useState(false)
  const [isUnwrapping, setIsUnwrapping] = useState(false)

  const handleSttChange = (value: string) => {
    setSttAmount(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      setYygAmount((num * RATIO).toLocaleString('en-US', { maximumFractionDigits: 2 }))
    } else {
      setYygAmount('')
    }
  }

  const handleYygChange = (value: string) => {
    setUnwrapAmount(value)
    const num = parseFloat(value.replace(/,/g, ''))
    if (!isNaN(num) && num >= 0) {
      setSttOutput((num / RATIO).toFixed(6))
    } else {
      setSttOutput('')
    }
  }

  const handleWrap = async () => {
    if (!contracts || !sttAmount) return
    const num = parseFloat(sttAmount)
    if (isNaN(num) || num <= 0) return

    setIsWrapping(true)
    try {
      const yyg = contracts.yyg as Contract
      const tx = await yyg.wrap({ value: parseEther(sttAmount) })
      await tx.wait()
      setSttAmount('')
      setYygAmount('')
      onBalanceRefresh?.()
      toast('success', 'Wrapped STT to YYG')
    } catch {
      toast('error', 'Wrap failed')
    } finally {
      setIsWrapping(false)
    }
  }

  const handleUnwrap = async () => {
    if (!contracts || !unwrapAmount) return
    const num = parseFloat(unwrapAmount.replace(/,/g, ''))
    if (isNaN(num) || num <= 0) return

    setIsUnwrapping(true)
    try {
      const yyg = contracts.yyg as Contract
      const yygWei = parseUnits(unwrapAmount.replace(/,/g, ''), 18)
      const tx = await yyg.unwrap(yygWei)
      await tx.wait()
      setUnwrapAmount('')
      setSttOutput('')
      onBalanceRefresh?.()
      toast('success', 'Unwrapped YYG to STT')
    } catch {
      toast('error', 'Unwrap failed')
    } finally {
      setIsUnwrapping(false)
    }
  }

  const handleUnwrapAll = async () => {
    if (!contracts || !account) return

    setIsUnwrapping(true)
    try {
      const yyg = contracts.yyg as Contract
      const raw = await yyg.balanceOf(account)
      if (raw === 0n) {
        setIsUnwrapping(false)
        return
      }
      const tx = await yyg.unwrap(raw)
      await tx.wait()
      setUnwrapAmount('')
      setSttOutput('')
      onBalanceRefresh?.()
      toast('success', 'Unwrapped YYG to STT')
    } catch {
      toast('error', 'Unwrap all failed')
    } finally {
      setIsUnwrapping(false)
    }
  }

  const wrapDisabled = !contracts || isWrapping || !sttAmount
  const unwrapDisabled = !contracts || isUnwrapping || !unwrapAmount

  if (!account) {
    return (
      <div className="wrap-unwrap">
        <div className="wrap-unwrap-card card-feature">
          <div className="balance-label" style={{ textAlign: 'center', color: 'var(--color-slate)' }}>
            Not Connected to Wallet
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap-unwrap">
      <div className="wrap-unwrap-card card-feature">
        <div className="balance-label">
          <div>STT Balance: {sttBalance}</div>
          <div style={{ marginTop: 'var(--space-xs)' }}>YYG Balance: {yygBalance}</div>
        </div>

        <div className="wrap-section">
          <span className="eyebrow">Wrap STT → YYG</span>
          <p className="body-sm text-slate">
            Convert your STT into YinYang tokens at a 1:100,000 ratio
          </p>

          <div className="input-row">
            <input
              type="text"
              className="amount-input"
              placeholder="0.00"
              value={sttAmount}
              onChange={(e) => handleSttChange(e.target.value)}
            />
            <div className="output-display">
              {yygAmount || '0'}
            </div>
          </div>
          <div className="ratio-label">1 STT = 100,000 YYG</div>

          <button
            className="button-primary"
            style={{ marginTop: 'var(--space-lg)', width: '100%' }}
            onClick={handleWrap}
            disabled={wrapDisabled}
          >
            {isWrapping ? 'Wrapping...' : 'Wrap'}
          </button>
          <button
            className="button-secondary"
            style={{ marginTop: 'var(--space-xs)', width: '100%', fontSize: '13px' }}
            onClick={() => window.open('https://cloud.google.com/application/web3/faucet/somnia/shannon', '_blank')}
          >
            Get STT Testnet Tokens
          </button>
        </div>

        <div className="wrap-divider" />

        <div className="unwrap-section">
          <span className="eyebrow">Unwrap YYG → STT</span>
          <p className="body-sm text-slate">
            Convert your YinYang tokens back to STT at a 1:100,000 ratio
          </p>

          <div className="input-row">
            <input
              type="text"
              className="amount-input"
              placeholder="0.00"
              value={unwrapAmount}
              onChange={(e) => handleYygChange(e.target.value)}
            />
            <div className="output-display output-display--yang">
              {sttOutput || '0.000000'}
            </div>
          </div>
          <div className="ratio-label">100,000 YYG = 1 STT</div>

          <button
            className="button-primary button-yang"
            style={{ marginTop: 'var(--space-lg)', width: '100%' }}
            onClick={handleUnwrap}
            disabled={unwrapDisabled}
          >
            {isUnwrapping ? 'Unwrapping...' : 'Unwrap'}
          </button>
          <button
            className="button-secondary button-unwrap-all"
            style={{ marginTop: 'var(--space-xs)', width: '100%' }}
            onClick={handleUnwrapAll}
            disabled={isUnwrapping || !contracts}
          >
            {isUnwrapping ? 'Unwrapping...' : 'Unwrap All'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WrapUnwrap
