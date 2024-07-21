# Dynamic Load Balancer

## Overview

This project implements a dynamic load balancer using Node.js and Express. It distributes incoming HTTP requests across multiple backend servers, performs health checks, and implements self-healing capabilities.

## Features

- Dynamic server pool management
- Multiple load balancing algorithms (Round Robin, Weighted Round Robin)
- Periodic health checks
- Self-healing attempts for failed servers
- Configurable retry logic
- Alert system for server failures
- Rate limiting
- Sticky sessions
- Caching
- Content-based routing
- Geo-routing
- Latency-based routing
- SSL/TLS support
- Multi-region support
- Circuit breaker pattern
- WebSocket support
- CORS configuration
- Request/Response compression
- IP whitelisting and blacklisting
- Request/Response transformation
- API key authentication
- Monitoring endpoints
- Dynamic configuration reloading
- Graceful shutdown
## Prerequisites

- Node.js (v14 or later recommended)
- npm (comes with Node.js)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/ItsRoy69/Load-Balancer.git
cd dynamic-load-balancer
```

2. Install dependencies:

```bash
npm install
```

3. Configure the load balancer by creating a ```.env``` file based on the provided sample.

Configuration
Create a .env file in the root directory and configure.
## Usage

1. Start the backend servers:

```bash
node src/backend-server.js 8081
node src/backend-server.js 8082
node src/backend-server.js 8083
```

2. Start the load balancer:

```bash
node src/load-balancer.js
```
3. The load balancer will start on the configured port (default 80).

## Testing

You can test the load balancer by sending HTTP requests to its address. The `/health` endpoint can be used to check the load balancer's status.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License - see the LICENSE file for details.
