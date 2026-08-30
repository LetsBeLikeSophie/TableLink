function formatCell(value) {
  if (value === null || value === undefined) {
    return <span className="muted">NULL</span>
  }
  return String(value)
}

function DataPreviewTable({ columns, rows }) {
  if (!columns || columns.length === 0) {
    return <div className="empty-box">컬럼 정보가 없습니다.</div>
  }

  return (
    <div className="data-preview-wrapper">
      <table className="data-preview-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
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
