import { useState } from 'react'
import { login } from './api'
import Modal from './Modal'

const DEMO_ACCOUNTS = [
  { username: 'kr_user', password: 'tablelink1234', label: 'KR — 한국어 데이터셋' },
  { username: 'us_user', password: 'tablelink1234', label: 'US — 영어 데이터셋' },
  { username: 'admin', password: 'tablelink1234', label: 'ALL — 국가 제한 없음' },
]

function LoginScreen({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showIntro, setShowIntro] = useState(true)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      onLoggedIn()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      {showIntro && (
        <Modal title="TableLink" onClose={() => setShowIntro(false)}>
          <p>
            여러 테이블을 자동으로 탐지하고 조인 경로를 스스로 찾아, 조건만으로 고객 세그먼트를
            뽑아내는 도구입니다. 실무에서 반정규화 테이블·데이터마트를 다루며 마주쳤던 문제에서
            착안했습니다.
          </p>
          <p className="muted">
            아래 계정 중 하나로 로그인해서 둘러보세요. 로그인 후 "조건 선택" 화면에서 필드
            목록을 클릭하거나, 미리보기 표의 컬럼 이름을 눌러서 조건을 담아보시면 돼요.
          </p>
        </Modal>
      )}
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>TableLink</h1>
        <p className="muted">국가별로 다른 데이터가 보이는 로그인 데모입니다.</p>

        <div className="demo-accounts">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              type="button"
              key={acc.username}
              className="demo-account-row"
              onClick={() => {
                setUsername(acc.username)
                setPassword(acc.password)
              }}
            >
              <span className="mono">{acc.username} / {acc.password}</span>
              <span className="muted">{acc.label}</span>
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="error-banner">{error}</div>}
        <button type="submit" disabled={loading || !username || !password}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}

export default LoginScreen
