import express from "express";
import httpProxy from "http-proxy";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import NodeCache from "node-cache";
import bodyParser from "body-parser";
import crypto from "crypto";
import config from "../config/config.js";
import pkg from 'opossum';
const { CircuitBreaker } = pkg;
import { cpus } from 'os';
import { createServer } from 'http';

const app = express();

const proxy = httpProxy.createProxyServer();

let currentIndex = 0;

let beFailureStreak = 0;
let allBeFailureStreak = 0;

const cache = new NodeCache({
  stdTTL: config.cacheTTL,
  checkperiod: config.cacheTTL * 2,
});

let serverHealthScores = {};
const circuitBreakers = {};
const requestPriorities = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: (req) => {
    const currentLoad = getSystemLoad();
    if (currentLoad > 80) {
      return Math.floor(config.rateLimitMax * 0.5);
    } else if (currentLoad > 60) {
      return Math.floor(config.rateLimitMax * 0.75);
    }
    return config.rateLimitMax;
  },
  keyGenerator: (req) => {
    return req.ip + '-' + req.headers['user-agent'];
  },
  handler: (req, res) => {
    res.status(429).send('Too many requests, please try again later.');
  }
});

app.use(rateLimiter);
app.use(cookieParser());
app.use(bodyParser.json());

let server;
let shuttingDown = false;
let activeConnections = new Set();

function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('Graceful shutdown initiated');

  server.close(() => {
    console.log('Server closed, no longer accepting connections');
  });

  const forcefulShutdownTimeout = setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, config.gracefulShutdownTimeout);

  if (activeConnections.size === 0) {
    console.log('No active connections, shutting down immediately');
    process.exit(0);
  } else {
    console.log(`Waiting for ${activeConnections.size} active connections to finish`);
    setInterval(() => {
      if (activeConnections.size === 0) {
        clearTimeout(forcefulShutdownTimeout);
        console.log('All connections closed, shutting down gracefully');
        process.exit(0);
      }
    }, 1000);
  }
}

function generateRequestId() {
  return crypto.randomBytes(16).toString("hex");
}

function logRequest(requestId, message, details = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      message,
      ...details,
    })
  );
}

function updateServerHealthScore(server) {
  if (!serverHealthScores[server.domain]) {
    serverHealthScores[server.domain] = 100;
  }

  if (server.isDown) {
    serverHealthScores[server.domain] = Math.max(0, serverHealthScores[server.domain] - 20);
  } else {
    serverHealthScores[server.domain] = Math.min(100, serverHealthScores[server.domain] + 5);
  }
}

function getCircuitBreaker(server) {
  if (!circuitBreakers[server.domain]) {
    circuitBreakers[server.domain] = new CircuitBreaker(async () => {
      const response = await fetch(`${server.domain}${config.be_ping_path}`);
      if (!response.ok) throw new Error('Server unhealthy');
    }, {
      timeout: config.requestTimeout,
      errorThresholdPercentage: config.circuitBreakerErrorThreshold,
      resetTimeout: config.circuitBreakerResetTimeout
    });

    circuitBreakers[server.domain].on('open', () => {
      console.log(`Circuit breaker opened for ${server.domain}`);
      server.isDown = true;
    });

    circuitBreakers[server.domain].on('halfOpen', () => {
      console.log(`Circuit breaker half-opened for ${server.domain}`);
    });

    circuitBreakers[server.domain].on('close', () => {
      console.log(`Circuit breaker closed for ${server.domain}`);
      server.isDown = false;
    });
  }

  return circuitBreakers[server.domain];
}

async function periodicHealthChecks() {
  for (const region of config.regions) {
    let allRegionServersDown = true;
    for (const server of region.servers) {
      const circuitBreaker = getCircuitBreaker(server);
      
      try {
        await circuitBreaker.fire();
        console.log(`Server ${server.domain} in region ${region.name} health status: Healthy`);
        server.isDown = false;
        allRegionServersDown = false;
      } catch (error) {
        console.log(`Server ${server.domain} in region ${region.name} health status: Unhealthy`);
        server.isDown = true;
        beFailureStreak++;
        if (beFailureStreak >= config.alert_on_be_failure_streak) {
          sendAlert(
            "BE Server Down",
            `Server ${server.domain} in region ${region.name} is down`
          );
          beFailureStreak = 0;
        }
        if (config.enableSelfHealing) {
          attemptServerHeal(server, region.name);
        }
      }
      
      updateServerHealthScore(server);
    }
    if (allRegionServersDown) {
      sendAlert(
        "All BE Servers Down in Region",
        `All backend servers in ${region.name} are down`
      );
    }
  }
}

setInterval(periodicHealthChecks, config.health_check_interval);

async function sendAlert(type, message) {
  try {
    await fetch(config.send_alert_webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message }),
    });
    console.log(`Alert sent: ${type} - ${message}`);
  } catch (error) {
    console.error("Failed to send alert:", error);
  }
}

