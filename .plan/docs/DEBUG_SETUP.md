# Debug Setup Guide

This project is configured for debugging both the NestJS backend and Next.js frontend.

## Prerequisites

1. **VS Code** with the following extensions:
   - JavaScript Debugger (built-in)
   - TypeScript and JavaScript Language Features (built-in)

2. **Docker** and **Docker Compose** must be running

## Debug Configurations

### Available Debug Configurations

1. **Debug NestJS API (Docker)** - Attach to the API running in Docker
   - Port: `48392` (maps to container's `9229`)
   - Use this when services are running in Docker

2. **Debug NestJS API (Local)** - Run API locally with debugging
   - Requires: Local Node.js installation
   - Starts the API with `npm run start:debug`

3. **Debug Next.js Web (Docker)** - Attach to the web app running in Docker
   - Port: `59483` (maps to container's `9229`)
   - Use this when services are running in Docker

4. **Debug Next.js Web (Local)** - Run web app locally with debugging
   - Requires: Local Node.js installation
   - Starts with `npm run dev:debug`

5. **Debug Jest Tests (Server)** - Debug unit tests
   - Runs tests with Node inspector

6. **Debug Full Stack (Docker)** - Debug both API and Web simultaneously
   - Automatically starts Docker services if needed

7. **Debug Full Stack (Local)** - Debug both API and Web locally

## How to Use

### Option 1: Debug in Docker (Recommended)

1. Start Docker services:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

2. Wait for services to be ready (check logs):
   ```bash
   docker logs -f zakpos-api
   docker logs -f zakpos-web
   ```

3. In VS Code:
   - Press `F5` or go to Run and Debug
   - Select "Debug NestJS API (Docker)" or "Debug Next.js Web (Docker)"
   - Or select "Debug Full Stack (Docker)" to debug both

4. Set breakpoints in your code

5. Make requests to trigger breakpoints

### Option 2: Debug Locally

1. Ensure dependencies are installed:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. In VS Code:
   - Select "Debug NestJS API (Local)" or "Debug Next.js Web (Local)"
   - Or select "Debug Full Stack (Local)"

3. Set breakpoints and start debugging

## Debug Ports

- **API Debug Port (Docker)**: `48392` → Container `9229`
- **Web Debug Port (Docker)**: `59483` → Container `9229`
- **API Debug Port (Local)**: `9229`
- **Web Debug Port (Local)**: `9229`

## Troubleshooting

### Debugger won't attach

1. **Check if services are running**:
   ```bash
   docker ps
   ```

2. **Check if debug ports are exposed**:
   ```bash
   docker port zakpos-api
   docker port zakpos-web
   ```

3. **Check container logs for debug messages**:
   ```bash
   docker logs zakpos-api | grep -i debug
   docker logs zakpos-web | grep -i debug
   ```

4. **Restart containers**:
   ```bash
   docker compose -f docker-compose.dev.yml restart api web
   ```

### Breakpoints not hitting

1. Ensure source maps are enabled (they are by default)
2. Check that the file path matches between local and container
3. Try restarting the debugger
4. Verify the code is actually being executed

### Port already in use

If you get "port already in use" errors:

1. Check what's using the port:
   ```bash
   # Windows
   netstat -ano | findstr :48392
   
   # Linux/Mac
   lsof -i :48392
   ```

2. Stop the conflicting process or change the port in `launch.json`

## Tips

1. **Use compound configurations** to debug both services simultaneously
2. **Set conditional breakpoints** for complex debugging scenarios
3. **Use the Debug Console** to evaluate expressions
4. **Check the Call Stack** to understand execution flow
5. **Use Watch expressions** to monitor variable values

## VS Code Tasks

Additional tasks are available in VS Code:

- **Start Docker Services** - Start all containers
- **Stop Docker Services** - Stop all containers
- **Restart API Container** - Restart just the API
- **Restart Web Container** - Restart just the web app
- **View API Logs** - Stream API logs
- **View Web Logs** - Stream web logs

Access via: `Ctrl+Shift+P` → "Tasks: Run Task"

