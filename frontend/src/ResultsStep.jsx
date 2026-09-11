import { useEffect, useMemo, useState } from 'react'
import { runSegment } from './api'
import { toActiveFilters, formatConditionPhrase } from './conditionUtils'
import DataPreviewTable from './DataPreviewTable'

function ResultsStep({ chain, conditions }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const activeFilters = useMemo(() => toActiveFilters(conditions), [conditions])

  useEffect(() => {
    if (!chain?.rootTable) {
      setResult(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    runSegment(chain.rootTable, chain.edges, activeFilters)
      .then((res) => setResult(res))
      .catch((e) => {
        setError(e.message)
        setResult(null)
      })
      .finally(() => setLoading(false))
  }, [chain, activeFilters])

  return (
    <div className="panel">
      <h2>결과</h2>
      <p className="hint">
        "조건 선택" 단계에서 담은 조건과 자동으로 연결된 테이블을 기준으로 매칭된 대상을
        보여줍니다.
      </p>

      {!chain?.rootTable && <div className="empty-box tall">조건 선택 단계에서 필드를 먼저 담아주세요.</div>}
      {loading && <div className="empty-box tall">불러오는 중...</div>}
      {error && <div className="error-banner">{error}</div>}

      {result && !loading && !error && (
        <>
          <p className="segment-condition-summary">
            {activeFilters.length === 0
              ? '조건 없이 전체 대상을 보여줍니다.'
              : `${activeFilters.map(formatConditionPhrase).join(', ')} 조건을 만족하는 대상입니다.`}
          </p>
          <div className="segment-summary">
            <div className="segment-summary-stat">
              <span className="segment-summary-number">{result.matchedCount.toLocaleString()}</span>
              <span className="muted"> / {result.totalCount.toLocaleString()}명</span>
            </div>
            <div className="segment-summary-percentage">전체 대비 {result.matchedPercentage.toFixed(1)}%</div>
            <div className="muted">기준 테이블: {result.rootTable}</div>
          </div>
          <DataPreviewTable columns={result.columns} rows={result.rows} />
        </>
      )}
    </div>
  )
}

export default ResultsStep
