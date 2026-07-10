# 🪙 Tap-to-Earn Rewards Platform

A production-ready gamified rewards platform where users earn coins by tapping, manage energy, climb leaderboards, refer friends, and request withdrawals.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Vite |
| Backend | Node.js + Express.js |
| Database | MongoDB Atlas |
| Auth | JWT (Access + Refresh Tokens) |
| State | Zustand + React Query |
| Animation | Framer Motion |

## Project Structure

```
tap-to-earn/
├── client/     # React.js Frontend
└── server/     # Node.js + Express Backend
```

## Quick Start

### Backend
```bash
cd server
npm install
cp .env.example .env   # Fill in your MongoDB URI and JWT secrets
npm run dev
```

### Frontend
```bash
cd client
npm install
cp .env.example .env   # Set VITE_API_BASE_URL
npm run dev
```

## Features

- 🔐 JWT Authentication (Register / Login)
- 👆 Tap-to-Earn with Energy System
- 🪙 Coin Wallet & Balance
- 🏆 Real-time Leaderboard
- 👥 Referral System with Bonuses
- 📅 7-Day Streak Daily Rewards
- 💸 Withdrawal Requests
- 📜 Transaction History
- ⚙️ Admin Panel (User Management, Withdrawal Approval)
