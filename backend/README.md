# Artifex Backend API

A robust Node.js TypeScript backend API server for the Artifex application, built with Express.js, MongoDB, and comprehensive middleware for security, validation, and error handling.

## 🚀 Features

- **TypeScript**: Full TypeScript support with strict type checking
- **Express.js**: Fast, unopinionated web framework for Node.js
- **MongoDB**: Document database with Mongoose ODM
- **Security**: Helmet.js for security headers, CORS configuration, rate limiting
- **Validation**: Zod-based request validation with TypeScript integration
- **Error Handling**: Comprehensive error handling with custom error classes
- **Logging**: Structured logging with development and production modes
- **Health Checks**: Built-in health monitoring endpoints
- **Environment Configuration**: Type-safe environment variable validation

## 📋 Prerequisites

Before running this project, make sure you have the following installed:

- Node.js (>=18.0.0)
- npm (>=8.0.0) or yarn
- MongoDB (local installation or MongoDB Atlas)

## 🛠️ Installation

1. **Clone the repository and navigate to the backend directory:**
   ```bash
   cd d:/artifex/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/artifex
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start MongoDB:**
   - **Local MongoDB:** Make sure MongoDB service is running
   - **MongoDB Atlas:** Use your Atlas connection string in `MONGODB_URI`

## 🚦 Running the Application

### Development Mode
```bash
npm run dev
```
Uses nodemon with ts-node for hot reloading during development.

### Production Build
```bash
npm run build
npm start
```

The build process includes:
1. TypeScript compilation (`tsc`)
2. Path alias resolution (`tsc-alias`) - converts TypeScript path aliases to relative imports in the compiled JavaScript

### Development with ts-node
```bash
npm run start:dev
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts      # MongoDB connection setup
│   │   └── env.ts           # Environment variable validation
│   ├── middleware/
│   │   ├── errorHandler.ts  # Global error handling
│   │   └── validation.ts    # Request validation middleware
│   ├── routes/
│   │   ├── index.ts         # Main router
│   │   └── health.ts        # Health check endpoints
│   ├── types/
│   │   └── index.ts         # TypeScript type definitions
│   ├── utils/
│   │   ├── asyncHandler.ts  # Async error handling utility
│   │   └── logger.ts        # Structured logging utility
│   ├── app.ts               # Express app configuration
│   └── server.ts            # Server entry point
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## 🔧 Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `5000` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `MONGODB_URI` | MongoDB connection string | - | Yes |
| `CORS_ORIGIN` | Frontend URL for CORS | `http://localhost:3000` | No |
| `CLERK_SECRET_KEY` | Clerk authentication secret key | - | **Yes** |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | - | **Yes** |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret | - | No |
| `JWT_SECRET` | JWT signing secret | - | Optional |
| `GOOGLE_API_KEY` | Google APIs key | - | Future use |
| `STRIPE_SECRET_KEY` | Stripe payment key | - | Future use |

## 🌐 API Endpoints

### Health Check
- **GET** `/api/v1/health` - Basic health check
- **GET** `/api/v1/health/detailed` - Detailed system information
- **GET** `/api/v1/health/ping` - Simple ping endpoint

### Authentication (Clerk Integration)
- **GET** `/api/v1/auth/me` - Get current authenticated user profile
- **GET** `/api/v1/auth/validate` - Validate current session
- **GET** `/api/v1/auth/status` - Get authentication status
- **POST** `/api/v1/auth/logout` - Logout and clear session
- **GET** `/api/v1/auth/permissions` - Get user permissions and role
- **POST** `/api/v1/auth/refresh-token` - Refresh authentication token

### API Information
- **GET** `/api/v1/` - API version and endpoint information

### Future Endpoints (Planned)
- `/api/v1/users` - User management
- `/api/v1/generate` - AI generation endpoints
- `/api/v1/subscriptions` - Subscription management

## 🔒 Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing configuration
- **Rate Limiting**: Request rate limiting (100 requests per 15 minutes)
- **Input Validation**: Zod-based request validation
- **Error Handling**: Secure error responses (no sensitive data leakage in production)

## � Authentication with Clerk

### Setup Instructions

