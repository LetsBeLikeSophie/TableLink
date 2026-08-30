import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, ReactFlowProvider, useReactFlow, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { buildJoinChain } from './api'
import { computeConnectingPlan, joinTypeOf } from './joinCandidates'
import Modal from './Modal'

const JOIN_TYPE_LABEL = {
  STATE_STATE: 'STATE-STATE',
  STATE_HISTORY: 'STATE-HISTORY',
  HISTORY_HISTORY: 'HISTORY-HISTORY',
}

function nodeLabel(t) {
  return `${t.tableName}\n${t.type}${t.historySubType ? ' · ' + t.historySubType : ''}`
}

function JoinGraphStep({ tables, initialTables, conditions, onPreviewChange, embedded = false }) {
  if (!tables || tables.length === 0) {
    return <div className="empty-box tall">불러오는 중...</div>
  }

  const body = (
    <ReactFlowProvider>
      <JoinBuilder
        tables={tables}
        initialTables={initialTables}
        conditions={conditions}
        onPreviewChange={onPreviewChange}
        embedded={embedded}
      />
    </ReactFlowProvider>
  )

  if (embedded) {
    return <div className="join-embedded">{body}</div>
  }

  return (
    <div className="panel">
      <h2>관계도 &amp; 조인</h2>
      <p className="hint">
        왼쪽 목록에서 테이블을 캔버스로 드래그하면, 연결에 필요한 중간 테이블까지 자동으로 찾아서
        이어줍니다. 캔버스의 노드를 클릭해서 선택한 뒤 Delete/Backspace로 제거할 수 있어요.
      </p>
      {body}
    </div>
  )
}

const NO_VALUE_OPERATORS = new Set(['IS_NULL', 'IS_NOT_NULL'])

