# DriveVue AI Server

DriveVue is a modern Car Rental Platform backend with an AI Recommendation Engine powered by Node.js, Express, TypeScript, Mongoose, and Google Gemini.

## Tech Stack
- **Runtime & Framework**: Node.js, Express
- **Language**: TypeScript
- **Database**: MongoDB via Mongoose
- **Authentication**: JWT (`jsonwebtoken`) & `bcryptjs`
- **AI Integration**: `@google/genai` (Google Gemini AI)
- **Dev Tools**: `ts-node-dev`

## Project Structure
```text
drivevue-ai-server/
├── src/
│   ├── config/
│   │   ├── db.ts               # MongoDB Mongoose connection
│   │   └── gemini.ts           # Google GenAI client instance
│   ├── controllers/
│   │   ├── authController.ts   # User authentication (register, login, profile)
│   │   ├── carController.ts    # Car catalog & inventory management
│   │   └── bookingController.ts# Car rental booking management
│   ├── middlewares/
│   │   ├── authMiddleware.ts   # JWT authentication & role-based authorization
│   │   └── errorMiddleware.ts  # 404 not found & global error handler
│   ├── models/
│   │   ├── User.ts             # User schema with password hashing & roles (ADMIN, USER)
│   │   ├── Car.ts              # Car schema with specs, category & availability
│   │   ├── Booking.ts          # Booking schema linking User and Car
│   │   └── index.ts            # Models barrel export
│   ├── routes/
│   │   ├── authRoutes.ts       # /api/auth routes
│   │   ├── carRoutes.ts        # /api/cars routes
│   │   ├── bookingRoutes.ts    # /api/bookings routes
│   │   └── index.ts            # API aggregator router
│   ├── app.ts                  # Express application setup & middleware stack
│   └── index.ts                # Application entry point & server listener
├── .env.example                # Example environment variables
├── .env                        # Local environment variables
├── .gitignore                  # Git ignore rules
├── package.json                # Project dependencies & scripts
├── tsconfig.json               # TypeScript compiler configuration
└── README.md                   # Documentation
```

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/drivevue-ai
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_URL=http://localhost:3000
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
npm start
```

## Available API Endpoints

### Health Check
- `GET /` - Root status
- `GET /health` - Health check & uptime

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate user & get JWT token
- `GET /api/auth/profile` - Get logged-in user profile (Bearer token required)

### Cars (`/api/cars`)
- `GET /api/cars` - List cars (optional query filters: `category`, `status`)
- `GET /api/cars/:id` - Get car details by ID
- `POST /api/cars` - Add a new car (Admin only)

### Bookings (`/api/bookings`)
- `POST /api/bookings` - Create a new booking (Authenticated)
- `GET /api/bookings/my-bookings` - Get user's bookings (Authenticated)