1. **Create a Clerk Application:**
   - Visit [Clerk Dashboard](https://dashboard.clerk.com/)
   - Create a new application
   - Copy your API keys from the dashboard

2. **Configure Environment Variables:**
   ```env
   CLERK_SECRET_KEY=sk_test_your-clerk-secret-key
   CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-publishable-key
   CLERK_WEBHOOK_SECRET=whsec_your-webhook-secret (optional)
   ```

3. **Authentication Flow:**
   ```
   Frontend (Next.js) -> Clerk Auth -> Backend API (Express)
                                          ↓
                                    Clerk Middleware
                                          ↓
                                   Protected Routes
   ```

### Authentication Middleware

The API uses Clerk's Express middleware for authentication:

```typescript
// All requests to /api/v1/auth/* require authentication
app.use('/api/v1/auth', clerkAuth, authRouter);

// Middleware validates JWT tokens automatically
// Provides req.auth.userId for authenticated requests
```

### Protected Endpoints

All `/api/v1/auth/*` endpoints require valid Clerk authentication:

- Users must be signed in through Clerk
- JWT tokens are validated on each request  
- User information is accessible via `req.auth.userId`
- Role-based access control available via custom claims

### User Roles and Permissions

The system supports role-based access control:

```typescript
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin', 
  MODERATOR = 'moderator'
}

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}
```

Roles can be managed through:
- Clerk Dashboard (manual assignment)
- Custom API endpoints (programmatic assignment)
- Webhook integrations (automated workflows)

## �📊 Logging

The application uses structured logging with different levels:

- **ERROR**: Application errors and exceptions
- **WARN**: Warning messages
- **INFO**: General information and request logs
- **DEBUG**: Detailed debugging information

### Log Format
- **Development**: Pretty-formatted console output with colors
- **Production**: JSON-formatted logs for log aggregation services

## 🧪 Testing

Currently, no tests are implemented. To add testing:

```bash
# Install testing dependencies
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest

# Add test script to package.json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage"
```

## 📦 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run start:dev` | Start development server with ts-node |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run clean` | Remove dist directory |

## 🔄 Frontend Integration

This backend is designed to work with the Next.js frontend located at `d:/artifex/frontend/` with **Clerk Authentication Integration**.

### Authentication Setup
The frontend uses `@clerk/nextjs` with the backend's Clerk configuration:

1. **Frontend Environment Variables:**
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-publishable-key
   NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
   ```

2. **ClerkProvider Configuration:**
   - Wraps the entire Next.js application in `layout.tsx`
   - Provides authentication context to all components
   - Handles sign-in/sign-up flows automatically

3. **Protected Routes:**
   - Frontend middleware protects routes like `/dashboard`, `/profile`
   - API routes under `/api/chat` require authentication
   - Automatic redirection to sign-in for unauthenticated users

### CORS Configuration
The backend is configured to accept requests from the frontend with Clerk-specific headers:
- `Authorization: Bearer <clerk-jwt-token>`
- `clerk-db-jwt` header support for Clerk database tokens

### API Integration
The frontend should make authenticated requests to:
- **Development**: `http://localhost:3001/api/v1`
- **Production**: Configure according to your deployment

### Authentication Flow Example
```typescript
// Frontend API call with Clerk token
import { auth } from '@clerk/nextjs/server';

const { getToken } = await auth();
const token = await getToken();

const response = await fetch('/api/v1/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production MongoDB URI
3. Set appropriate CORS origin
4. Configure any required API keys

### Build Process
```bash
npm run build
npm start
```

### Docker (Future Implementation)
```dockerfile
# Example Dockerfile structure
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (when testing is implemented)
5. Submit a pull request

### Code Style
- Use TypeScript strict mode
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

## 📝 Development Guidelines

### Error Handling
- Use custom error classes from `middleware/errorHandler.ts`
- Wrap async route handlers with `asyncHandler`
- Provide meaningful error messages

### Validation
- Use Zod schemas for request validation
- Validate all user inputs
- Use common validation schemas where possible

### Logging
- Use the structured logger from `utils/logger.ts`
- Log errors with appropriate context
- Use different log levels appropriately

## 🔮 Future Enhancements

- [ ] Authentication system (JWT or Clerk integration)
- [ ] User management endpoints
- [ ] AI generation API integration
- [ ] Subscription management
- [ ] Email service integration
- [ ] File upload handling
- [ ] Caching layer (Redis)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Unit and integration tests
- [ ] Docker containerization
- [ ] CI/CD pipeline

## 📄 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Common Issues

**1. MongoDB Connection Error**
```
Error: MongoNetworkError: failed to connect to server
```
- Ensure MongoDB is running
- Check MongoDB URI in `.env` file
- Verify network connectivity

**2. Port Already in Use**
```
Error: listen EADDRINUSE: address already in use :::5000
```
- Change PORT in `.env` file
- Kill process using the port: `lsof -ti:5000 | xargs kill`

**3. TypeScript Compilation Errors**
- Ensure all dependencies are installed: `npm install`
- Check TypeScript configuration in `tsconfig.json`
- Verify import paths and module resolution

**4. CORS Issues**
- Check `CORS_ORIGIN` in `.env` file
- Ensure frontend URL matches exactly
- Verify CORS middleware configuration

### Debug Mode
Enable debug logging by setting environment:
```bash
NODE_ENV=development npm run dev
```

---

For more information about the frontend integration, see the frontend README at `d:/artifex/frontend/README.md`.