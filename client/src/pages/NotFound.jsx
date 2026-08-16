import React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import ROUTES from '../router/routes.js'

const NotFound = () => {
  return (
    <div className="fullscreen-error fade-in">
      <div className="text-center card glass-card border-gold max-w-md p-10">
        <AlertCircle className="text-gold mx-auto mb-4" size={48} style={{ display: 'block', margin: '0 auto 16px' }} />
        <h2 className="text-2xl font-bold mb-2" style={{ margin: '0 0 8px' }}>Page Not Found</h2>
        <p className="text-secondary mb-6" style={{ margin: '0 0 24px' }}>
          The page you are trying to access does not exist or has been relocated.
        </p>
        <Link to={ROUTES.DASHBOARD} className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default NotFound
