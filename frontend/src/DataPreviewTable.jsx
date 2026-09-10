function formatCell(value) {
  if (value === null || value === undefined) {
    return <span className="muted">NULL</span>
  }
  return String(value)
}

function DataPreviewTable({ columns, rows, onColumnClick, selectedColumns, clickableColumns, openColumn, highlight }) {
  if (!columns || columns.length === 0) {
    return <div className="empty-box">컬럼 정보가 없습니다.</div>
  }

  return (
    <div className="data-preview-wrapper">
      <table className="data-preview-table">
        <thead>
          <tr>
            {columns.map((c) => {
              const clickable = clickableColumns?.has(c)
              const selected = selectedColumns?.has(c)
              const open = openColumn === c
              return (
                <th key={c} className={open ? 'data-preview-th-open' : ''}>
                  {clickable ? (
                    <button
                      type="button"
                      className={`data-preview-th-button ${selected ? 'selected' : ''} ${highlight ? 'onboarding-glow' : ''}`}
                      title="클릭해서 필터 조건 설정"
                      onClick={(e) => onColumnClick(c, e.currentTarget.getBoundingClientRect(), e.currentTarget)}
                    >
                      <span className="data-preview-filter-icon">▾</span>
                      {c}
                    </button>
                  ) : (
                    c
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="data-preview-empty">
                데이터 없음
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c}>{formatCell(row[c])}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataPreviewTable
