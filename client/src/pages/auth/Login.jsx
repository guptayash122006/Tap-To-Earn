import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, Zap } from 'lucide-react'
import useAuthStore from '../../store/authStore.js'
import ROUTES from '../../router/routes.js'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'

const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter both email and password.')
      return
    }

    setLoading(true)
    const result = await login(email, password)
    setLoading(false)

    if (result.success) {
      toast.success('Welcome back to TapEarn!')
      navigate(ROUTES.DASHBOARD)
    } else {
      toast.error(result.error || 'Invalid credentials.')
    }
  }

  return (
    <div className="auth-page-container">
      {/* Background Orbs */}
      <div className="bg-orb bg-orb-1" style={{ opacity: 0.15 }}></div>
      <div className="bg-orb bg-orb-2" style={{ opacity: 0.1 }}></div>

      <div className="auth-box glass-card border-gold">
        <div className="auth-logo">
          <Zap className="logo-icon animate-pulse" />
          <h1 className="auth-title">TapEarn</h1>
        </div>

        <p className="auth-subtitle">Sign in to start tapping and earning rewards</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <Mail className="input-icon" />
              <input
                type="email"
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <Lock className="input-icon" />
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? <LoadingSpinner size="sm" /> : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Don't have an account?</span>
          <Link to={ROUTES.REGISTER} className="auth-toggle-link">
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login
