# Publo

> Engineering Intelligence

A modern full-stack application with Next.js frontend and Supabase for authentication and database. Optimized for Vercel deployment with support for GitHub and Google OAuth.

## 🏗️ Architecture

Modern serverless architecture optimized for Vercel + Supabase:

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, and App Router
- **Authentication**: Supabase Auth (Email/Password, GitHub OAuth, Google OAuth)
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Storage**: Supabase Storage (file uploads)
- **API**: Supabase REST API + optional Next.js API routes
- **Realtime**: Supabase Realtime subscriptions
- **Local Dev**: Docker Compose for PostgreSQL

## 📋 Prerequisites

**For Local Development:**
- Node.js 20+
- Docker Desktop (for local PostgreSQL)
- Git

**For Production:**
- Supabase account (free tier available)
- Vercel account (free tier available)
- GitHub account (for OAuth)

## 🚀 Quick Start

### Option A: With Supabase (Recommended for Production)

1. **Set up Supabase**
   ```bash
   # See SUPABASE_SETUP.md for detailed instructions
   ```
   - Create a Supabase project
   - Get your API keys
   - Enable GitHub/Google OAuth

2. **Configure Frontend**
   ```bash
   cd frontend
   cp .env.local.example .env.local
   # Add your Supabase URL and anon key
   npm install
   npm run dev
   ```

3. **Access the app**: http://localhost:3000

### Option B: Local Development Only

1. **Start PostgreSQL**
   ```bash
   docker-compose -f docker-compose.simple.yml up -d
   ```

2. **Install and run frontend**
   ```bash
   cd frontend
   npm install
   # You'll need Supabase for auth to work
   npm run dev
   ```

3. **Access**: http://localhost:3002

## 🛠️ Development

### Viewing Logs

View logs for all services:
```bash
docker-compose logs -f
```

View logs for a specific service:
```bash
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f db
```

### Stopping Services

Stop all services:
```bash
docker-compose down
```

Stop and remove all data (⚠️ destructive):
```bash
docker-compose down -v
```

### Rebuilding After Code Changes

If you make changes to the Dockerfile or dependencies:

```bash
# Rebuild specific service
docker-compose up -d --build frontend

# Rebuild all services
docker-compose up -d --build
```

### Local Development (Without Docker)

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create a `.env.local` file in the frontend directory:
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_API_URL=http://localhost:4001
```

#### Backend

```bash
cd backend
npm install
npm run dev
```

Create a `.env` file in the backend directory using the values from `backend/.env.example`.

## 🗄️ Database

### Accessing the Database

#### Via Supabase Studio
Visit http://localhost:3001 to use the visual database editor.

#### Via psql
```bash
docker-compose exec db psql -U postgres
```

#### Via your favorite database client
- Host: localhost
- Port: 5432
- Database: postgres
- User: postgres
- Password: (from your .env file)

### Running Migrations

Database migrations should be placed in a migrations directory. You can run them using:

```bash
# Example using psql
docker-compose exec db psql -U postgres -d postgres -f /path/to/migration.sql
```

## 🔐 Authentication

Supabase Auth is configured and ready to use. The default configuration:

- Email/password authentication is enabled
- Email confirmation is disabled for local development
- Sign-up is enabled

To customize authentication settings, modify the `auth` service environment variables in `docker-compose.yml`.

### Example: Using Auth in Frontend

```typescript
import { supabase } from '@/lib/supabase'

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
})

// Sign out
await supabase.auth.signOut()
```

## 📦 Project Structure

```
publo/
├── frontend/               # Next.js frontend application
│   ├── src/
│   │   ├── app/           # App router pages
│   │   └── lib/           # Utility functions and configs
│   ├── Dockerfile
│   └── package.json
├── backend/               # Express backend API
│   ├── src/
│   │   └── index.ts       # Main server file
│   ├── Dockerfile
│   └── package.json
├── docker/                # Docker configuration files
│   └── kong.yml          # Kong API gateway config
├── docker-compose.yml     # Docker Compose orchestration
├── env.example           # Environment variables template
└── README.md
```

## 🔧 Environment Variables

### Root `.env`

Main environment configuration for all services. See `env.example` for all available options.

Key variables:
- `POSTGRES_PASSWORD`: Database password
- `JWT_SECRET`: Secret for JWT tokens (must be at least 32 characters)
- `SUPABASE_ANON_KEY`: Public API key
- `SUPABASE_SERVICE_KEY`: Admin API key (keep secret!)

### Frontend `.env.local`

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Supabase key
- `NEXT_PUBLIC_API_URL`: Backend API URL

### Backend `.env`

- `DATABASE_URL`: PostgreSQL connection string
- `SUPABASE_URL`: Supabase API URL (internal Docker network)
- `SUPABASE_SERVICE_KEY`: Supabase admin key
- `JWT_SECRET`: Must match the root .env

## 🐛 Troubleshooting

### Port Already in Use

If you see errors about ports already in use, either stop the conflicting service or change the port mapping in `docker-compose.yml`.

### Services Not Connecting

Make sure all services are healthy:
```bash
docker-compose ps
```

All services should show "Up" status. If a service is restarting, check its logs:
```bash
docker-compose logs <service-name>
```

### Database Connection Issues

1. Ensure the database is healthy:
```bash
docker-compose ps db
```

2. Check if you can connect directly:
```bash
docker-compose exec db pg_isready -U postgres
```

3. Verify your `POSTGRES_PASSWORD` matches in all configurations.

### Frontend Can't Connect to Backend

The frontend runs in the browser, so it needs to use `localhost` URLs to connect to the backend. Make sure your frontend `.env.local` uses:
- `NEXT_PUBLIC_API_URL=http://localhost:4001`
- `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`

### Resetting Everything

To completely reset the project (⚠️ deletes all data):

```bash
docker-compose down -v
docker-compose up -d --build
```

## 📚 API Documentation

### Backend Endpoints

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "publo-backend",
  "environment": "development"
}
```

#### `GET /api/status`
System status with database connectivity.

#### `GET /api/example`
Example API endpoint.

## 🚢 Production Deployment

For production deployment:

1. **Generate secure secrets** for all passwords and keys
2. **Enable SSL/TLS** for all external connections
3. **Configure proper CORS** origins
4. **Set up email provider** (SMTP configuration)
5. **Enable email confirmation** for auth
6. **Use a production-grade database** (or properly configure PostgreSQL)
7. **Set up backup and monitoring**
8. **Review and harden Kong configuration**

### Production Environment Variables

At minimum, change these in production:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `SECRET_KEY_BASE`
- `SUPABASE_ANON_KEY` (generate new)
- `SUPABASE_SERVICE_KEY` (generate new)
- `SMTP_*` variables for email
- `SITE_URL` to your production domain

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Docker](https://www.docker.com/)
- [Express](https://expressjs.com/)

