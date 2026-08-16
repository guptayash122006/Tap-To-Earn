import React, { useState } from 'react'
import { User, Mail, ShieldAlert, Key, LogOut } from 'lucide-react'
import useAuthStore from '../store/authStore.js'
import authApi from '../api/authApi.js'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'

const Profile = () => {
  const { user, logout } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) {
      toast.error('All password fields are required.')
      return
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const response = await authApi.changePassword(currentPassword, newPassword)
      toast.success(response.data.message || 'Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      // Store will clear and force relogin
      logout()
    } catch (err) {
      console.error('[Profile] Password change error:', err)
      toast.error(err.response?.data?.message || 'Failed to change password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile-page-container fade-in">
      <div className="page-header-row">
        <h2>My Profile</h2>
        <p className="subtitle">Manage your account information and security</p>
      </div>

      <div className="profile-grid">
        {/* Info Card */}
        <div className="card glass-card info-card">
          <div className="card-header">
            <h3>Account Details</h3>
          </div>
          <div className="card-body">
            <div className="info-row">
              <div className="info-icon-wrapper">
                <User />
              </div>
              <div className="info-text">
                <span className="info-label">Username</span>
                <span className="info-value">{user?.username}</span>
              </div>
            </div>

            <div className="info-row">
              <div className="info-icon-wrapper">
                <Mail />
              </div>
              <div className="info-text">
                <span className="info-label">Email Address</span>
                <span className="info-value">{user?.email}</span>
              </div>
            </div>

            <div className="info-row">
              <div className="info-icon-wrapper">
                <ShieldAlert />
              </div>
              <div className="info-text">
                <span className="info-label">Account Status</span>
                <span className="info-value status-pill active">{user?.status}</span>
              </div>
            </div>

            {user?.referralCode && (
              <div className="info-row">
                <div className="info-icon-wrapper">
                  <Key />
                </div>
                <div className="info-text">
                  <span className="info-label">My Referral Code</span>
                  <span className="info-value">{user.referralCode}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Password Card */}
        <div className="card glass-card security-card">
          <div className="card-header">
            <h3>Change Password</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handlePasswordChange} className="profile-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <LoadingSpinner size="sm" /> : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
