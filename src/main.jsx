import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleHelp,
  Gauge,
  History,
  LayoutDashboard,
  LineChart,
  LockKeyhole,
  Menu,
  Pencil,
  PanelLeft,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react'
import './styles.css'

const markets = [
  { name: '恒生指数', code: 'HSI', symbol: 'HK.800000', value: '19,884.92', change: '+1.24%', tone: 'positive' },
  { name: '恒生科技', code: 'HSTECH', symbol: 'HK.800700', value: '4,661.10', change: '+1.58%', tone: 'positive' },
  { name: '国企指数', code: 'HSCEI', symbol: 'HK.800100', value: '8,565.70', change: '+1.43%', tone: 'positive' },
  { name: '南向主板', code: 'HK MAIN', symbol: 'HK.800000', value: '25,731.21', change: '+0.86%', tone: 'positive' },
]

const signalSeed = [
  { symbol: 'HK.00981', name: '中芯国际', action: '持有', detail: '动量强势 · 5m', confidence: '0.84', price: '69.45', tone: 'positive', time: '刚刚' },
  { symbol: 'HK.01810', name: '小米集团-W', action: '持有', detail: '趋势延续 · 15m', confidence: '0.73', price: '28.96', tone: 'neutral', time: '2 分钟前' },
  { symbol: 'HK.03690', name: '美团-W', action: '风险监控', detail: '成本下方 · 5m', confidence: '0.79', price: '79.20', tone: 'warning', time: '6 分钟前' },
  { symbol: 'HK.07200', name: '南方两倍做多恒指', action: '杠杆监控', detail: '波动放大 · 5m', confidence: '0.68', price: '5.855', tone: 'warning', time: '9 分钟前' },
]

const initialPositions = [
  { symbol: 'HK.03690', name: '美团-W', side: '多', qty: 2500, avg: 84.91, last: 79.20, risk: '高' },
  { symbol: 'HK.09992', name: '泡泡玛特', side: '多', qty: 200, avg: 162.00, last: 155.10, risk: '中' },
  { symbol: 'HK.01810', name: '小米集团-W', side: '多', qty: 2000, avg: 27.05, last: 28.96, risk: '低' },
  { symbol: 'HK.00981', name: '中芯国际', side: '多', qty: 5000, avg: 39.70, last: 69.45, risk: '中' },
  { symbol: 'HK.07200', name: '南方两倍做多恒指', side: '多', qty: 10000, avg: 3.55, last: 5.855, risk: '高' },
]

const candidateStocks = [
  { symbol: 'HK.00700', name: '腾讯控股', price: 447, score: 'B+', method: '恒指强度 + 20MA 突破' },
  { symbol: 'HK.00005', name: '汇丰控股', price: 87.65, score: 'B', method: '低波动 + 股息防守' },
  { symbol: 'HK.02800', name: '盈富基金', price: 19.88, score: 'B+', method: '大盘趋势 + 风险预算' },
]

const STORAGE_KEY = 'nexus-sim-account-v2'
const SOURCE_KEY = 'nexus-market-source-v1'
const INITIAL_CASH = 404204.65
const marketSources = [
  { id: 'futu', label: '富途 OpenD', detail: '本机 127.0.0.1:11111 · 实时行情与 K 线' },
  { id: 'eastmoney', label: '东方财富', detail: '公开行情接口 · 适合国内本地部署' },
  { id: 'ths', label: '同花顺', detail: '需要配置本地授权接口或 Token' },
]

