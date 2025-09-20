# Artifex Backend API Documentation

A comprehensive REST API for AI-powered image generation with authentication, subscription management, and advanced image processing capabilities.

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Health & System](#health--system)
  - [Authentication](#authentication-endpoints)
  - [Image Generation](#image-generation)
- [Error Handling](#error-handling)
- [Rate Limiting & Subscriptions](#rate-limiting--subscriptions)
- [Environment Setup](#environment-setup)

## Overview

The Artifex Backend API provides:
- **AI-Powered Image Generation**: Text-to-image, image-to-image, multi-image composition, and image refinement
- **Clerk Authentication**: Secure user authentication and session management
- **Subscription Management**: Tiered access with usage quotas
- **File Processing**: Advanced image processing with Sharp and Multer
- **MongoDB Integration**: Persistent storage for user data and generation history

**Base URL**: `http://localhost:3001/api`

## Authentication

All protected endpoints require Clerk authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <clerk_jwt_token>
```

The API uses Clerk for user authentication and session management. Ensure you have a valid Clerk session token for protected routes.

## API Endpoints

### Health & System

#### GET `/health`
Check API health and system status.

**Response:**
```json
{
  "status": "success",
  "message": "Server is healthy",
  "data": {
    "uptime": 3600.123,
    "timestamp": "2024-01-01T12:00:00.000Z",
    "memory": {
      "used": "45.2 MB",
      "total": "128 MB",
      "percentage": 35.3
    },
    "database": {
      "status": "connected",
      "responseTime": "2ms"
    },
    "services": {
      "gemini": "operational",
      "clerk": "operational"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Authentication Endpoints

#### GET `/auth/me`
Get authenticated user profile information.

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "User profile retrieved successfully",
  "data": {
    "user": {
      "id": "user_123456",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "profileImage": "https://...",
      "createdAt": "2024-01-01T12:00:00.000Z"
    },
    "session": {
      "sessionId": "sess_123456",
      "isActive": true,
      "emailVerified": true
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/auth/validate`
Validate current user session.

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Session is valid",
  "data": {
    "valid": true,
    "userId": "user_123456",
    "sessionId": "sess_123456",
    "emailVerified": true,
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/auth/status`
Get user authentication status (no authentication required).

**Authentication:** Optional

**Response:**
```json
{
  "status": "success",
  "message": "User is authenticated",
  "data": {
    "authenticated": true,
    "user": {
      "userId": "user_123456",
      "sessionId": "sess_123456",
      "emailVerified": true
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### POST `/auth/logout`
Process user logout request.

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Logout request processed",
  "data": {
    "userId": "user_123456",
    "logoutTime": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/auth/permissions`
Get user permissions and subscription information.

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "User permissions retrieved successfully",
  "data": {
    "userId": "user_123456",
    "role": "user",
    "subscription": {
      "tier": "free",
      "hasPremiumAccess": false,
      "rateLimit": {
        "requests": 10,
        "window": "1h"
      }
    },
    "permissions": {
      "isAdmin": false,
      "canAccessPremiumFeatures": false
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### POST `/auth/refresh-token`
Refresh user authentication token.

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Token refreshed successfully",
  "data": {
    "tokenAvailable": true,
    "expiresIn": "1h"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Image Generation

All image generation endpoints require authentication and are subject to subscription-based rate limiting.

#### POST `/generate/text-to-image`
Generate an image from a text prompt using AI.

**Authentication:** Required  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "prompt": "A beautiful sunset over mountains",
  "style": "realistic",
  "quality": "high",
  "dimensions": {
    "width": 1024,
    "height": 1024
  },
  "negativePrompt": "blurry, low quality",
  "seed": 12345
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Image generated successfully",
  "data": {
    "generationId": "gen_123456",
    "imageUrl": "https://...",
    "metadata": {
      "prompt": "A beautiful sunset over mountains",
      "style": "realistic",
      "dimensions": {
        "width": 1024,
        "height": 1024
      },
      "processingTime": "3.2s",
      "model": "gemini-2.5-flash"
    },
    "quotaUsed": {
      "current": 5,
      "limit": 10,
      "remaining": 5
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### POST `/generate/image-to-image`
Transform an existing image using a text prompt.

**Authentication:** Required  
**Content-Type:** `multipart/form-data`

**Form Data:**
- `image`: File (required) - Source image file
- `prompt`: String (required) - Transformation description
- `strength`: Number (optional) - Transformation strength (0.1-1.0)
- `style`: String (optional) - Style to apply
- `quality`: String (optional) - Output quality

**Example cURL:**
```bash
curl -X POST http://localhost:3001/api/generate/image-to-image \
  -H "Authorization: Bearer <clerk_jwt_token>" \
  -F "image=@/path/to/image.jpg" \
  -F "prompt=Transform this into a watercolor painting" \
  -F "strength=0.7" \
  -F "style=artistic"
```

**Response:**
```json
{
  "status": "success",
  "message": "Image transformation completed successfully",
  "data": {
    "generationId": "gen_123457",
    "originalImageUrl": "https://...",
    "transformedImageUrl": "https://...",
    "metadata": {
      "prompt": "Transform this into a watercolor painting",
      "strength": 0.7,
      "style": "artistic",
      "processingTime": "4.1s"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### POST `/generate/multi-image`
Compose multiple images into a single output.

**Authentication:** Required  
**Content-Type:** `multipart/form-data`

**Form Data:**
- `images[]`: Files (required) - Multiple image files (2-4 images)
- `compositionType`: String (required) - "collage", "blend", "sequence"
- `prompt`: String (required) - Composition description
- `layout`: String (optional) - Layout preference
- `blendMode`: String (optional) - Blending method for blend type

**Example cURL:**
```bash
curl -X POST http://localhost:3001/api/generate/multi-image \
  -H "Authorization: Bearer <clerk_jwt_token>" \
  -F "images[]=@/path/to/image1.jpg" \
  -F "images[]=@/path/to/image2.jpg" \
  -F "compositionType=collage" \
  -F "prompt=Create a beautiful collage of these landscapes"
```

**Response:**
```json
{
  "status": "success",
  "message": "Multi-image composition completed successfully",
  "data": {
    "generationId": "gen_123458",
    "composedImageUrl": "https://...",
    "sourceImages": [
      "https://...",
      "https://..."
    ],
    "metadata": {
      "compositionType": "collage",
      "imageCount": 2,
      "processingTime": "5.8s"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### POST `/generate/refine`
Refine an existing image with detailed adjustments.

**Authentication:** Required  
**Content-Type:** `multipart/form-data`

**Form Data:**
- `image`: File (required) - Source image file
- `refinementType`: String (required) - "enhance", "style", "details"
- `adjustments`: String (required) - JSON string of adjustments
- `intensity`: Number (optional) - Refinement intensity (0.1-1.0)

**Example Adjustments:**
```json
{
  "brightness": 0.1,
  "contrast": 0.2,
  "saturation": 0.15,
  "sharpness": 0.3,
  "denoise": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Image refinement completed successfully",
  "data": {
    "generationId": "gen_123459",
    "originalImageUrl": "https://...",
    "refinedImageUrl": "https://...",
    "metadata": {
      "refinementType": "enhance",
      "adjustments": {
        "brightness": 0.1,
        "contrast": 0.2,
        "saturation": 0.15
      },
      "processingTime": "2.9s"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/generate/history`
Get user's image generation history.

**Authentication:** Required

**Query Parameters:**
- `page`: Number (optional) - Page number (default: 1)
- `limit`: Number (optional) - Items per page (default: 20, max: 100)
- `type`: String (optional) - Filter by generation type

**Response:**
```json
{
  "status": "success",
  "message": "Generation history retrieved successfully",
  "data": {
    "generations": [
      {
        "id": "gen_123456",
        "type": "text-to-image",
        "prompt": "A beautiful sunset over mountains",
        "imageUrl": "https://...",
        "createdAt": "2024-01-01T12:00:00.000Z",
        "metadata": {
          "processingTime": "3.2s",
          "style": "realistic"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/generate/quota`
Get user's current quota status and usage.

**Authentication:** Required

**Response:**
```json
{
  "status": "success",
  "message": "Quota status retrieved successfully",
  "data": {
    "subscription": {
      "tier": "free",
      "status": "active"
    },
    "quota": {
      "textToImage": {
        "used": 5,
        "limit": 10,
        "remaining": 5,
        "resetsAt": "2024-01-02T00:00:00.000Z"
      },
      "imageToImage": {
        "used": 2,
        "limit": 5,
        "remaining": 3,
        "resetsAt": "2024-01-02T00:00:00.000Z"
      },
      "multiImage": {
        "used": 1,
        "limit": 3,
        "remaining": 2,
        "resetsAt": "2024-01-02T00:00:00.000Z"
      },
      "refine": {
        "used": 0,
        "limit": 5,
        "remaining": 5,
        "resetsAt": "2024-01-02T00:00:00.000Z"
      }
    },
    "usage": {
      "thisMonth": 8,
      "thisWeek": 3,
      "today": 1
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "status": "error",
  "message": "Detailed error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error",
    "validation": "Validation details"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `QUOTA_EXCEEDED` | 429 | Subscription quota exceeded |
| `FILE_TOO_LARGE` | 413 | Uploaded file exceeds size limit |
| `UNSUPPORTED_FORMAT` | 415 | Unsupported file format |
| `GENERATION_FAILED` | 500 | AI generation service error |
| `DATABASE_ERROR` | 500 | Database connection or query error |

## Rate Limiting & Subscriptions

### Subscription Tiers

| Tier | Text-to-Image | Image-to-Image | Multi-Image | Refine | File Size |
|------|---------------|----------------|-------------|---------|-----------|
| **Free** | 10/day | 5/day | 3/day | 5/day | 5MB |
| **Pro** | 100/day | 50/day | 25/day | 50/day | 25MB |
| **Premium** | 500/day | 200/day | 100/day | 200/day | 50MB |

### File Upload Limits

- **Supported Formats**: JPEG, PNG, WebP, TIFF
- **Max File Size**: Varies by subscription tier
- **Max Images per Request**: 4 for multi-image composition

## Environment Setup

### Required Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/artifex

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Server Configuration
PORT=3001
NODE_ENV=development

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=100
```

### Installation & Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start

# Run database migrations
npm run migrate

# Seed database
npm run seed
```

### Health Check

Before using the API, verify it's running correctly:

```bash
curl http://localhost:3001/api/health
```

---

## Support

For issues or questions regarding the API, please check:
- [API Health Status](http://localhost:3001/api/health)
- [Clerk Documentation](https://clerk.dev/docs)
- [Google Gemini API Documentation](https://ai.google.dev/gemini-api/docs)

**Last Updated**: 2024-01-01  
**API Version**: 1.0.0
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

### Image Generation API
> **Authentication Required**: All image generation endpoints require valid Clerk authentication.

#### Text-to-Image Generation
- **POST** `/api/v1/generate/text-to-image` - Generate image from text prompt

**Request Body:**
```json
{
  "prompt": "A majestic sunset over mountains",
  "aspectRatio": "16:9",
  "style": "realistic",
  "quality": "hd"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://example.com/generated-image.jpg",
    "imageId": "gen_123abc456def",
    "metadata": {
      "width": 1920,
      "height": 1080,
      "format": "jpeg",
      "size": 245760,
      "aspectRatio": "16:9",
      "generationType": "text-to-image",
      "processingTime": 3.2
    },
    "usage": {
      "creditsUsed": 1,
      "tokensConsumed": 150,
      "quotaRemaining": 49
    }
  }
}
```

#### Image-to-Image Transformation
- **POST** `/api/v1/generate/image-to-image` - Transform existing image with text prompt

**Request:** Multipart form data
- `image`: Source image file (JPEG, PNG, WebP)
- `prompt`: Text description for transformation
- `transformationType`: "enhance" | "stylize" | "background-change" | "object-removal"
- `strength`: Number (0.1 - 1.0) - transformation intensity

**File Limits by Subscription:**
- Free: 10MB max, 1024x1024px max
- Plus: 20MB max, 2048x2048px max  
- Pro: 50MB max, 4096x4096px max

#### Multi-Image Composition
- **POST** `/api/v1/generate/multi-image` - Compose multiple images into single output

**Request:** Multipart form data
- `images[]`: Array of source image files (2-10 images)
- `prompt`: Composition description
- `compositionType`: "collage" | "blend" | "layered" | "panorama"
- `layout`: "grid" | "horizontal" | "vertical" | "custom"

**File Count Limits by Subscription:**
- Free: 3 images max
- Plus: 5 images max
- Pro: 10 images max

#### Image Refinement
- **POST** `/api/v1/generate/refine` - Refine existing image with detailed adjustments

**Request:** Multipart form data
- `image`: Source image file
- `prompt`: Optional refinement description
- `refinementType`: "upscale" | "enhance-details" | "color-correction" | "lighting-adjustment"
- `adjustments`: Object with brightness, contrast, saturation, sharpness values
- `preserveAspectRatio`: Boolean

**Adjustments Object:**
```json
{
  "brightness": 0.1,
  "contrast": 0.05,
  "saturation": -0.1,
  "sharpness": 0.2
}
```

#### Generation History
- **GET** `/api/v1/generate/history` - Get user's generation history

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)
- `type`: Filter by generation type ("text-to-image" | "image-to-image" | "multi-image" | "refine")

#### Quota Status
- **GET** `/api/v1/generate/quota` - Get current quota and usage information

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": "plus",
    "current": {
      "images": 15,
      "credits": 35
    },
    "limits": {
      "images": 100,
      "credits": 500,
      "fileSize": 20971520,
      "maxDimensions": 2048,
      "multiImageCount": 5
    },
    "resetDate": "2024-02-01T00:00:00.000Z",
    "usage": {
      "daily": 5,
      "weekly": 23,
      "monthly": 15
    }
  }
}
```

#### Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Validation failed: prompt is required"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**429 Too Many Requests:**
```json
{
  "success": false,
  "message": "Generation quota exceeded",
  "quota": {
    "remaining": 0,
    "resetDate": "2024-02-01T00:00:00.000Z"
  }
}
```

### Future Endpoints (Planned)
- `/api/v1/users` - User management
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