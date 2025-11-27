# Quick Start Guide

Get Publo up and running in 3 simple steps!

## Prerequisites

- Docker Desktop installed and running
- 5 minutes of your time ⏱️

## 🚀 Three Steps to Success

### Step 1: Setup Environment

Run the setup script:

```bash
./setup.sh
```

Or manually:

```bash
cp env.example .env
```

### Step 2: Start Services

```bash
docker-compose up -d
```

Or use the Makefile:

```bash
make up
```

### Step 3: Access Your Application

Open your browser and visit:

- **Frontend**: http://localhost:3002
- **Supabase Studio** (Database UI): http://localhost:3001
- **Backend API**: http://localhost:4001/health

## 🎯 What You Get

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  Frontend (Next.js 14 + TypeScript + Tailwind)               │
│  http://localhost:3002                                        │
│                                                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ REST API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  Backend API (Node.js + Express + TypeScript)                │
│  http://localhost:4001                                        │
│                                                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Database Connection
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  Supabase Stack                                               │
│  ├─ PostgreSQL Database                                       │
│  ├─ Auth (GoTrue)                                             │
│  ├─ Storage API                                               │
│  ├─ Realtime                                                  │
│  ├─ REST API (PostgREST)                                      │
│  └─ Studio (Database UI)                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Ports Used

| Service          | Port | Description                    |
|------------------|------|--------------------------------|
| Frontend         | 3002 | Next.js application            |
| Backend API      | 4001 | Express REST API               |
| Supabase Studio  | 3001 | Database management UI         |
| Kong (API GW)    | 8000 | Supabase API gateway           |
| PostgreSQL       | 5432 | Direct database access         |
| Auth             | 9999 | GoTrue authentication service  |
| Realtime         | 4000 | Realtime subscriptions         |
| Storage          | 5000 | File storage API               |
| Meta             | 8080 | Database metadata API          |

## 🛠️ Common Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart a service
docker-compose restart frontend

# Rebuild after changes
docker-compose up -d --build

# View service status
docker-compose ps

# Using Makefile
make help          # See all commands
make logs          # View logs
make restart       # Restart services
make clean         # Stop and remove all data
```

## 🔍 Troubleshooting

### Services won't start?
```bash
# Check Docker is running
docker info

# Check what's using the ports
lsof -i :3002  # or any other port
```

### Need to reset everything?
```bash
docker-compose down -v
docker-compose up -d --build
```

### Can't connect to database?
Check that all services are healthy:
```bash
docker-compose ps
```

## 🎓 Next Steps

1. **Explore the code**
   - Frontend: `frontend/src/`
   - Backend: `backend/src/`

2. **Check out Supabase Studio**
   - Visit http://localhost:3001
   - Create tables, manage auth, browse data

3. **Read the full documentation**
   - See `README.md` for detailed information
   - API documentation
   - Production deployment guide

4. **Start building!**
   - Modify `frontend/src/app/page.tsx` for the homepage
   - Add API endpoints in `backend/src/index.ts`
   - Create database tables in Supabase Studio

## 💡 Tips

- Hot reload is enabled for both frontend and backend
- Changes to code will automatically restart the services
- Database data persists between restarts
- Use `.env` to configure all services

## 🆘 Need Help?

- Check the `README.md` for detailed documentation
- View logs: `docker-compose logs -f [service-name]`
- Restart a problematic service: `docker-compose restart [service-name]`

---

**Ready to build something amazing? Let's go! 🚀**

