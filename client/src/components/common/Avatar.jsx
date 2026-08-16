import React from 'react'

const Avatar = ({ username, src, size = 'md' }) => {
  const initials = username ? username.substring(0, 2).toUpperCase() : '??'

  if (src) {
    return <img src={src} alt={username} className={`avatar avatar-${size}`} />
  }

  return (
    <div className={`avatar avatar-placeholder avatar-${size}`}>
      {initials}
    </div>
  )
}

export default Avatar
