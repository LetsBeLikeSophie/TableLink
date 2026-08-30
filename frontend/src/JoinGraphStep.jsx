import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, ReactFlowProvider, useReactFlow, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { buildJoinChain } from './api'
import { isConnectable, joinTypeOf } from './joinCandidates'

const JOIN_TYPE_LABEL = {
  STATE_STATE: 'STATE-STATE',
  STATE_HISTORY: 'STATE-HISTORY',
  HISTORY_HISTORY: 'HISTORY-HISTORY',
}

function nodeLabel(t) {
  return `${t.tableName}\n${t.type}${t.historySubType ? ' · ' + t.historySubType : ''}`
}

function JoinGraphStep({ tables, initialTables, onPreviewChange }) {
  if (!tables || tables.length === 0) {
    return (
      <div className="panel">
        <h2>관계도 &amp; 조인</h2>
        <div className="empty-box tall">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2>관계도 &amp; 조인</h2>
      <p className="hint">
        왼쪽 목록에서 테이블을 캔버스로 드래그하면, 이미 놓인 테이블 중 연결 가능한 것에 자동으로 이어집니다.
        캔버스의 노드를 클릭해서 선택한 뒤 Delete/Backspace로 제거할 수 있어요.
      </p>
      <ReactFlowProvider>
        <JoinBuilder tables={tables} initialTables={initialTables} onPreviewChange={onPreviewChange} />
      </ReactFlowProvider>
    </div>
  )
}

function JoinBuilder({ tables, initialTables, onPreviewChange }) {
  const { screenToFlowPosition } = useReactFlow()

  const [placedTables, setPlacedTables] = useState([])
  const [nodePositions, setNodePositions] = useState({})
  const [edges, setEdges] = useState([]) // [{fromTable, toTable, latestOnly}], toTable is unique
  const [connectingFrom, setConnectingFrom] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)

  const tableByName = useMemo(() => {
    const map = {}
    tables.forEach((t) => {
      map[t.tableName] = t
    })
    return map
  }, [tables])

  const connectedSet = useMemo(() => new Set(edges.map((e) => e.toTable)), [edges])

  const addEdge = useCallback(
    (fromTable, toTable) => {
      setEdges((prev) => {
        if (prev.some((e) => e.toTable === toTable)) return prev
        const type = joinTypeOf(tableByName[fromTable], tableByName[toTable])
        return [...prev, { fromTable, toTable, latestOnly: type === 'STATE_HISTORY' }]
      })
    },
    [tableByName],
  )

  const placeTable = useCallback((tableName, position) => {
    setPlacedTables((prev) => (prev.includes(tableName) ? prev : [...prev, tableName]))
    setNodePositions((prev) => ({ ...prev, [tableName]: position }))
  }, [])

  // Auto-place tables handed in from the field/condition step (once per new table).
  useEffect(() => {
    if (!initialTables || initialTables.length === 0) return
    initialTables.forEach((tableName, i) => {
      if (!tableByName[tableName]) return
      setPlacedTables((prev) => (prev.includes(tableName) ? prev : [...prev, tableName]))
      setNodePositions((prev) =>
        prev[tableName] ? prev : { ...prev, [tableName]: { x: (i % 4) * 220, y: Math.floor(i / 4) * 160 } },
      )
    })
  }, [initialTables, tableByName])

  // Reconciliation pass: whenever the placed/connected set changes, try to
  // connect any still-unconnected table to whatever is now reachable. This
  // catches cases a single "connect the new node" pass would miss — e.g.
  // customer and service_history are both placed but only linkable via
  // vehicle; once vehicle connects to one of them, this re-check lets the
  // other attach too, instead of only ever checking the table just dropped.
  useEffect(() => {
    const root = placedTables[0]
    if (!root) return
    const reachable = new Set([root, ...edges.map((e) => e.toTable)])
    for (const t of placedTables) {
      if (reachable.has(t)) continue
      const parent = placedTables.find((p) => reachable.has(p) && isConnectable(tableByName[p], tableByName[t]))
      if (parent) {
        addEdge(parent, t)
        break
      }
    }
  }, [placedTables, edges, tableByName, addEdge])

  const removeTable = useCallback((tableName) => {
    setPlacedTables((prev) => prev.filter((t) => t !== tableName))
    setEdges((prev) => prev.filter((e) => e.fromTable !== tableName && e.toTable !== tableName))
    setNodePositions((prev) => {
      const next = { ...prev }
      delete next[tableName]
      return next
    })
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      const tableName = event.dataTransfer.getData('application/tablelink-table')
      if (!tableName) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      placeTable(tableName, position)
    },
    [placeTable, screenToFlowPosition],
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === 'remove') {
          removeTable(change.id)
        } else if (change.type === 'position' && change.position) {
          setNodePositions((prev) => ({ ...prev, [change.id]: change.position }))
        }
      })
    },
    [removeTable],
  )

  const onConnectStart = useCallback((_, { nodeId }) => setConnectingFrom(nodeId), [])
  const onConnectEnd = useCallback(() => setConnectingFrom(null), [])

  const onConnect = useCallback(
    (connection) => {
      const from = tableByName[connection.source]
      const to = tableByName[connection.target]
      if (!from || !to || !isConnectable(from, to)) return
      addEdge(connection.source, connection.target)
    },
    [tableByName, addEdge],
  )

  const toggleLatestOnly = (toTable) => {
    setEdges((prev) => prev.map((e) => (e.toTable === toTable ? { ...e, latestOnly: !e.latestOnly } : e)))
  }

  const validTargetIds = useMemo(() => {
    if (!connectingFrom || !tableByName[connectingFrom]) return null
    const from = tableByName[connectingFrom]
    return new Set(
      placedTables.filter(
        (t) => t !== connectingFrom && !connectedSet.has(t) && isConnectable(from, tableByName[t]),
      ),
    )
  }, [connectingFrom, placedTables, tableByName, connectedSet])

  useEffect(() => {
    if (edges.length === 0) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    const timer = setTimeout(() => {
      setPreviewLoading(true)
      setPreviewError(null)
      buildJoinChain(edges.map((e) => ({ fromTable: e.fromTable, toTable: e.toTable, latestOnly: e.latestOnly })))
        .then((res) => setPreview(res))
        .catch((e) => {
          setPreviewError(e.message)
          setPreview(null)
        })
        .finally(() => setPreviewLoading(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [edges])

  useEffect(() => {
    if (!onPreviewChange) return
    onPreviewChange({ title: '조인 결과', loading: previewLoading, error: previewError, sql: preview?.sql ?? null, columns: preview?.previewColumns ?? null, rows: preview?.previewRows ?? null })
  }, [preview, previewLoading, previewError, onPreviewChange])

  const nodes = useMemo(
    () =>
      placedTables.map((t) => {
        const table = tableByName[t]
        const isRoot = t === placedTables[0]
        const connected = isRoot || connectedSet.has(t)
        let className = `join-node ${table.type === 'STATE' ? 'join-node-state' : 'join-node-history'}`
        if (!connected) className += ' join-node-unconnected'
        if (validTargetIds) {
          if (t === connectingFrom) {
            // leave as-is
          } else if (validTargetIds.has(t)) {
            className += ' join-node-valid-target'
          } else {
            className += ' join-node-dimmed'
          }
        }
        return {
          id: t,
          position: nodePositions[t] || { x: 40, y: 40 },
          data: { label: nodeLabel(table) },
          className,
        }
      }),
    [placedTables, tableByName, nodePositions, connectedSet, validTargetIds, connectingFrom],
  )

  const unconnectedCount = useMemo(
    () => placedTables.filter((t, i) => i > 0 && !connectedSet.has(t)).length,
    [placedTables, connectedSet],
  )

  const hasEdgeBetween = useCallback(
    (a, b) => edges.some((e) => (e.fromTable === a && e.toTable === b) || (e.fromTable === b && e.toTable === a)),
    [edges],
  )

  const suggestedEdges = useMemo(() => {
    const result = []
    for (let i = 0; i < placedTables.length; i++) {
      for (let j = i + 1; j < placedTables.length; j++) {
        const a = placedTables[i]
        const b = placedTables[j]
        if (hasEdgeBetween(a, b)) continue
        if (isConnectable(tableByName[a], tableByName[b])) {
          result.push({
            id: `suggested-${a}-${b}`,
            source: a,
            target: b,
            type: 'straight',
            selectable: false,
            style: { stroke: 'var(--border)', strokeDasharray: '4 4' },
          })
        }
      }
    }
    return result
  }, [placedTables, hasEdgeBetween, tableByName])

  const chainReactFlowEdges = useMemo(
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
      {unconnectedCount > 0 && (
        <div className="warning-banner">
          연결되지 않은 테이블이 {unconnectedCount}개 있어요. 직접 이어지는 키가 없는 것 같아요 — 중간 테이블을
          하나 더 드래그해서 이어주세요.
        </div>
      )}

      <div className="join-builder">
        <div className="join-source-panel">
          <h3>테이블</h3>
          <ul className="table-list">
            {tables.map((t) => {
              const placed = placedTables.includes(t.tableName)
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

        <div className="join-canvas" onDrop={onDrop} onDragOver={onDragOver}>
          {placedTables.length === 0 && <div className="join-canvas-hint">여기로 테이블을 드래그하세요</div>}
          <ReactFlow
            nodes={nodes}
            edges={[...suggestedEdges, ...chainReactFlowEdges]}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="join-preview-panel">
          <h3>조인 체인</h3>
          {edges.length === 0 && <div className="empty-box">테이블을 캔버스에 놓아 연결하세요.</div>}
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
                      <input type="checkbox" checked={e.latestOnly} onChange={() => toggleLatestOnly(e.toTable)} />
                      최신값만
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </>
  )
}

export default JoinGraphStep