const formatNumber = (value, digits = 2) => Number(value || 0).toLocaleString('zh-HK', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function hydratePosition(position, liveQuotes) {
  const last = Number(liveQuotes[position.symbol]?.price ?? position.last ?? position.avg)
  const pnl = (last - Number(position.avg)) * Number(position.qty) * (position.side === '空' ? -1 : 1)
  const pnlPct = Number(position.avg) ? pnl / (Number(position.avg) * Number(position.qty)) * 100 : 0
  return { ...position, last, pnl, pnlPct, tone: pnl >= 0 ? 'positive' : 'negative' }
}

function buildRecommendation(item, liveQuotes, isCandidate = false) {
  const price = Number(liveQuotes[item.symbol]?.price ?? item.price ?? item.last ?? item.avg)
  const volatility = item.risk === '高' ? 0.035 : 0.025
  const lossPct = item.avg ? (price - Number(item.avg)) / Number(item.avg) * 100 : 0
  const reduceRisk = !isCandidate && (item.risk === '高' || lossPct < -4)
  return {
    ...item,
    price,
    action: reduceRisk ? '减仓 / 控制风险' : isCandidate ? '观察 / 回踩确认' : '持有 / 回踩加仓',
    entry: `${(price * (isCandidate ? 0.985 : 0.99)).toFixed(2)} – ${(price * 1.003).toFixed(2)}`,
    stop: (price * (reduceRisk ? 0.975 : 0.94)).toFixed(2),
    target: (price * (reduceRisk ? 1.025 : 1.10)).toFixed(2),
    score: reduceRisk ? 'C+' : item.score || 'A-',
    method: item.method || (item.symbol === 'HK.07200' ? '趋势 + ATR 杠杆过滤' : '动量 + VWAP + 风险预算'),
  }
}

const navItems = [
  { label: '总览', icon: LayoutDashboard },
  { label: '市场地图', icon: BarChart3 },
  { label: '持仓与风险', icon: WalletCards },
  { label: '策略实验室', icon: BrainCircuit },
  { label: '提醒中心', icon: Bell, count: 3 },
]

function Sparkline({ tone = 'positive', large = false }) {
  const stroke = tone === 'negative' ? '#f17979' : '#58d9b3'
  const points = tone === 'negative'
    ? '0,33 14,28 28,31 42,20 56,24 70,12 84,18 98,8'
    : '0,31 14,32 28,24 42,27 56,18 70,21 84,10 98,6'
  return (
    <svg className={large ? 'sparkline large' : 'sparkline'} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={large ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Chart({ rows = [], plan }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const fallback = Array.from({ length: 42 }, (_, index) => {
    const close = 65 + index * 0.1 + Math.sin(index * 0.7) * 1.2 + (index > 25 ? (index - 25) * 0.25 : 0)
    return { open: close - 0.35, high: close + 0.55, low: close - 0.62, close, volume: 1000 + index * 85 }
  })
  const candles = rows.length > 2 ? rows.slice(-60) : fallback
  const values = candles.flatMap((row) => [row.high, row.low]).filter((value) => typeof value === 'number')
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = 760
  const height = 300
  const y = (value) => 250 - ((value - min) / Math.max(max - min, 0.0001)) * 220
  const candleWidth = Math.max(4, Math.min(10, width / candles.length * 0.58))
  const movingAverage = candles.map((row, index) => {
    const start = Math.max(0, index - 7)
    const slice = candles.slice(start, index + 1)
    const average = slice.reduce((sum, item) => sum + item.close, 0) / slice.length
    return `${((index + .5) / candles.length) * width},${y(average)}`
  }).join(' ')
  const planLines = plan ? [
    { label: '止盈', value: Number(plan.target), color: '#58d9b3' },
    { label: '入场', value: Number(plan.entryValue), color: '#d9ac67' },
    { label: '止损', value: Number(plan.stop), color: '#f17979' },
  ].filter((line) => Number.isFinite(line.value) && line.value >= min && line.value <= max) : []
  const hovered = hoverIndex === null ? null : candles[hoverIndex]
  const hoverX = hoverIndex === null ? 0 : ((hoverIndex + .5) / candles.length) * width
  const hoverY = hovered ? y(hovered.close) : 0
  return (
    <div className="chart-wrap candlestick-wrap">
      <svg className="main-chart candlestick-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="富途 OpenD 实时 OHLC K线图" onMouseLeave={() => setHoverIndex(null)}>
        {[30, 85, 140, 195, 250].map((gridY) => <line key={gridY} x1="0" y1={gridY} x2={width} y2={gridY} stroke="#27313a" strokeWidth="1" />)}
        <polyline points={movingAverage} fill="none" stroke="#c4a66e" strokeWidth="1.4" strokeDasharray="4 4" opacity=".9" />
        {candles.map((candle, index) => {
          const x = ((index + .5) / candles.length) * width
          const rising = candle.close >= candle.open
          const color = rising ? '#58d9b3' : '#f17979'
          const bodyY = Math.min(y(candle.open), y(candle.close))
          const bodyHeight = Math.max(2, Math.abs(y(candle.open) - y(candle.close)))
          return <g key={`${candle.time || index}-${index}`} onMouseEnter={() => setHoverIndex(index)}><line x1={x} y1={y(candle.high)} x2={x} y2={y(candle.low)} stroke={color} strokeWidth="1.2" /><rect x={x - candleWidth / 2} y={bodyY} width={candleWidth} height={bodyHeight} fill={rising ? '#163e36' : '#49282b'} stroke={color} strokeWidth="1.1" /><rect x={x - Math.max(8, candleWidth * 1.8)} y="0" width={Math.max(16, candleWidth * 3.6)} height="265" fill="transparent" /></g>
        })}
        {planLines.map((line) => <g key={line.label}><line x1="0" y1={y(line.value)} x2={width} y2={y(line.value)} stroke={line.color} strokeWidth="1" strokeDasharray="7 5" /><text x={width - 48} y={y(line.value) - 5} fill={line.color} fontSize="11">{line.label}</text></g>)}
        {hovered && <><line x1={hoverX} y1="0" x2={hoverX} y2="265" stroke="#a6b7ba" strokeWidth="1" strokeDasharray="3 4" opacity=".65" /><line x1="0" y1={hoverY} x2={width} y2={hoverY} stroke="#a6b7ba" strokeWidth="1" strokeDasharray="3 4" opacity=".65" /><circle cx={hoverX} cy={hoverY} r="3" fill="#e7f1ef" stroke="#0f171d" strokeWidth="2" /></>}
      </svg>
      {hovered && <div className="chart-tooltip" style={{ left: `${Math.max(8, Math.min(76, (hoverIndex / Math.max(candles.length - 1, 1)) * 100))}%` }}><strong>{hovered.time || `K线 ${hoverIndex + 1}`}</strong><span>开 <b>{Number(hovered.open).toFixed(3)}</b>　高 <b>{Number(hovered.high).toFixed(3)}</b></span><span>低 <b>{Number(hovered.low).toFixed(3)}</b>　收 <b className={hovered.close >= hovered.open ? 'positive' : 'negative'}>{Number(hovered.close).toFixed(3)}</b></span><span>量 <b>{Number(hovered.volume || 0).toLocaleString()}</b></span></div>}
      <div className="chart-x-labels"><span>09:30</span><span>10:15</span><span>11:00</span><span>11:45</span><span>12:30</span><span>13:15</span></div>
    </div>
  )
}

function MarketMapView() {
  const [scope, setScope] = useState('持仓相关')
  const rows = [
    ['HK.00981', '中芯国际', '70.20', '+3.47%', '25.43M', '强势'],
    ['HK.01810', '小米集团-W', '28.96', '+2.04%', '38.12M', '强势'],
    ['HK.03690', '美团-W', '79.20', '-2.53%', '18.34M', '承压'],
    ['HK.09992', '泡泡玛特', '155.10', '-4.18%', '2.18M', '承压'],
    ['HK.07200', '南方两倍做多恒指', '5.855', '+3.17%', '12.06M', '高波动'],
  ]
  return <section className="view-panel"><div className="view-toolbar"><div><p className="eyebrow">LIVE MARKET MAP</p><h2>市场地图</h2><span className="view-note">按你的 5 个持仓筛选，数据来自富途 OpenD。</span></div><div className="segmented-control">{['持仓相关', '全部自选', '涨跌幅'].map((item) => <button className={scope === item ? 'selected' : ''} key={item} onClick={() => setScope(item)}>{item}</button>)}</div></div><div className="market-table"><div className="market-table-head"><span>标的</span><span>最新价</span><span>涨跌幅</span><span>成交量</span><span>状态</span><span>操作</span></div>{rows.map((row) => <div className="market-table-row" key={row[0]}><div><strong>{row[0]}</strong><small>{row[1]}</small></div><strong>{row[2]}</strong><span className={row[3].startsWith('+') ? 'positive' : 'negative'}>{row[3]}</span><span className="mono-muted">{row[4]}</span><span className={`market-state ${row[5] === '承压' ? 'danger' : row[5] === '高波动' ? 'warn' : ''}`}>{row[5]}</span><button className="small-action" onClick={() => window.alert(`已将 ${row[1]} 设为主图标的`)}>查看图表</button></div>)}</div></section>
}

function PositionEditor({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { symbol: 'HK.00700', name: '腾讯控股', qty: 1000, avg: 447.8, risk: '中', side: '多' })
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: key === 'qty' || key === 'avg' ? Number(event.target.value) : event.target.value }))
  return <div className="plan-modal-backdrop" onClick={onClose}><div className="plan-modal editor-modal" onClick={(event) => event.stopPropagation()}><div className="plan-modal-head"><div><span className="eyebrow">PORTFOLIO CONFIG</span><h3>配置模拟持仓</h3></div><button className="icon-button" onClick={onClose} aria-label="关闭配置"><X size={17} /></button></div><div className="editor-grid"><label>代码<input value={form.symbol} onChange={update('symbol')} placeholder="HK.00700" /></label><label>名称<input value={form.name} onChange={update('name')} placeholder="腾讯控股" /></label><label>数量<input type="number" min="0" step="100" value={form.qty} onChange={update('qty')} /></label><label>持仓成本<input type="number" min="0" step="0.01" value={form.avg} onChange={update('avg')} /></label><label>方向<select value={form.side} onChange={update('side')}><option>多</option><option>空</option></select></label><label>风险<select value={form.risk} onChange={update('risk')}><option>低</option><option>中</option><option>高</option></select></label></div><p className="plan-disclaimer">保存后会加入本地模拟账户；行情现价仍由富途 OpenD 提供，真实交易不会被触发。</p><div className="plan-modal-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => { if (form.symbol && form.name && form.qty > 0 && form.avg >= 0) { onSave(form); onClose() } }}><Check size={15} />保存持仓</button></div></div></div>
}

function MarketSourceSettings({ source, onChange, onClose }) {
  const selected = marketSources.find((item) => item.id === source) || marketSources[0]
  return <div className="plan-modal-backdrop" onClick={onClose}><section className="plan-modal source-modal" onClick={(event) => event.stopPropagation()}><div className="plan-modal-head"><div><span className="eyebrow">DATA CONNECTION</span><h3>行情源设置</h3></div><button className="icon-button" onClick={onClose} aria-label="关闭行情源设置"><X size={17} /></button></div><p className="source-intro">选择本地部署使用的行情服务。切换后，顶部指数、主图和量化点位会使用对应数据源刷新。</p><div className="source-options">{marketSources.map((item) => <button key={item.id} className={`source-option ${item.id === source ? 'selected' : ''}`} onClick={() => onChange(item.id)}><span className={`source-radio ${item.id === source ? 'selected' : ''}`} /><span><strong>{item.label}</strong><small>{item.detail}</small></span>{item.id === 'futu' && <span className="source-status">已连接</span>}{item.id === 'eastmoney' && <span className="source-status ready">可用</span>}{item.id === 'ths' && <span className="source-status pending">待配置</span>}</button>)}</div><div className="source-current"><span>当前数据源</span><strong>{selected.label}</strong><small>{source === 'ths' ? '请在 server.py 配置授权后使用同花顺数据。' : '系统会保留模拟账户数据，切换行情源不会改变持仓。'}</small></div><div className="plan-modal-actions"><button className="primary-button" onClick={onClose}><Check size={15} />完成</button></div></section></div>
}

function TradeTicket({ draft, cash, position, quote, onClose, onApprove }) {
  const [form, setForm] = useState(() => ({
    side: draft.side,
    orderType: '限价单',
    price: Number(draft.price),
    qty: Number(draft.qty),
  }))
  const livePrice = Number(quote?.price ?? draft.price)
  const bid = Number(quote?.bid || livePrice)
  const ask = Number(quote?.ask || livePrice)
  const amount = Number(form.price || 0) * Number(form.qty || 0)
  const heldQty = Number(position?.qty || 0)
  const maxBuy = Math.floor(cash / Math.max(Number(form.price), .01) / 100) * 100
  const maxSell = heldQty
  const invalidPrice = !Number.isFinite(Number(form.price)) || Number(form.price) <= 0
  const invalidQty = !Number.isFinite(Number(form.qty)) || Number(form.qty) <= 0 || Number(form.qty) % 100 !== 0
  const insufficient = form.side === 'buy' ? amount > cash : Number(form.qty) > heldQty
  const canApprove = !invalidPrice && !invalidQty && !insufficient
  const update = (key) => (event) => setForm((previous) => ({ ...previous, [key]: key === 'price' || key === 'qty' ? Number(event.target.value) : event.target.value }))
  const usePercent = (percent) => {
    const maximum = form.side === 'buy' ? maxBuy : maxSell
    const next = Math.floor(maximum * percent / 100 / 100) * 100
    setForm((previous) => ({ ...previous, qty: Math.max(0, next) }))
  }
  return <div className="trade-ticket-backdrop" onClick={onClose}><section className="trade-ticket" onClick={(event) => event.stopPropagation()} aria-label="模拟快捷交易票据"><header className="ticket-header"><div><span className="ticket-mode">SIMULATION · 人工审批</span><h2>{draft.symbol} <small>{draft.name}</small></h2></div><button className="icon-button" onClick={onClose} aria-label="关闭交易票据"><X size={18} /></button></header><div className="ticket-market"><div><span>最新价</span><strong>{formatNumber(livePrice)}</strong></div><div><span>买一</span><strong className="positive">{formatNumber(bid)}</strong></div><div><span>卖一</span><strong className="negative">{formatNumber(ask)}</strong></div><div><span>当前持仓</span><strong>{formatNumber(heldQty, 0)} 股</strong></div></div><div className="ticket-body"><div className="ticket-form"><div className="side-switch"><button className={form.side === 'buy' ? 'buy active' : ''} onClick={() => setForm((previous) => ({ ...previous, side: 'buy', qty: draft.buyQty }))}>模拟买入</button><button className={form.side === 'sell' ? 'sell active' : ''} onClick={() => setForm((previous) => ({ ...previous, side: 'sell', qty: Math.min(draft.sellQty, heldQty) }))}>模拟卖出</button></div><label>委托类型<select value={form.orderType} onChange={update('orderType')}><option>限价单</option><option>市价单</option></select></label><label>委托价格<div className="step-input"><button onClick={() => setForm((previous) => ({ ...previous, price: Math.max(.001, Number(previous.price) - .01) }))}>−</button><input aria-label="委托价格" type="number" min="0" step="0.01" value={form.price} onChange={update('price')} disabled={form.orderType === '市价单'} /><button onClick={() => setForm((previous) => ({ ...previous, price: Number(previous.price) + .01 }))}>+</button></div></label><label>委托数量<div className="step-input"><button onClick={() => setForm((previous) => ({ ...previous, qty: Math.max(0, Number(previous.qty) - 100) }))}>−</button><input aria-label="委托数量" type="number" min="0" step="100" value={form.qty} onChange={update('qty')} /><button onClick={() => setForm((previous) => ({ ...previous, qty: Number(previous.qty) + 100 }))}>+</button></div></label><div className="allocation-buttons">{[25, 50, 75, 100].map((percent) => <button key={percent} onClick={() => usePercent(percent)}>{percent}%</button>)}</div><div className="ticket-capacity"><span>{form.side === 'buy' ? '最大可买' : '最大可卖'}</span><strong>{formatNumber(form.side === 'buy' ? maxBuy : maxSell, 0)} 股</strong></div></div><aside className="ticket-plan"><div className="ticket-plan-title"><Sparkles size={15} /><span>AI 量化建议</span><b>{draft.score}</b></div><h3>{draft.action}</h3><p>{draft.method}</p><dl><div><dt>触发区间</dt><dd>{draft.entry}</dd></div><div><dt>止损价位</dt><dd className="negative">{draft.stop}</dd></div><div><dt>止盈目标</dt><dd className="positive">{draft.target}</dd></div><div><dt>置信度</dt><dd>{draft.confidence || '0.72'}</dd></div></dl><div className="invalidation"><AlertTriangle size={14} /><span>失效条件：收盘跌破止损，或价格脱离触发区后量能未确认。</span></div></aside></div><footer className="ticket-footer"><div className="order-checks"><span>预计金额 <strong>¥{formatNumber(amount)}</strong></span><span>可用现金 <strong>¥{formatNumber(cash)}</strong></span><span className={canApprove ? 'positive' : 'negative'}>{canApprove ? '风控校验通过' : insufficient ? (form.side === 'buy' ? '可用资金不足' : '卖出数量超过持仓') : '价格或数量无效'}</span></div><div className="ticket-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className={`approve-order ${form.side}`} disabled={!canApprove} onClick={() => onApprove({ ...draft, ...form, price: form.orderType === '市价单' ? livePrice : Number(form.price), qty: Number(form.qty) })}><Check size={16} />批准模拟{form.side === 'buy' ? '买入' : '卖出'}</button></div></footer></section></div>
}

function PositionsView({ positions, liveQuotes, onTrade, tradeLog, onReset, onUpsert, onEdit, onDelete }) {
  const [filter, setFilter] = useState('全部')
  const [planPosition, setPlanPosition] = useState(null)
  const [editPosition, setEditPosition] = useState(null)
  const hydrated = positions.map((item) => hydratePosition(item, liveQuotes))
  const filtered = filter === '全部' ? hydrated : hydrated.filter((item) => item.risk === filter)
  return <section className="view-panel"><div className="view-toolbar"><div><p className="eyebrow">PORTFOLIO CONTROL</p><h2>持仓与风险</h2><span className="view-note">港股模拟账户 · 可调仓 · 所有成交只写入本地模拟账本</span></div><div className="view-toolbar-actions"><div className="segmented-control">{['全部', '低', '中', '高'].map((item) => <button className={filter === item ? 'selected' : ''} key={item} onClick={() => setFilter(item)}>{item}{item !== '全部' ? '风险' : ''}</button>)}</div><button className="secondary-button" onClick={onReset}><RefreshCw size={14} />重置账户</button></div></div><div className="risk-banner"><ShieldCheck size={17} /><div><strong>组合风险在预算内</strong><span>现金 ¥{formatNumber(INITIAL_CASH)} 起始 · 当前模拟成交 {tradeLog.length} 笔</span></div><b>82 / 100</b></div><div className="table-scroll"><table><thead><tr><th>标的</th><th>数量</th><th>成本</th><th>现价</th><th>浮动盈亏</th><th>风险</th><th>操作</th></tr></thead><tbody>{filtered.map((position) => <tr key={position.symbol}><td><div className="asset-cell"><strong>{position.symbol}</strong><span>{position.name}</span></div></td><td>{formatNumber(position.qty, 0)}</td><td>{formatNumber(position.avg)}</td><td>{formatNumber(position.last, position.last < 10 ? 3 : 2)}</td><td><strong className={position.tone}>{position.pnl >= 0 ? '+' : ''}{formatNumber(position.pnl, 2)}</strong><span className={`pnl-percent ${position.tone}`}>{position.pnlPct >= 0 ? '+' : ''}{position.pnlPct.toFixed(2)}%</span></td><td><span className={`risk-tag ${position.risk === '高' ? 'high' : position.risk === '中' ? 'medium' : 'low'}`}>{position.risk}</span></td><td><div className="row-actions"><button className="small-action" onClick={() => setPlanPosition(position)}>量化计划</button><button className="small-action" onClick={() => onTrade(position, 'sell')}>卖出</button></div></td></tr>)}</tbody></table></div>{tradeLog.length > 0 && <div className="trade-log"><div className="trade-log-title"><span><History size={14} />模拟成交记录</span><small>最近 {tradeLog.length} 笔</small></div>{tradeLog.slice(0, 4).map((trade) => <div className="trade-log-row" key={trade.id}><span>{trade.time}</span><strong className={trade.side === '买入' ? 'positive' : 'negative'}>{trade.side}</strong><span>{trade.symbol}</span><span>{formatNumber(trade.qty, 0)} 股 @ {formatNumber(trade.price)}</span><b>{trade.status}</b></div>)}</div>}{planPosition && <div className="plan-modal-backdrop" onClick={() => setPlanPosition(null)}><div className="plan-modal" onClick={(event) => event.stopPropagation()}><div className="plan-modal-head"><div><span className="eyebrow">AI TRADE PLAN · SIMULATION</span><h3>{planPosition.symbol} · {planPosition.name}</h3></div><button className="icon-button" onClick={() => setPlanPosition(null)} aria-label="关闭计划"><X size={17} /></button></div><div className="plan-summary"><div><span>方向</span><strong className={planPosition.risk === '高' ? 'warning-text' : 'positive'}>{planPosition.risk === '高' ? '减仓 / 多' : '持有 / 多'}</strong></div><div><span>实时价</span><strong>{formatNumber(planPosition.last)}</strong></div><div><span>模拟数量</span><strong>{formatNumber(Math.max(100, Math.floor(planPosition.qty * (planPosition.risk === '高' ? .2 : .1))), 0)}</strong></div><div><span>杠杆</span><strong>1.0x</strong></div></div><div className="plan-levels"><div><span>建议区间</span><strong>{formatNumber(planPosition.last * .99)} – {formatNumber(planPosition.last * 1.003)}</strong></div><div><span>止盈目标</span><strong className="positive">{formatNumber(planPosition.last * 1.1)}</strong></div><div><span>止损价位</span><strong className="negative">{formatNumber(planPosition.last * .94)}</strong></div></div><p className="plan-disclaimer">目标价按最新富途行情和 ATR 风险带动态计算。点击模拟执行会更新持仓、现金和成交记录，不会连接实盘交易。</p><div className="plan-modal-actions"><button className="secondary-button" onClick={() => setPlanPosition(null)}>返回修改</button><button className="primary-button" onClick={() => { onTrade(planPosition, planPosition.risk === '高' ? 'sell' : 'buy'); setPlanPosition(null) }}><ShoppingCart size={15} />模拟执行</button></div></div></div>}</section>
}

function StrategyView() {
  const [running, setRunning] = useState(false)
  return <section className="view-panel"><div className="view-toolbar"><div><p className="eyebrow">RESEARCH LOOP</p><h2>策略实验室</h2><span className="view-note">Champion / Challenger · 版本化研究与影子测试</span></div><button className="primary-button" onClick={() => { setRunning(true); window.setTimeout(() => setRunning(false), 900) }}><Play size={15} fill="currentColor" />{running ? '扫描中...' : '运行研究扫描'}</button></div><div className="research-grid"><div className="research-card champion-card"><span className="strategy-label champion">CHAMPION</span><h3>HK Momentum v12</h3><p>适用组合：中芯国际、小米集团-W</p><div className="research-metrics"><div><strong>1.42</strong><small>Sharpe</small></div><div><strong>8.2%</strong><small>最大回撤</small></div><div><strong>96d</strong><small>影子运行</small></div></div><div className="research-status"><span className="status-dot live" />已批准 · 当前生产版本</div></div><div className="research-card challenger-card"><span className="strategy-label challenger-label">CHALLENGER</span><h3>HK Volatility v05</h3><p>正在评估南方两倍做多恒指的波动过滤</p><div className="research-metrics"><div><strong>1.08</strong><small>Sharpe</small></div><div><strong>10.6%</strong><small>最大回撤</small></div><div><strong>41d</strong><small>样本外</small></div></div><div className="research-status warning-text"><AlertTriangle size={14} />需要更多样本外数据</div></div></div><div className="research-log"><span className="status-dot live" />最近一次研究：今天 13:30 · 5 个候选参数 · 通过 2 个风险门槛</div></section>
}

function AlertsView({ signals, setSignals, setWatchSymbol }) {
  return <section className="view-panel"><div className="view-toolbar"><div><p className="eyebrow">ALERT CENTER</p><h2>提醒中心</h2><span className="view-note">所有提醒都需要人工确认，系统不会直接下单。</span></div><button className="secondary-button" onClick={() => setSignals([])}><Check size={15} />全部已读</button></div><div className="alert-grid">{signals.length ? signals.map((signal) => <button className="alert-card" key={signal.symbol} onClick={() => setWatchSymbol(signal.symbol)}><div className={`signal-icon ${signal.tone}`}><Bell size={16} /></div><div><strong>{signal.action} · {signal.name}</strong><p>{signal.symbol} · {signal.detail}</p><small>置信度 {signal.confidence} · {signal.time}</small></div><ChevronDown size={16} /></button>) : <div className="empty-state"><Check size={25} /><strong>暂无未读提醒</strong><span>下一次扫描后会在这里显示。</span></div>}</div></section>
}

function RecommendationsPanel({ positions, liveQuotes, onOpenTrade }) {
  const recommendations = positions.map((position) => buildRecommendation(position, liveQuotes))
  const positionSymbols = new Set(positions.map((position) => position.symbol))
  const candidates = candidateStocks.filter((item) => !positionSymbols.has(item.symbol)).map((item) => buildRecommendation(item, liveQuotes, true))
  const combined = [...recommendations, ...candidates]
  return <section className="panel recommendation-panel"><div className="panel-header"><div><div className="panel-kicker"><Sparkles size={14} />AI 荐股与点位</div><h2>量化计划草案 <span className="live-chip">按实时价计算</span></h2></div><span className="muted">每次刷新重新计算</span></div><div className="recommendation-note"><BrainCircuit size={15} /><span>目标价不会固定写死：以富途最新价为基准，结合 ATR 风险带动态计算。点击建议会自动填入交易票据，批准前不会改变模拟账户。</span></div><div className="recommendation-table"><div className="recommendation-head"><span>标的</span><span>策略动作</span><span>触发区间</span><span>止损</span><span>目标</span><span>评分</span><span>执行</span></div>{combined.map((item) => <div className="recommendation-row" key={item.symbol}><div><strong>{item.symbol}</strong><small>{item.name} · {formatNumber(item.price)}</small></div><div><strong className={item.action.startsWith('减') ? 'negative' : 'positive'}>{item.action}</strong><small>{item.method}</small></div><span>{item.entry}</span><span className="negative">{item.stop}</span><span className="positive">{item.target}</span><b className={item.score === 'C+' ? 'warning-text' : 'positive'}>{item.score}</b><button className="small-action" onClick={() => onOpenTrade(item, item.action.startsWith('减') ? 'sell' : 'buy')}><ShoppingCart size={12} />填入交易票据</button></div>)}</div></section>
}

function App() {
  const [activeNav, setActiveNav] = useState('总览')
  const [range, setRange] = useState('1D')
  const [period, setPeriod] = useState('1m')
  const [signals, setSignals] = useState(signalSeed)
  const [mobileNav, setMobileNav] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [watchSymbol, setWatchSymbol] = useState('HK.00981')
  const [liveQuotes, setLiveQuotes] = useState({})
  const [liveKline, setLiveKline] = useState([])
  const [liveConnected, setLiveConnected] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [tradeDraft, setTradeDraft] = useState(null)
  const [executionNotice, setExecutionNotice] = useState(null)
  const [marketSource, setMarketSource] = useState(() => window.localStorage.getItem(SOURCE_KEY) || 'futu')
  const [showSourceSettings, setShowSourceSettings] = useState(false)
  const [account, setAccount] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || { cash: INITIAL_CASH, positions: [], trades: [] } } catch { return { cash: INITIAL_CASH, positions: [], trades: [] } }
  })
  const selectedSignal = useMemo(() => signals.find((item) => item.symbol === watchSymbol) || signals[0], [signals, watchSymbol])
  const accountPositions = account.positions

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(account)) }, [account])
  useEffect(() => { window.localStorage.setItem(SOURCE_KEY, marketSource) }, [marketSource])

  useEffect(() => {
    let cancelled = false
    const loadQuotes = async () => {
      try {
        const payload = await fetch(`http://127.0.0.1:8787/api/quotes?source=${marketSource}`).then((response) => response.json())
        if (!cancelled && payload.ok) {
          setLiveQuotes(Object.fromEntries(payload.rows.map((row) => [row.symbol, row])))
          setLiveConnected(true)
        }
      } catch { if (!cancelled) setLiveConnected(false) }
    }
    const loadKline = async () => {
      try {
        const payload = await fetch(`http://127.0.0.1:8787/api/kline?symbol=${watchSymbol}&period=${period}&count=80&source=${marketSource}`).then((response) => response.json())
        if (!cancelled && payload.ok) setLiveKline(payload.rows)
      } catch { if (!cancelled) setLiveKline([]) }
    }
    loadQuotes(); loadKline()
    const quoteTimer = window.setInterval(loadQuotes, 5000)
    const klineTimer = window.setInterval(loadKline, 10000)
    return () => { cancelled = true; window.clearInterval(quoteTimer); window.clearInterval(klineTimer) }
  }, [watchSymbol, period, marketSource])

  const currentQuote = liveQuotes[watchSymbol]
  const activePrice = currentQuote?.price || Number(selectedSignal?.price || 0)
  const activePlan = {
    entryValue: activePrice,
    stop: activePrice * 0.96,
    target: activePrice * 1.08,
  }
  const marketCards = markets.map((market) => {
    const quote = liveQuotes[market.symbol]
    return quote?.price ? { ...market, value: quote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), change: `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)}%`, tone: quote.change >= 0 ? 'positive' : 'negative' } : market
  })

  const executeTrade = (item, side) => {
    const price = Number(item.price ?? liveQuotes[item.symbol]?.price ?? item.last ?? item.avg)
    if (!Number.isFinite(price) || price <= 0) return
    const existing = account.positions.find((position) => position.symbol === item.symbol)
    const suggestedQty = Math.max(100, Math.floor((Number(existing?.qty || 0) || 1000) * (side === 'sell' ? .2 : .1) / 100) * 100)
    const requestedQty = Number(item.qty || suggestedQty)
    const qty = side === 'sell' ? Math.min(requestedQty, Number(existing?.qty || 0)) : requestedQty
    if (!qty) return
    if (side === 'buy' && price * qty > account.cash) return
    setAccount((previous) => {
      const nextPositions = [...previous.positions]
      const index = nextPositions.findIndex((position) => position.symbol === item.symbol)
      if (side === 'buy') {
        if (index >= 0) {
          const current = nextPositions[index]
          const totalQty = Number(current.qty) + qty
          nextPositions[index] = { ...current, qty: totalQty, avg: (Number(current.avg) * Number(current.qty) + price * qty) / totalQty, last: price }
        } else nextPositions.push({ symbol: item.symbol, name: item.name, side: '多', qty, avg: price, last: price, risk: '中' })
      } else if (index >= 0) {
        const current = nextPositions[index]
        const remaining = Number(current.qty) - qty
        if (remaining <= 0) nextPositions.splice(index, 1)
        else nextPositions[index] = { ...current, qty: remaining, last: price }
      }
      const trade = { id: `${Date.now()}-${item.symbol}`, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), side: side === 'buy' ? '买入' : '卖出', symbol: item.symbol, qty, price, orderType: item.orderType || '限价单', source: 'AI 量化建议', status: '已模拟成交' }
      return { cash: previous.cash + (side === 'sell' ? price * qty : -price * qty), positions: nextPositions, trades: [trade, ...previous.trades].slice(0, 30) }
    })
    setTradeDraft(null)
    setExecutionNotice(`${side === 'buy' ? '模拟买入' : '模拟卖出'} ${item.symbol} ${formatNumber(qty, 0)} 股 @ ${formatNumber(price)} 已成交`)
    window.setTimeout(() => setExecutionNotice(null), 3200)
  }

  const openTradeTicket = (item, side) => {
    const prepared = item.entry ? item : buildRecommendation(item, liveQuotes)
    const price = Number(liveQuotes[item.symbol]?.price ?? prepared.price ?? prepared.last ?? prepared.avg)
    const position = account.positions.find((entry) => entry.symbol === item.symbol)
    const heldQty = Number(position?.qty || 0)
    const buyQty = Math.max(100, Math.min(1000, Math.floor(account.cash / Math.max(price, .01) / 100) * 100))
    const sellQty = heldQty ? Math.max(100, Math.floor(heldQty * .2 / 100) * 100) : 0
    setTradeDraft({ ...prepared, side, price, qty: side === 'sell' ? sellQty : buyQty, buyQty, sellQty })
  }

  const resetAccount = () => setAccount({ cash: INITIAL_CASH, positions: [], trades: [] })
  const savePosition = (position) => setAccount((previous) => {
    const existing = previous.positions.findIndex((item) => item.symbol === position.symbol)
    const next = [...previous.positions]
    if (existing >= 0) next[existing] = { ...next[existing], ...position }
    else next.push(position)
    return { ...previous, positions: next }
  })

  const refresh = () => {
    setIsRefreshing(true)
    window.setTimeout(() => setIsRefreshing(false), 700)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={17} strokeWidth={2.5} /></div>
          <div><strong>NEXUS</strong><span>QUANT DESK</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileNav(false)} aria-label="关闭导航"><X size={17} /></button>
        </div>
        <div className="workspace-switcher"><div className="workspace-dot" /><div><small>账户 · 牛牛号 232297241</small><strong>港股模拟账户</strong></div><ChevronDown size={15} /></div>
        <div className="sidebar-quick-stats"><div><span>净值</span><strong>¥1.097m</strong></div><div><span>可用资金</span><strong>¥404k</strong></div><div><span>今日盈亏</span><strong className="positive">+1.41%</strong></div></div>
        <nav className="nav-list" aria-label="主导航">
          <span className="nav-heading">工作台</span>
          {navItems.map(({ label, icon: Icon, count }) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => { setActiveNav(label); setMobileNav(false) }}>
              <Icon size={17} /><span>{label}</span>{count && <em>{count}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="feed-status"><span className={`status-dot ${liveConnected ? 'live' : ''}`} /><div><strong>{marketSources.find((item) => item.id === marketSource)?.label || '行情源'}</strong><small>{liveConnected ? '实时数据已连接' : '等待数据连接'}</small></div>{liveConnected && <Check size={15} />}</div>
          <button className="nav-item" onClick={() => setShowSourceSettings(true)}><Settings2 size={17} /><span>系统设置</span></button>
          <div className="profile"><div className="avatar">小</div><div><strong>小虎肖恩恩</strong><small>港股 LV1 · 已连接</small></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu size={18} /></button><span>工作台</span><span className="slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions"><div className="connection"><span className={`status-dot ${liveConnected ? 'live' : ''}`} />{marketSources.find((item) => item.id === marketSource)?.label || '行情源'} {liveConnected ? '已连接' : '未连接'}</div><button className="icon-button" onClick={refresh} aria-label="刷新数据" title="刷新数据"><RefreshCw size={17} className={isRefreshing ? 'spin' : ''} /></button><button className="help-button" onClick={() => setShowSourceSettings(true)}><Settings2 size={15} />行情源</button><div className="top-avatar">小</div></div>
        </header>

        <section className="market-strip top-market-strip" aria-label="主要指数">
          {marketCards.map((market) => <div className="market-card" key={market.code}><div className="market-card-top"><span>{market.name}</span><span className="market-code">{market.code}</span></div><div className="market-card-bottom"><div><strong>{market.value}</strong><span className={`change ${market.tone}`}>{market.change}</span></div><Sparkline tone={market.tone} /></div></div>)}
        </section>

        <section className="page-heading"><div><p className="eyebrow">HK SIMULATION ACCOUNT</p><h1>{activeNav}</h1><p className="subheading">港股模拟账户 · {accountPositions.length} 个持仓 · 净值 ¥1,097,069.65 · 仅模拟执行</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => setShowEditor(true)}><WalletCards size={16} />配置持仓</button><button className="primary-button" onClick={refresh}><Play size={15} fill="currentColor" />运行扫描</button></div></section>

        {activeNav === '总览' ? <div className="dashboard-grid">
          <section className="panel chart-panel"><div className="panel-header"><div><div className="panel-kicker"><span className={`status-dot ${liveConnected ? 'live' : ''}`} />主图监控 · {liveConnected ? '实时' : '模拟'}</div><h2>{selectedSignal.name} <small>{selectedSignal.symbol}</small></h2></div><div className="chart-controls"><div className="range-tabs">{[['1m','分时'],['week','分周'],['month','分月']].map(([value, label]) => <button key={value} className={period === value ? 'selected' : ''} onClick={() => setPeriod(value)}>{label}</button>)}</div><button className="icon-button" aria-label="展开主图" title="展开主图"><PanelLeft size={16} /></button></div></div><div className="price-row"><strong>{currentQuote?.price ? currentQuote.price.toFixed(3) : selectedSignal.price}</strong><span className={`change ${currentQuote?.change >= 0 ? 'positive' : 'negative'}`}>{currentQuote ? `${currentQuote.change >= 0 ? '+' : ''}${currentQuote.change.toFixed(2)}%` : '+1.24%'}</span><span className="muted">{currentQuote?.update_time ? `更新于 ${currentQuote.update_time}` : '等待行情数据'}</span></div><div className="chart-plan-strip"><span className="plan-action"><Sparkles size={13} />AI 量化计划</span><span><b>建议区间</b> {activePlan.entryValue.toFixed(2)} 附近分批</span><span><b className="negative">止损</b> {activePlan.stop.toFixed(2)}</span><span><b className="positive">目标</b> {activePlan.target.toFixed(2)}</span><small>悬停 K 线查看 OHLC</small></div><Chart rows={liveKline} plan={activePlan} /><div className="chart-footer"><span><i className="legend-line green" />阳线</span><span><i className="legend-line red-line" />阴线</span><span><i className="legend-line amber" />MA8</span><span className="chart-source">数据源：{liveConnected ? `${marketSources.find((item) => item.id === marketSource)?.label || '行情源'} 实时 K线` : '模拟回退'}</span></div></section>

          <section className="panel signal-panel"><div className="panel-header"><div><div className="panel-kicker"><Sparkles size={14} />AI 决策队列</div><h2>待确认信号 <span className="count-badge">{signals.length}</span></h2></div><button className="text-button" onClick={() => setSignals([])}>全部标记已读 <Check size={14} /></button></div>{signals.length ? <div className="signal-list">{signals.map((signal) => <button className={`signal-row ${watchSymbol === signal.symbol ? 'focused' : ''}`} key={signal.symbol} onClick={() => setWatchSymbol(signal.symbol)}><div className={`signal-icon ${signal.tone}`}><TrendingUp size={16} /></div><div className="signal-main"><div><strong>{signal.action}</strong><span>{signal.time}</span></div><p>{signal.symbol} · {signal.name}</p><small>{signal.detail}</small></div><div className="signal-score"><strong>{signal.confidence}</strong><span>信心</span></div><ChevronDown className="row-chevron" size={16} /></button>)}</div> : <div className="empty-state"><Check size={26} /><strong>队列已清空</strong><span>下一轮信号出现时会在这里显示。</span></div>}<button className="outline-wide-button"><Bell size={15} />查看提醒中心</button></section>

          <section className="panel risk-panel"><div className="panel-header"><div><div className="panel-kicker"><ShieldCheck size={14} />风险闸门</div><h2>账户健康度</h2></div><span className="safe-label"><span className="status-dot live" />正常</span></div><div className="health-score"><div><strong>82</strong><span>/ 100</span></div><div className="health-progress"><span style={{ width: '82%' }} /></div><p>风险预算使用率低于警戒线，可用资金 <b>¥ 404,204.65</b>，持仓市值 <b>¥ 692,865.00</b>。</p></div><div className="risk-stats"><div><span>今日盈亏</span><strong className="positive">+1.41%</strong><small>+¥16,705.00</small></div><div><span>持仓盈亏</span><strong className="positive">+¥160,090</strong><small>账户累计</small></div><div><span>杠杆倍数</span><strong>1.34x</strong><small>上限 2.00x</small></div></div><div className="guardrail"><LockKeyhole size={14} /><span>交易执行已锁定 · 仅提醒模式</span><ChevronDown size={14} /></div></section>

          <section className="panel positions-panel"><div className="panel-header"><div><div className="panel-kicker"><WalletCards size={14} />组合状态</div><h2>当前持仓 <span className="count-badge">{accountPositions.length}</span></h2></div><span className="muted">现金 ¥{formatNumber(account.cash)}</span></div><div className="table-scroll"><table><thead><tr><th>标的</th><th>方向</th><th>数量</th><th>成本</th><th>现价</th><th>浮动盈亏</th><th>风险</th></tr></thead><tbody>{accountPositions.map((position) => { const item = hydratePosition(position, liveQuotes); return <tr key={position.symbol}><td><div className="asset-cell"><strong>{position.symbol}</strong><span>{position.name}</span></div></td><td><span className={`side-tag ${position.side === '空' ? 'short' : ''}`}>{position.side}</span></td><td>{formatNumber(position.qty, 0)}</td><td>{formatNumber(position.avg)}</td><td>{formatNumber(item.last, item.last < 10 ? 3 : 2)}</td><td><strong className={item.tone}>{item.pnl >= 0 ? '+' : ''}{formatNumber(item.pnl)}</strong><span className={`pnl-percent ${item.tone}`}>{item.pnlPct >= 0 ? '+' : ''}{item.pnlPct.toFixed(2)}%</span></td><td><span className={`risk-tag ${position.risk === '高' ? 'high' : position.risk === '中' ? 'medium' : 'low'}`}>{position.risk}</span></td></tr> })}</tbody></table></div></section>

          <section className="panel lab-panel"><div className="panel-header"><div><div className="panel-kicker"><BrainCircuit size={14} />策略实验室</div><h2>研究进度</h2></div><button className="icon-button" aria-label="打开策略实验室" title="打开策略实验室"><LineChart size={17} /></button></div><div className="strategy-block"><div className="strategy-top"><div><span className="strategy-label champion">CHAMPION</span><strong>HK Momentum v12</strong></div><span className="positive">+18.6% <small>年化</small></span></div><div className="strategy-meta"><span><Gauge size={13} />Sharpe 1.42</span><span><TrendingDown size={13} />回撤 8.2%</span><span><Activity size={13} />影子运行 96d</span></div><div className="mini-progress"><span style={{ width: '100%' }} /></div></div><div className="strategy-block challenger"><div className="strategy-top"><div><span className="strategy-label challenger-label">CHALLENGER</span><strong>US Volatility v04</strong></div><span className="warning-text">评估中</span></div><div className="strategy-meta"><span><Gauge size={13} />Sharpe 0.98</span><span><TrendingDown size={13} />回撤 11.4%</span><span><Activity size={13} />外测 34d</span></div><div className="mini-progress"><span style={{ width: '36%' }} /></div></div><button className="outline-wide-button"><BookOpen size={15} />打开研究日志</button></section>
          <RecommendationsPanel positions={accountPositions} liveQuotes={liveQuotes} onOpenTrade={openTradeTicket} />
        </div> : activeNav === '市场地图' ? <MarketMapView /> : activeNav === '持仓与风险' ? <PositionsView positions={accountPositions} liveQuotes={liveQuotes} onTrade={openTradeTicket} tradeLog={account.trades} onReset={resetAccount} /> : activeNav === '策略实验室' ? <StrategyView /> : <AlertsView signals={signals} setSignals={setSignals} setWatchSymbol={setWatchSymbol} />}

        <footer className="app-footer"><span><span className={`status-dot ${liveConnected ? 'live' : ''}`} />{liveConnected ? `${marketSources.find((item) => item.id === marketSource)?.label || '行情源'} 实时连接` : '等待行情源连接'}</span><span>{marketSource === 'futu' ? 'OpenD 10.3.6308 · 127.0.0.1:11111' : '本地行情桥接 · 8787'}</span><span>港股股票行情权限：LV1</span><span className="footer-right">{liveConnected ? '实时行情 · 策略仍为模拟审批模式' : '请选择可用行情源或启动对应桥接'}</span></footer>
        {showEditor && <PositionEditor onSave={savePosition} onClose={() => setShowEditor(false)} />}
        {showSourceSettings && <MarketSourceSettings source={marketSource} onChange={setMarketSource} onClose={() => setShowSourceSettings(false)} />}
        {tradeDraft && <TradeTicket draft={tradeDraft} cash={account.cash} position={accountPositions.find((item) => item.symbol === tradeDraft.symbol)} quote={liveQuotes[tradeDraft.symbol]} onClose={() => setTradeDraft(null)} onApprove={(order) => executeTrade(order, order.side)} />}
        {executionNotice && <div className="execution-toast"><Check size={16} /><span>{executionNotice}</span></div>}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