async function attemptServerHeal(server, regionName) {
  console.log(
    `Attempting to heal server ${server.domain} in region ${regionName}...`
  );
  if (Math.random() < config._test_only_chances_of_healing_server) {
    server.isDown = false;
    console.log(
      `Server ${server.domain} in region ${regionName} has been healed and is back online`
    );
  } else {
    console.log(
      `Failed to heal server ${server.domain} in region ${regionName}`
    );
  }
}

async function determineUserRegion(ip) {
  try {
    const response = await fetch(`${config.geoRoutingService}/${ip}`);
    const data = await response.json();
    return data.region;
  } catch (error) {
    console.error("Error determining user region:", error);
    return config.defaultRegion;
  }
}

async function selectServer(req, forceRegion = null) {
  let region = forceRegion || config.defaultRegion;

  if (config.enableGeoRouting && !forceRegion) {
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    region = await determineUserRegion(clientIp);
  }

  const regionConfig = config.regions.find((r) => r.name === region);
  if (!regionConfig) {
    console.error(`Region ${region} not found in configuration`);
    return null;
  }

  const healthyServers = regionConfig.servers.filter(s => 
    !s.isDown && 
    serverHealthScores[s.domain] > config.healthScoreThreshold &&
    !circuitBreakers[s.domain]?.opened
  );

  if (healthyServers.length === 0) {
    console.error(`No healthy servers available in region ${region}`);
    return null;
  }

  const contentBasedRoute = findContentBasedRoute(req);
  if (contentBasedRoute) {
    const server = healthyServers.find(
      (s) => s.domain === contentBasedRoute.server
    );
    if (server) {
      console.log(`Content-based routing - Using server: ${server.domain}`);
      return server;
    }
  }

  if (config.enableStickySession) {
    const serverId = req.cookies[config.stickySessionCookieName];
    if (serverId) {
      const server = healthyServers.find((s) => s.domain === serverId);
      if (server) {
        console.log(`Sticky session - Using server: ${server.domain}`);
        return server;
      }
    }
  }

  console.log(
    `Current healthy server pool in region ${region}:`,
    healthyServers.map((s) => s.domain)
  );
  console.log(`Current load balancing algorithm: ${config._lbAlgo}`);

  let selectedServer;
  if (config.enableLatencyBasedRouting) {
    selectedServer = selectLatencyBasedServer(healthyServers);
  } else {
    switch (config._lbAlgo) {
      case "rr":
        selectedServer = selectRoundRobinServer(healthyServers);
        break;
      case "wrr":
        selectedServer = selectWeightedRoundRobinServer(healthyServers);
        break;
      default:
        console.warn(
          `Unknown algorithm: ${config._lbAlgo}. Falling back to round robin.`
        );
        selectedServer = selectRoundRobinServer(healthyServers);
    }
  }

  console.log(`Selected server: ${selectedServer.domain}`);
  return selectedServer;
}

function findContentBasedRoute(req) {
  if (!config.contentBasedRouting) return null;

  for (const rule of config.contentBasedRouting) {
    if (rule.path && req.url.startsWith(rule.path)) {
      return rule;
    }
    if (rule.header) {
      const headerName = Object.keys(rule.header)[0];
      if (req.headers[headerName.toLowerCase()] === rule.header[headerName]) {
        return rule;
      }
    }
    if (rule.payload && req.body) {
      const payloadKey = Object.keys(rule.payload)[0];
      if (req.body[payloadKey] === rule.payload[payloadKey]) {
        return rule;
      }
    }
  }

  return null;
}

function selectRoundRobinServer(servers) {
  const server = servers[currentIndex % servers.length];
  currentIndex = (currentIndex + 1) % servers.length;
  return server;
}

function selectWeightedRoundRobinServer(servers) {
  const totalWeight = servers.reduce((sum, server) => sum + server.weight, 0);
  let random = Math.floor(Math.random() * totalWeight);

  for (const server of servers) {
    if (random < server.weight) {
      return server;
    }
    random -= server.weight;
  }

  return servers[servers.length - 1];
}

function selectLatencyBasedServer(servers) {
  return servers.reduce((best, current) =>
    current.latency < best.latency ? current : best
  );
}

async function checkLatency(server) {
  const start = Date.now();
  try {
    await fetch(`${server.domain}${config.be_ping_path}`, { timeout: 5000 });
    return Date.now() - start;
  } catch (error) {
    console.error(`Latency check failed for ${server.domain}:`, error);
    return Infinity;
  }
}

async function updateServerLatencies() {
  for (const region of config.regions) {
    for (const server of region.servers) {
      server.latency = await checkLatency(server);
    }
  }
}

if (config.enableLatencyBasedRouting) {
  setInterval(updateServerLatencies, config.latencyCheckInterval);
}

