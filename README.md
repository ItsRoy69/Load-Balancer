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
Create a .env file in the root directory and configure the following options:

- LB_PORT: Port for the load balancer
- LB_ALGO: Load balancing algorithm ('rr' for Round Robin, 'wrr' for Weighted Round Robin)
- BE_SERVERS: JSON string of backend servers with their domains and weights
- BE_RETRIES: Number of retries for failed requests
- BE_RETRY_DELAY: Delay between retries in milliseconds
- BE_PING_PATH: Path used for health checks
- BE_PING_RETRIES: Number of retries for health checks
- BE_PING_RETRY_DELAY: Delay between health check retries in milliseconds
- HEALTH_CHECK_INTERVAL: Interval for health checks in milliseconds
- SEND_ALERT_WEBHOOK: Webhook URL for sending alerts
- ALERT_ON_BE_FAILURE_STREAK: Number of consecutive failures before sending an alert
- ALERT_ON_ALL_BE_FAILURE_STREAK: Number of consecutive all-server failures before sending an alert
- ENABLE_SELF_HEALING: Boolean to enable/disable self-healing attempts
- ENABLE_STICKY_SESSION: Boolean to enable/disable sticky sessions
- STICKY_SESSION_COOKIE_NAME: Name of the cookie used for sticky sessions
- ENABLE_CACHE: Boolean to enable/disable caching
- CACHE_TTL: Time-to-live for cached responses in seconds
- CONTENT_BASED_ROUTING: JSON string defining content-based routing rules
- ENABLE_GEO_ROUTING: Boolean to enable/disable geo-routing
- GEO_ROUTING_SERVICE: URL of the geo-routing service
- ENABLE_LATENCY_BASED_ROUTING: Boolean to enable/disable latency-based routing
- LATENCY_CHECK_INTERVAL: Interval for latency checks in milliseconds
- ENABLE_SSL: Boolean to enable/disable SSL/TLS
- SSL_CERT_PATH: Path to SSL certificate file
- SSL_KEY_PATH: Path to SSL key file
- LOG_LEVEL: Logging level (e.g., 'info', 'debug', 'error')
- LOG_FORMAT: Logging format ('json' or 'text')
- WORKER_PROCESSES: Number of worker processes to spawn
- ENABLE_CIRCUIT_BREAKER: Boolean to enable/disable circuit breaker
- CIRCUIT_BREAKER_THRESHOLD: Number of failures before opening the circuit
- CIRCUIT_BREAKER_TIMEOUT: Time in milliseconds to keep the circuit open
- REQUEST_TIMEOUT: Timeout for backend requests in milliseconds
- ENABLE_WEBSOCKET: Boolean to enable/disable WebSocket support
- ENABLE_CORS: Boolean to enable/disable CORS
- CORS_ORIGIN: Allowed origins for CORS (use '*' for all)
- CORS_METHODS: Allowed methods for CORS
- ENABLE_COMPRESSION: Boolean to enable/disable compression
- COMPRESSION_LEVEL: Compression level (0-9)
- IP_WHITELIST: Comma-separated list of allowed IP addresses
- IP_BLACKLIST: Comma-separated list of blocked IP addresses
- ENABLE_REQUEST_TRANSFORM: Boolean to enable/disable request transformation
- ENABLE_RESPONSE_TRANSFORM: Boolean to enable/disable response transformation
- ENABLE_API_KEY_AUTH: Boolean to enable/disable API key authentication
- API_KEYS: Comma-separated list of valid API keys
- ENABLE_MONITORING: Boolean to enable/disable monitoring endpoints
- MONITORING_PATH: Path for the monitoring endpoint
- ENABLE_DYNAMIC_CONFIG: Boolean to enable/disable dynamic configuration reloading
- DYNAMIC_CONFIG_INTERVAL: Interval for checking configuration updates in milliseconds
- GRACEFUL_SHUTDOWN_TIMEOUT: Timeout for graceful shutdown in milliseconds

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
