.PHONY: help up down build logs clean restart install-frontend install-backend

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Initial setup - copy env files
	@echo "Setting up environment files..."
	@if [ ! -f .env ]; then cp env.example .env; echo "Created .env from env.example"; fi
	@echo "Done! Please update .env with your values if needed."

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

build: ## Build all services
	docker-compose build

rebuild: ## Rebuild and restart all services
	docker-compose up -d --build

logs: ## View logs for all services
	docker-compose logs -f

logs-frontend: ## View frontend logs
	docker-compose logs -f frontend

logs-backend: ## View backend logs
	docker-compose logs -f backend

logs-db: ## View database logs
	docker-compose logs -f db

clean: ## Stop services and remove volumes (WARNING: deletes data!)
	docker-compose down -v

restart: ## Restart all services
	docker-compose restart

restart-frontend: ## Restart frontend service
	docker-compose restart frontend

restart-backend: ## Restart backend service
	docker-compose restart backend

ps: ## Show status of all services
	docker-compose ps

install-frontend: ## Install frontend dependencies
	cd frontend && npm install

install-backend: ## Install backend dependencies
	cd backend && npm install

shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend sh

shell-backend: ## Open shell in backend container
	docker-compose exec backend sh

shell-db: ## Open PostgreSQL shell
	docker-compose exec db psql -U postgres

dev-frontend: ## Run frontend in dev mode (outside Docker)
	cd frontend && npm run dev

dev-backend: ## Run backend in dev mode (outside Docker)
	cd backend && npm run dev

studio: ## Open Supabase Studio
	@echo "Opening Supabase Studio at http://localhost:3001"
	@open http://localhost:3001 || xdg-open http://localhost:3001 || echo "Please open http://localhost:3001 in your browser"

