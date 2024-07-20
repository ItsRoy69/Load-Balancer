import express from "express";
import http from "http";
import httpProxy from "http-proxy";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import NodeCache from "node-cache";
import bodyParser from "body-parser";
import crypto from "crypto";
import config from "../config/config.js";

const app = express();

const proxy = httpProxy.createProxyServer();

let currentIndex = 0;

let beFailureStreak = 0;
let allBeFailureStreak = 0;

const cache = new NodeCache({
  stdTTL: config.cacheTTL,
  checkperiod: config.cacheTTL * 2,
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);
app.use(cookieParser());
app.use(bodyParser.json());

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

async function performHealthCheck(server) {
  for (let i = 0; i < config.be_ping_retries; i++) {
    try {
      const response = await fetch(`${server.domain}${config.be_ping_path}`, {
        timeout: 5000,
      });
      if (response.ok) {
        return true;
      }
    } catch (error) {
      console.error(`Health check failed for ${server.domain}:`, error);
    }
    await new Promise((resolve) =>
      setTimeout(resolve, config.be_ping_retry_delay)
    );
  }
  return false;
}

async function periodicHealthChecks() {
  for (const region of config.regions) {
    let allRegionServersDown = true;
    for (const server of region.servers) {
      const isHealthy = await performHealthCheck(server);
      console.log(
        `Server ${server.domain} in region ${region.name} health status: ${
          isHealthy ? "Healthy" : "Unhealthy"
        }`
      );
      if (!isHealthy && !server.isDown) {
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
      } else if (isHealthy && server.isDown) {
        server.isDown = false;
        console.log(
          `Server ${server.domain} in region ${region.name} is back online`
        );
        beFailureStreak = 0;
      }
      if (isHealthy) {
        allRegionServersDown = false;
      }
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

  const regionServers = regionConfig.servers.filter((s) => !s.isDown);

  if (regionServers.length === 0) {
    console.error(`No available servers in region ${region}`);
    return null;
  }

  const contentBasedRoute = findContentBasedRoute(req);
  if (contentBasedRoute) {
    const server = regionServers.find(
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
      const server = regionServers.find((s) => s.domain === serverId);
      if (server) {
        console.log(`Sticky session - Using server: ${server.domain}`);
        return server;
      }
    }
  }

  console.log(
    `Current server pool in region ${region}:`,
    regionServers.map((s) => s.domain)
  );
  console.log(`Current load balancing algorithm: ${config._lbAlgo}`);

  let selectedServer;
  if (config.enableLatencyBasedRouting) {
    selectedServer = selectLatencyBasedServer(regionServers);
  } else {
    switch (config._lbAlgo) {
      case "rr":
        selectedServer = selectRoundRobinServer(regionServers);
        break;
      case "wrr":
        selectedServer = selectWeightedRoundRobinServer(regionServers);
        break;
      default:
        console.warn(
          `Unknown algorithm: ${config._lbAlgo}. Falling back to round robin.`
        );
        selectedServer = selectRoundRobinServer(regionServers);
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

      logRequest(requestId, "Selected server", {
        server: server.domain,
        region: region.name,
        attempt: i + 1,
      });

      try {
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
        return;
      } catch (error) {
        logRequest(requestId, "Error proxying to backend", {
          server: server.domain,
          region: region.name,
          error: error.message,
        });
        server.isDown = true;
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
  res.status(502).send("Bad Gateway");
  logRequest(requestId, "Request failed after all retries", {
    duration: Date.now() - startTime,
    status: 502,
  });
}

app.get("/health", (req, res) => {
  const requestId = generateRequestId();
  logRequest(requestId, "Health check request");
  res.status(200).send("OK");
  logRequest(requestId, "Health check response sent");
});

app.use((req, res) => {
  const requestId = generateRequestId();
  logRequest(requestId, "Received request", {
    method: req.method,
    url: req.url,
    headers: req.headers,
  });
  retryRequest(req, res).catch((error) => {
    console.error("Unhandled error in retryRequest:", error);
    logRequest(requestId, "Unhandled error", { error: error.message });
    res.status(500).send("Internal Server Error");
  });
});

http.createServer(app).listen(config.lbPORT, () => {
  console.log(`Load balancer running on port ${config.lbPORT} (HTTP)`);
});
