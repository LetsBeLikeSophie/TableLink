import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { fetchDiscoveredTables, buildJoinChain } from './api'
import { isConnectable, computeSuggestedPairs, joinTypeOf } from './joinCandidates'

const JOIN_TYPE_LABEL = {
  STATE_STATE: 'STATE-STATE',
  STATE_HISTORY: 'STATE-HISTORY',
  HISTORY_HISTORY: 'HISTORY-HISTORY',
}

function layoutNodes(tables) {
  const stateTables = tables.filter((t) => t.type === 'STATE').sort((a, b) => a.tableName.localeCompare(b.tableName))
  const historyTables = tables.filter((t) => t.type === 'HISTORY').sort((a, b) => a.tableName.localeCompare(b.tableName))
  const gapX = 200
  const nodes = []

  stateTables.forEach((t, i) => {
    nodes.push({
      id: t.tableName,
      position: { x: i * gapX, y: 0 },
      data: { label: nodeLabel(t) },
      className: 'join-node join-node-state',
    })
  })
  historyTables.forEach((t, i) => {
    nodes.push({
      id: t.tableName,
      position: { x: i * gapX, y: 220 },
      data: { label: nodeLabel(t) },
      className: 'join-node join-node-history',
    })
  })
  return nodes
}

function nodeLabel(t) {
  return `${t.tableName}\n${t.type}${t.historySubType ? ' · ' + t.historySubType : ''}`
}

function JoinGraphStep() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [chainEdges, setChainEdges] = useState([]) // [{fromTable, toTable, latestOnly}]
  const [connectingFrom, setConnectingFrom] = useState(null)
  const [result, setResult] = useState(null)
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    fetchDiscoveredTables()
      .then(setTables)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const tableByName = useMemo(() => {
    const map = {}
    tables.forEach((t) => {
      map[t.tableName] = t
    })
    return map
  }, [tables])

  const nodes = useMemo(() => layoutNodes(tables), [tables])

  const suggestedEdges = useMemo(() => {
    const pairs = computeSuggestedPairs(tables)
    return pairs.map(([a, b]) => ({
      id: `suggested-${a}-${b}`,
      source: a,
      target: b,
      type: 'straight',
      selectable: false,
      style: { stroke: 'var(--border)', strokeDasharray: '4 4' },
    }))
  }, [tables])

  const validTargetIds = useMemo(() => {
    if (!connectingFrom || !tableByName[connectingFrom]) return null
    const from = tableByName[connectingFrom]
    return new Set(
      tables
        .filter((t) => t.tableName !== connectingFrom && isConnectable(from, t))
        .map((t) => t.tableName),
    )
  }, [connectingFrom, tableByName, tables])

  const styledNodes = useMemo(() => {
    if (!validTargetIds) return nodes
    return nodes.map((n) => {
      if (n.id === connectingFrom) return n
      const highlight = validTargetIds.has(n.id)
      return {
        ...n,
        className: n.className + (highlight ? ' join-node-valid-target' : ' join-node-dimmed'),
      }
    })
  }, [nodes, validTargetIds, connectingFrom])

  const chainReactFlowEdges = useMemo(
    () =>
      chainEdges.map((e) => ({
        id: `chain-${e.fromTable}-${e.toTable}`,
        source: e.fromTable,
        target: e.toTable,
        label: JOIN_TYPE_LABEL[joinTypeOf(tableByName[e.fromTable], tableByName[e.toTable])],
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: 'var(--accent)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--text-h)', fontSize: 11 },
      })),
    [chainEdges, tableByName],
  )

  const onConnectStart = useCallback((_, { nodeId }) => {
    setConnectingFrom(nodeId)
  }, [])

  const onConnectEnd = useCallback(() => {
    setConnectingFrom(null)
  }, [])

  const onConnect = useCallback(
    (connection) => {
      const from = tableByName[connection.source]
      const to = tableByName[connection.target]
      if (!from || !to || !isConnectable(from, to)) return
      setChainEdges((prev) => {
        if (prev.some((e) => e.fromTable === connection.source && e.toTable === connection.target)) {
          return prev
        }
        const type = joinTypeOf(from, to)
        return [...prev, { fromTable: connection.source, toTable: connection.target, latestOnly: type === 'STATE_HISTORY' }]
      })
      setResult(null)
    },
    [tableByName],
  )

  const removeEdge = (index) => {
    setChainEdges((prev) => prev.filter((_, i) => i !== index))
    setResult(null)
  }

  const toggleLatestOnly = (index) => {
    setChainEdges((prev) => prev.map((e, i) => (i === index ? { ...e, latestOnly: !e.latestOnly } : e)))
    setResult(null)
  }

  const confirmChain = async () => {
    if (chainEdges.length === 0) return
    setBuilding(true)
    setError(null)
    try {
      const response = await buildJoinChain(
        chainEdges.map((e) => ({ fromTable: e.fromTable, toTable: e.toTable, latestOnly: e.latestOnly })),
      )
      setResult(response)
    } catch (e) {
      setError(e.message)
      setResult(null)
    } finally {
      setBuilding(false)
    }
  }

  if (loading) {
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
        점선은 FK로 연결 가능한 테이블 쌍입니다. 노드를 드래그해서 연결하면 조인 체인에 추가됩니다.
        연결 불가능한 테이블끼리는 드래그해도 붙지 않아요.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="join-layout">
        <div className="join-canvas">
          <ReactFlow
            nodes={styledNodes}
            edges={[...suggestedEdges, ...chainReactFlowEdges]}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="join-side-panel">
          <h3>조인 체인</h3>
          {chainEdges.length === 0 && <div className="empty-box">아직 연결한 테이블이 없습니다.</div>}
          <ul className="join-edge-list">
            {chainEdges.map((e, i) => {
              const type = joinTypeOf(tableByName[e.fromTable], tableByName[e.toTable])
              return (
                <li key={`${e.fromTable}-${e.toTable}`} className="join-edge-row">
                  <div className="join-edge-main">
                    <span className="mono">{e.fromTable}</span>
                    <span> → </span>
                    <span className="mono">{e.toTable}</span>
                    <span className="badge badge-type">{JOIN_TYPE_LABEL[type]}</span>
                  </div>
                  <div className="join-edge-actions">
                    {type === 'STATE_HISTORY' && (
                      <label className="latest-only-toggle">
                        <input
                          type="checkbox"
                          checked={e.latestOnly}
                          onChange={() => toggleLatestOnly(i)}
                        />
                        최신값만
                      </label>
                    )}
                    <button type="button" className="link-button" onClick={() => removeEdge(i)}>
                      제거
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <button type="button" onClick={confirmChain} disabled={building || chainEdges.length === 0}>
            {building ? '확인 중...' : '체인 확인'}
          </button>

          {result && (
            <pre className="sql-preview">{result.sql}</pre>
          )}
        </div>
      </div>
    </div>
  )
}

export default JoinGraphStep
