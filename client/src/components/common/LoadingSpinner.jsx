import React from 'react'

const LoadingSpinner = ({ size = 'md', color = 'gold' }) => {
  return (
    <div className={`spinner-container ${size} ${color}`}>
      <div className="spinner-ring"></div>
    </div>
  )
}

export default LoadingSpinner