async function retryRequest(req, res) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const cacheKey = req.method + req.url;
  const priority = getPriority(req);

  logRequest(requestId, "Incoming request", {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });

  if (config.enableCache && req.method === "GET") {
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      logRequest(requestId, "Cache hit", { cacheKey });
      res.status(cachedResponse.status);
      for (const [key, value] of Object.entries(cachedResponse.headers)) {
        res.setHeader(key, value);
      }
      res.send(cachedResponse.body);
      logRequest(requestId, "Request completed", {
        duration: Date.now() - startTime,
        status: cachedResponse.status,
        source: "cache",
      });
      return;
    }
  }

  for (const region of config.regions) {
    for (let i = 0; i < config.be_retries; i++) {
      const server = await selectServer(req, region.name);
      if (!server) continue;

      const circuitBreaker = getCircuitBreaker(server);

      if (circuitBreaker.opened) {
        logRequest(requestId, "Circuit breaker open, skipping server", { server: server.domain });
        continue;
      }

      logRequest(requestId, "Selected server", {
        server: server.domain,
        region: region.name,
        attempt: i + 1,
      });

      try {
        await circuitBreaker.fire();

        const targetUrl = new URL(req.url, server.domain);
        const proxyRes = await fetch(targetUrl, {
          method: req.method,
          headers: req.headers,
          body:
            req.method !== "GET" && req.method !== "HEAD"
              ? req.body
              : undefined,
          redirect: "manual",
        });

        logRequest(requestId, "Received response from backend", {
          status: proxyRes.status,
          headers: Object.fromEntries(proxyRes.headers),
        });

        if (proxyRes.status === 429) {
          res.status(429).send("Rate limit exceeded. Please try again later.");
          logRequest(requestId, "Rate limit exceeded");
          return;
        }

        res.status(proxyRes.status);
        for (const [key, value] of proxyRes.headers) {
          res.setHeader(key, value);
        }

        if (
          config.enableStickySession &&
          !req.cookies[config.stickySessionCookieName]
        ) {
          res.cookie(config.stickySessionCookieName, server.domain, {
            maxAge: config.stickySessionCookieMaxAge,
            httpOnly: true,
            secure: true,
            sameSite: "strict",
          });
          logRequest(requestId, "Set sticky session cookie", {
            server: server.domain,
          });
        }

        const responseBody = await proxyRes.buffer();

        if (
          config.enableCache &&
          req.method === "GET" &&
          proxyRes.status === 200
        ) {
          cache.set(
            cacheKey,
            {
              status: proxyRes.status,
              headers: Object.fromEntries(proxyRes.headers),
              body: responseBody,
            },
            config.cacheTTL
          );
          logRequest(requestId, "Cached response", { cacheKey });
        }

        res.send(responseBody);
        logRequest(requestId, "Request completed", {
          duration: Date.now() - startTime,
          status: proxyRes.status,
          source: "backend",
        });

        updateServerHealthScore(server);

        return;
      } catch (error) {
        logRequest(requestId, "Error proxying to backend", {
          server: server.domain,
          region: region.name,
          error: error.message,
        });
        updateServerHealthScore(server);
        if (config.enableStickySession) {
          res.clearCookie(config.stickySessionCookieName);
          logRequest(requestId, "Cleared sticky session cookie");
        }
        if (config.enableSelfHealing) {
          attemptServerHeal(server, region.name);
        }
      }
      await new Promise((resolve) =>
        setTimeout(resolve, config.be_retry_delay)
      );
    }
  }

  if (priority === requestPriorities.HIGH) {
    res.status(503).send("Service Unavailable. Please try again later.");
  } else {
    res.status(429).send("Server is experiencing high load. Please try again later.");
  }
  logRequest(requestId, "Request failed after all retries", {
    duration: Date.now() - startTime,
    status: priority === requestPriorities.HIGH ? 503 : 429,
  });
}

app.get("/health", (req, res) => {
  const requestId = generateRequestId();
  logRequest(requestId, "Health check request");
  res.status(200).send("OK");
  logRequest(requestId, "Health check response sent");
});

app.use((req, res, next) => {
  const priority = getPriority(req);
  if (priority === requestPriorities.LOW && getSystemLoad() > 80) {
    res.status(503).send("Service temporarily unavailable due to high load. Please try again later.");
  } else {
    next();
  }
});

app.use((req, res) => {
  if (shuttingDown) {
    res.set('Connection', 'close');
    res.status(503).send('Server is in the process of shutting down');
    return;
  }

  const requestId = generateRequestId();
  activeConnections.add(requestId);

  res.on('finish', () => {
    activeConnections.delete(requestId);
  });

  logRequest(requestId, "Received request", {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });
  retryRequest(req, res).catch((error) => {
    console.error("Unhandled error in retryRequest:", error);
    logRequest(requestId, "Unhandled error", { error: error.message });
    res.status(500).send("Internal Server Error");
  }).finally(() => {
    activeConnections.delete(requestId);
  });
});

function getSystemLoad() {
  const cpuInfo = cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for(let i = 0, len = cpuInfo.length; i < len; i++) {
    const cpu = cpuInfo[i];
    for(let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  return 100 - ~~(100 * totalIdle / totalTick);
}

function getPriority(req) {
  if (req.headers['x-priority'] === 'high') {
    return requestPriorities.HIGH;
  } else if (req.headers['x-priority'] === 'medium') {
    return requestPriorities.MEDIUM;
  } else {
    return requestPriorities.LOW;
  }
}

server = createServer(app);
server.listen(config.lbPORT, () => {
  console.log(`Load balancer running on port ${config.lbPORT} (HTTP)`);
});

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);