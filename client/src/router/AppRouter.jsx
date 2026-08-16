import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ROUTES from './routes.js'
import ProtectedRoute from '../components/common/ProtectedRoute.jsx'
import AdminRoute from '../components/common/AdminRoute.jsx'

// Public Auth Pages
import Login from '../pages/auth/Login.jsx'
import Register from '../pages/auth/Register.jsx'

// Protected Game Pages
import Dashboard from '../pages/Dashboard.jsx'
import TapPage from '../pages/TapPage.jsx'
import Referral from '../pages/Referral.jsx'
import DailyRewards from '../pages/DailyRewards.jsx'
import Withdrawal from '../pages/Withdrawal.jsx'
import Leaderboard from '../pages/Leaderboard.jsx'
import Profile from '../pages/Profile.jsx'
import TransactionHistory from '../pages/TransactionHistory.jsx'
import NotFound from '../pages/NotFound.jsx'

// Protected Admin Pages
import AdminDashboard from '../pages/admin/AdminDashboard.jsx'
import AdminUsers from '../pages/admin/AdminUsers.jsx'
import AdminWithdrawals from '../pages/admin/AdminWithdrawals.jsx'
import AdminTransactions from '../pages/admin/AdminTransactions.jsx'

import useAuthStore from '../store/authStore.js'

const AppRouter = () => {
  const { isAuthenticated } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes: redirect to dashboard if authenticated */}
        <Route
          path={ROUTES.LOGIN}
          element={isAuthenticated ? <Navigate to={ROUTES.DASHBOARD} replace /> : <Login />}
        />
        <Route
          path={ROUTES.REGISTER}
          element={isAuthenticated ? <Navigate to={ROUTES.DASHBOARD} replace /> : <Register />}
        />

        {/* Private user pages */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tap"
          element={
            <ProtectedRoute>
              <TapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.REFERRAL}
          element={
            <ProtectedRoute>
              <Referral />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DAILY_REWARD}
          element={
            <ProtectedRoute>
              <DailyRewards />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.WITHDRAW}
          element={
            <ProtectedRoute>
              <Withdrawal />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.LEADERBOARD}
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROFILE}
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.HISTORY}
          element={
            <ProtectedRoute>
              <TransactionHistory />
            </ProtectedRoute>
          }
        />

        {/* Admin systems */}
        <Route
          path={ROUTES.ADMIN}
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path={`${ROUTES.ADMIN}/users`}
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
        <Route
          path={`${ROUTES.ADMIN}/withdrawals`}
          element={
            <AdminRoute>
              <AdminWithdrawals />
            </AdminRoute>
          }
        />
        <Route
          path={`${ROUTES.ADMIN}/transactions`}
          element={
            <AdminRoute>
              <AdminTransactions />
            </AdminRoute>
          }
        />

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
