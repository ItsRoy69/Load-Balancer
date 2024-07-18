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

3. Configure the load balancer by editing `config/config.json`.

## Configuration

Edit `config/config.json` to set up your environment:

- `lbPORT`: Port for the load balancer
- `_lbAlgo`: Load balancing algorithm ('rr' for Round Robin, 'wrr' for Weighted Round Robin)
- `be_servers`: List of backend servers with their domains and weights
- `be_retries`: Number of retries for failed requests
- `be_retry_delay`: Delay between retries in milliseconds
- `be_ping_path`: Path used for health checks
- `be_ping_retries`: Number of retries for health checks
- `be_ping_retry_delay`: Delay between health check retries in milliseconds
- `health_check_interval`: Interval for health checks in milliseconds
- `send_alert_webhook`: Webhook URL for sending alerts
- `alert_on_be_failure_streak`: Number of consecutive failures before sending an alert
- `alert_on_all_be_failure_streak`: Number of consecutive all-server failures before sending an alert
- `enableSelfHealing`: Boolean to enable/disable self-healing attempts
- `_test_only_chances_of_healing_server`: Probability of successful self-healing (for testing purposes)

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

This project is licensed under the MIT License - see the LICENSE file for details.