import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, User, Zap, Gift } from 'lucide-react'
import useAuthStore from '../../store/authStore.js'
import ROUTES from '../../router/routes.js'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx'

const Register = () => {
  const navigate = useNavigate()
  const { register } = useAuthStore()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!username || !email || !password) {
      toast.error('Please fill in all required fields.')
      return
    }

    if (username.length < 3 || username.length > 20) {
      toast.error('Username must be between 3 and 20 characters.')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const result = await register(username, email, password, referralCode.trim())
    setLoading(false)

    if (result.success) {
      toast.success('Registration successful! Welcome aboard!')
      navigate(ROUTES.DASHBOARD)
    } else {
      toast.error(result.error || 'Registration failed.')
    }
  }

  return (
    <div className="auth-page-container">
      {/* Background Orbs */}
      <div className="bg-orb bg-orb-1" style={{ opacity: 0.15 }}></div>
      <div className="bg-orb bg-orb-3" style={{ opacity: 0.1 }}></div>

      <div className="auth-box glass-card border-gold">
        <div className="auth-logo">
          <Zap className="logo-icon animate-pulse" />
          <h1 className="auth-title">TapEarn</h1>
        </div>

        <p className="auth-subtitle">Create an account to start earning</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-with-icon">
              <User className="input-icon" />
              <input
                type="text"
                id="username"
                placeholder="choose_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <Mail className="input-icon" />
              <input
                type="email"
                id="email"
                placeholder="name@example.com"
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
                placeholder="Min 8 chars (A-Z, a-z, 0-9, special)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="referralCode">Referral Code (Optional)</label>
            <div className="input-with-icon">
              <Gift className="input-icon" />
              <input
                type="text"
                id="referralCode"
                placeholder="ABCDEF12"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
            </div>
            <span className="input-helper">Get 20 welcome coins by using a referral code</span>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? <LoadingSpinner size="sm" /> : 'Register'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link to={ROUTES.LOGIN} className="auth-toggle-link">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Register
