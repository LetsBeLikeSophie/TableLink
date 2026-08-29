import { useState } from 'react'
import './App.css'

const STEPS = ['테이블 확인', '관계도 & 조인', '필터 (세그먼트)', '결과']

function TableConfirmStep() {
  return (
    <div className="panel">
      <h2>테이블 확인</h2>
      <p className="hint">
        DB 스키마와 네이밍 컨벤션으로 타입/서브타입/FK가 자동 판정됩니다.
        필터에 노출할 컬럼만 필요하면 체크 해제하세요.
      </p>

      <form className="form">
        <label>
          테이블 이름
          <select disabled>
            <option>-- 백엔드 연결 후 목록 표시 --</option>
          </select>
        </label>

        <label>
          타입 <span className="muted">(자동 판정됨)</span>
          <div className="empty-box">테이블을 선택하면 STATE/HISTORY, POINT/RANGE가 표시됩니다.</div>
        </label>

        <label>
          필터 가능 컬럼 <span className="muted">(기본값: PK/FK 제외 전체, 체크 해제로 조정)</span>
          <div className="empty-box">테이블을 선택하면 컬럼 목록이 여기에 표시됩니다.</div>
        </label>

        <button type="button" disabled>확인</button>
      </form>
    </div>
  )
}

function PlaceholderStep({ title }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="empty-box tall">아직 구현되지 않음</div>
    </div>
  )
}

function App() {
  const [step, setStep] = useState(0)

  return (
    <div className="app">
      <header className="app-header">
        <h1>TableLink</h1>
        <p className="muted">테이블 조인 &amp; 세그먼트 필터 도구</p>
      </header>

      <nav className="stepper">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className={`step ${i === step ? 'active' : ''}`}
            onClick={() => setStep(i)}
          >
            <span className="step-num">{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      <main className="content">
        {step === 0 && <TableConfirmStep />}
        {step === 1 && <PlaceholderStep title="관계도 & 조인" />}
        {step === 2 && <PlaceholderStep title="필터 (세그먼트)" />}
        {step === 3 && <PlaceholderStep title="결과" />}
      </main>
    </div>
  )
}

export default App