function JoinBuilder({ tables, initialTables, conditions, onPreviewChange, embedded }) {
  const { screenToFlowPosition } = useReactFlow()

  const [requiredTables, setRequiredTables] = useState([])
  const [manualAddValue, setManualAddValue] = useState('')
  const [nodePositions, setNodePositions] = useState({})
  const [latestOnlyOverrides, setLatestOnlyOverrides] = useState({})
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [chainModalOpen, setChainModalOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')

  const tableByName = useMemo(() => {
    const map = {}
    tables.forEach((t) => {
      map[t.tableName] = t
    })
    return map
  }, [tables])

  // Pull in tables required by the field/condition step (additive — never removes
  // a table the user has since deleted here).
  useEffect(() => {
    if (!initialTables || initialTables.length === 0) return
    setRequiredTables((prev) => {
      const additions = initialTables.filter((t) => tableByName[t] && !prev.includes(t))
      return additions.length > 0 ? [...prev, ...additions] : prev
    })
  }, [initialTables, tableByName])

  const plan = useMemo(() => computeConnectingPlan(tables, requiredTables), [tables, requiredTables])

  const edges = useMemo(
    () =>
      plan.edges.map((e) => ({
        ...e,
        latestOnly: latestOnlyOverrides[e.toTable] ?? e.latestOnly,
      })),
    [plan.edges, latestOnlyOverrides],
  )

  // Assign a canvas position the first time a table appears in the plan.
  useEffect(() => {
    setNodePositions((prev) => {
      let changed = false
      const next = { ...prev }
      plan.tables.forEach((t, i) => {
        if (!next[t]) {
          next[t] = { x: (i % 4) * 220, y: Math.floor(i / 4) * 160 }
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [plan.tables])

  const addRequiredTable = useCallback(
    (tableName, position) => {
      setRequiredTables((prev) => (prev.includes(tableName) ? prev : [...prev, tableName]))
      if (position) {
        setNodePositions((prev) => ({ ...prev, [tableName]: position }))
      }
    },
    [],
  )

  const removeRequiredTable = useCallback((tableName) => {
    setRequiredTables((prev) => prev.filter((t) => t !== tableName))
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      const tableName = event.dataTransfer.getData('application/tablelink-table')
      if (!tableName) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addRequiredTable(tableName, position)
    },
    [addRequiredTable, screenToFlowPosition],
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === 'remove') {
          removeRequiredTable(change.id)
        } else if (change.type === 'position' && change.position) {
          setNodePositions((prev) => ({ ...prev, [change.id]: change.position }))
        }
      })
    },
    [removeRequiredTable],
  )

  const legacyCopy = (text) => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(textarea)
    return ok
  }

  const copySql = () => {
    if (!preview?.sql) return
    const showResult = (ok) => {
      setCopyStatus(ok ? '복사됨' : '복사 실패')
      setTimeout(() => setCopyStatus(''), 1500)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(preview.sql)
        .then(() => showResult(true))
        .catch(() => showResult(legacyCopy(preview.sql)))
    } else {
      showResult(legacyCopy(preview.sql))
    }
  }

  const toggleLatestOnly = (toTable, defaultValue) => {
    setLatestOnlyOverrides((prev) => ({
      ...prev,
      [toTable]: !(prev[toTable] ?? defaultValue),
    }))
  }

  const activeFilters = useMemo(
    () =>
      (conditions || [])
        .filter((c) => NO_VALUE_OPERATORS.has(c.operator) || (c.value !== undefined && c.value !== ''))
        .map((c) => ({ tableName: c.tableName, column: c.column, operator: c.operator, value: c.value })),
    [conditions],
  )

  useEffect(() => {
    if (edges.length === 0) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    const timer = setTimeout(() => {
      setPreviewLoading(true)
      setPreviewError(null)
      buildJoinChain(
        edges.map((e) => ({ fromTable: e.fromTable, toTable: e.toTable, latestOnly: e.latestOnly })),
        activeFilters,
      )
        .then((res) => setPreview(res))
        .catch((e) => {
          setPreviewError(e.message)
          setPreview(null)
        })
        .finally(() => setPreviewLoading(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [edges, activeFilters])

  useEffect(() => {
    if (!onPreviewChange) return
    onPreviewChange({
      title: '조인 결과',
      loading: previewLoading,
      error: previewError,
      columns: preview?.previewColumns ?? null,
      rows: preview?.previewRows ?? null,
    })
  }, [preview, previewLoading, previewError, onPreviewChange])

  const nodes = useMemo(
    () =>
      plan.tables.map((t) => {
        const table = tableByName[t]
        const isBridge = plan.bridgeTables.includes(t)
        let className = `join-node ${table.type === 'STATE' ? 'join-node-state' : 'join-node-history'}`
        if (isBridge) className += ' join-node-bridge'
        return {
          id: t,
          position: nodePositions[t] || { x: 40, y: 40 },
          data: { label: nodeLabel(table) },
          className,
        }
      }),
    [plan, tableByName, nodePositions],
  )

  const reactFlowEdges = useMemo(
    () =>
      edges.map((e) => ({
        id: `chain-${e.fromTable}-${e.toTable}`,
        source: e.fromTable,
        target: e.toTable,
        label: JOIN_TYPE_LABEL[joinTypeOf(tableByName[e.fromTable], tableByName[e.toTable])],
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: 'var(--accent)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--text-h)', fontSize: 11 },
      })),
    [edges, tableByName],
  )

  return (
    <>
      {plan.bridgeTables.length > 0 && (
        <div className="info-banner">
          연결을 위해 다음 테이블을 자동으로 추가했어요:{' '}
          <strong>{plan.bridgeTables.join(', ')}</strong>
        </div>
      )}
      {plan.unreachable && plan.unreachable.length > 0 && (
        <div className="warning-banner">
          {plan.unreachable.join(', ')}은(는) 다른 테이블과 연결할 수 있는 키가 없어요.
        </div>
      )}

      <div className={`join-builder ${embedded ? 'join-builder-embedded' : ''}`}>
        {!embedded && (
          <div className="join-source-panel">
            <h3>테이블</h3>
            <ul className="table-list">
              {tables.map((t) => {
                const placed = plan.tables.includes(t.tableName)
                return (
                  <li key={t.tableName}>
                    <div
                      className={`table-list-item join-source-item ${placed ? 'placed' : ''}`}
                      draggable={!placed}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/tablelink-table', t.tableName)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                    >
                      <span>{t.tableName}</span>
                      <span className={`badge ${t.type === 'STATE' ? 'badge-type' : 'badge-subtype'}`}>{t.type}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="join-canvas-column">
          {embedded && (
            <div className="join-manual-add">
              <select value={manualAddValue} onChange={(e) => setManualAddValue(e.target.value)}>
                <option value="">+ 테이블 직접 추가</option>
                {tables
                  .filter((t) => !plan.tables.includes(t.tableName))
                  .map((t) => (
                    <option key={t.tableName} value={t.tableName}>
                      {t.tableName}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!manualAddValue}
                onClick={() => {
                  if (manualAddValue) {
                    addRequiredTable(manualAddValue)
                    setManualAddValue('')
                  }
                }}
              >
                추가
              </button>
            </div>
          )}
          <div
            className={`join-canvas ${embedded ? 'join-canvas-compact' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            {plan.tables.length === 0 && (
              <div className="join-canvas-hint">
                {embedded ? '조건을 담으면 여기 자동으로 표시됩니다' : '여기로 테이블을 드래그하세요'}
              </div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={reactFlowEdges}
              onNodesChange={onNodesChange}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </div>

      </div>

      <button
        type="button"
        className="link-button chain-modal-trigger"
        disabled={edges.length === 0}
        onClick={() => setChainModalOpen(true)}
      >
        조인 체인 &amp; SQL 보기 ({edges.length})
      </button>

      {chainModalOpen && (
        <Modal title="조인 체인 & SQL" onClose={() => setChainModalOpen(false)}>
          <ul className="join-edge-list">
            {edges.map((e) => {
              const type = joinTypeOf(tableByName[e.fromTable], tableByName[e.toTable])
              return (
                <li key={e.toTable} className="join-edge-row">
                  <div className="join-edge-main">
                    <span className="mono">{e.fromTable}</span>
                    <span> → </span>
                    <span className="mono">{e.toTable}</span>
                    <span className="badge badge-type">{JOIN_TYPE_LABEL[type]}</span>
                  </div>
                  {type === 'STATE_HISTORY' && (
                    <label className="latest-only-toggle">
                      <input
                        type="checkbox"
                        checked={e.latestOnly}
                        onChange={() => toggleLatestOnly(e.toTable, e.latestOnly)}
                      />
                      최신값만
                    </label>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="modal-sql-header">
            <h4>SQL</h4>
            <button type="button" onClick={copySql}>
              {copyStatus || '복사'}
            </button>
          </div>
          <pre className="sql-preview">{preview?.sql || '(불러오는 중...)'}</pre>
        </Modal>
      )}
    </>
  )
}

export default JoinGraphStep
