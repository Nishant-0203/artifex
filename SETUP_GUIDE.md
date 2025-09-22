# Artifex Backend-Frontend Connection Setup Guide

## 🚀 Quick Start

Your Artifex application is now configured to connect the backend and frontend. Here's how to complete the setup:

## 📋 Prerequisites

1. **Node.js** (v18+)
2. **npm** or **yarn**
3. **MongoDB** database (local or MongoDB Atlas)
4. **Clerk** account for authentication
5. **Google Gemini API** key for image generation

## 🔧 Environment Configuration

### Backend Environment Variables

Edit `backend/.env` with your actual credentials:

```env
# Database Configuration - REPLACE WITH YOUR MONGODB URL
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/artifex?retryWrites=true&w=majority

# Clerk Authentication - REPLACE WITH YOUR CLERK KEYS
CLERK_SECRET_KEY=sk_test_your-actual-clerk-secret-key
CLERK_PUBLISHABLE_KEY=pk_test_your-actual-clerk-publishable-key

# Google Gemini Configuration - REPLACE WITH YOUR API KEY
GEMINI_API_KEY=your-actual-gemini-api-key
```

### Frontend Environment Variables

Edit `frontend/.env.local` with your actual credentials:

```env
# Clerk Authentication - REPLACE WITH YOUR CLERK KEYS
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-actual-clerk-publishable-key
CLERK_SECRET_KEY=sk_test_your-actual-clerk-secret-key
```

## 🏃‍♂️ Running the Application

### 1. Start Backend (Terminal 1)
```bash
cd backend
npm install
npm run dev
```
Backend will run on: `http://localhost:5000`

### 2. Start Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Frontend will run on: `http://localhost:3000` or `http://localhost:3001`

## 🔗 API Endpoints

### Backend Routes
- Health Check: `GET http://localhost:5000/health`
- Test Ping: `GET http://localhost:5000/api/v1/test/ping`
- Auth Test: `GET http://localhost:5000/api/v1/test/auth-test` (requires authentication)

### Frontend Test Pages
- Main App: `http://localhost:3000` (or 3001)
- Backend Test: `http://localhost:3000/api/test-backend`

## 🧪 Testing the Connection

1. **Backend Health Check**: Visit `http://localhost:5000/health`
2. **Frontend-Backend Connection**: Check the browser console when using the app
3. **Authentication Flow**: Sign up/sign in through the frontend

## 🔑 Required API Keys Setup

### 1. MongoDB Atlas Setup
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get your connection string
4. Replace in `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/artifex
   ```

### 2. Clerk Authentication Setup
1. Go to [Clerk](https://clerk.dev)
2. Create a new application
3. Get your API keys from the dashboard
4. Replace in both `.env` files:
   ```env
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

### 3. Google Gemini API Setup
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Replace in `backend/.env`:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

## 🔧 Configuration Details

### Port Configuration
- **Backend**: Port 5000
- **Frontend**: Port 3000 (fallback to 3001 if 3000 is busy)
- **CORS**: Backend configured to allow frontend origin

### API Client Configuration
The frontend uses a centralized API client (`src/lib/api-client.ts`) that:
- Automatically handles authentication tokens
- Points to the correct backend URL
- Provides typed methods for all API endpoints

## 🚨 Troubleshooting

### Backend Won't Start
- Check MongoDB connection string
- Verify Clerk secret key
- Ensure port 5000 is available

### Frontend Can't Connect to Backend
- Verify backend is running on port 5000
- Check CORS configuration
- Confirm API URL in frontend `.env.local`

### Authentication Issues
- Verify Clerk keys match between frontend and backend
- Check that both keys are from the same Clerk application
- Ensure CORS allows credentials

## 📁 Project Structure
```
artifex/
├── backend/               # Express.js API server
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth, CORS, etc.
│   │   └── config/       # Environment config
│   └── .env              # Backend environment variables
├── frontend/             # Next.js frontend
│   ├── src/
│   │   ├── lib/         # API client
│   │   └── components/  # UI components
│   └── .env.local       # Frontend environment variables
└── SETUP_GUIDE.md      # This file
```

## ✅ Verification Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can visit backend health endpoint
- [ ] Frontend can authenticate users
- [ ] API calls work from frontend to backend
- [ ] Image generation works (with proper API keys)

---

## 🎯 Next Steps

1. Add your actual API credentials to the environment files
2. Test the connection using the test endpoints
3. Try the image generation feature
4. Deploy to production when ready

For support, check the logs in both terminals for detailed error messages.