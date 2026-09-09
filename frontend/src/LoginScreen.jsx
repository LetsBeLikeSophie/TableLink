import { useState } from 'react'
import { login } from './api'

const DEMO_ACCOUNTS = [
  { username: 'kr_user', password: 'tablelink1234', label: 'KR — 한국어 데이터셋' },
  { username: 'us_user', password: 'tablelink1234', label: 'US — 영어 데이터셋' },
]

function LoginScreen({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

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
