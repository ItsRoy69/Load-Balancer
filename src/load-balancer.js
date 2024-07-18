import express from 'express';
import http from 'http';
import httpProxy from 'http-proxy';
import fs from 'fs';
import fetch from 'node-fetch';

const config = JSON.parse(fs.readFileSync('config/config.json', 'utf8'));

const app = express();

const proxy = httpProxy.createProxyServer();

let serverPool = [...config.be_servers];

let currentIndex = 0;

let beFailureStreak = 0;
let allBeFailureStreak = 0;

async function performHealthCheck(server) {
    for (let i = 0; i < config.be_ping_retries; i++) {
        try {
            const response = await fetch(`${server.domain}${config.be_ping_path}`, { timeout: 5000 });
            if (response.ok) {
                return true;
            }
        } catch (error) {
            console.error(`Health check failed for ${server.domain}:`, error);
        }
        await new Promise(resolve => setTimeout(resolve, config.be_ping_retry_delay));
    }
    return false;
}

async function periodicHealthChecks() {
    let allServersDown = true;
    for (const server of serverPool) {
        const isHealthy = await performHealthCheck(server);
        console.log(`Server ${server.domain} health status: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
        if (!isHealthy && !server.isDown) {
            server.isDown = true;
            removeServer(server);
            beFailureStreak++;
            if (beFailureStreak >= config.alert_on_be_failure_streak) {
                sendAlert('BE Server Down', `Server ${server.domain} is down`);
                beFailureStreak = 0;
            }
            if (config.enableSelfHealing) {
                attemptServerHeal(server);
            }
        } else if (isHealthy && server.isDown) {
            server.isDown = false;
            addServer(server);
            console.log(`Server ${server.domain} is back online`);
            beFailureStreak = 0;
        }
        if (isHealthy) {
            allServersDown = false;
        }
    }
    if (allServersDown) {
        allBeFailureStreak++;
        if (allBeFailureStreak >= config.alert_on_all_be_failure_streak) {
            sendAlert('All BE Servers Down', 'All backend servers are down');
            allBeFailureStreak = 0;
        }
    } else {
        allBeFailureStreak = 0;
    }
}

setInterval(periodicHealthChecks, config.health_check_interval);

async function sendAlert(type, message) {
    try {
        await fetch(config.send_alert_webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, message }),
        });
        console.log(`Alert sent: ${type} - ${message}`);
    } catch (error) {
        console.error('Failed to send alert:', error);
    }
}

async function attemptServerHeal(server) {
    console.log(`Attempting to heal server ${server.domain}...`);
    if (Math.random() < config._test_only_chances_of_healing_server) {
        server.isDown = false;
        addServer(server);
        console.log(`Server ${server.domain} has been healed and is back online`);
    } else {
        console.log(`Failed to heal server ${server.domain}`);
    }
}

function selectServer() {
    console.log(`Current server pool:`, serverPool.map(s => s.domain));
    console.log(`Current load balancing algorithm: ${config._lbAlgo}`);
    let selectedServer;
    switch (config._lbAlgo) {
        case 'rr':
            selectedServer = selectRoundRobinServer();
            break;
        case 'wrr':
            selectedServer = selectWeightedRoundRobinServer();
            break;
        default:
            console.warn(`Unknown algorithm: ${config._lbAlgo}. Falling back to round robin.`);
            selectedServer = selectRoundRobinServer();
    }
    console.log(`Selected server: ${selectedServer.domain}`);
    return selectedServer;
}

function selectRoundRobinServer() {
    console.log(`Round Robin - Current index: ${currentIndex}`);
    const server = serverPool[currentIndex];
    currentIndex = (currentIndex + 1) % serverPool.length;
    return server;
}

function selectWeightedRoundRobinServer() {
    const totalWeight = serverPool.reduce((sum, server) => sum + server.weight, 0);
    console.log(`Weighted Round Robin - Total weight: ${totalWeight}`);
    let random = Math.floor(Math.random() * totalWeight);
    console.log(`Random value: ${random}`);

    for (const server of serverPool) {
        if (random < server.weight) {
            return server;
        }
        random -= server.weight;
    }

    return serverPool[serverPool.length - 1];
}

function removeServer(server) {
    serverPool = serverPool.filter(s => s.domain !== server.domain);
    console.log(`Removed server ${server.domain} from the pool`);
}

function addServer(server) {
    if (!serverPool.some(s => s.domain === server.domain)) {
        serverPool.push(server);
        console.log(`Added server ${server.domain} to the pool`);
    }
}

async function retryRequest(req, res) {
    for (let i = 0; i < config.be_retries; i++) {
        const server = selectServer();
        if (!server) {
            return res.status(503).send('No available servers');
        }

        try {
            const targetUrl = new URL(req.url, server.domain);
            const proxyRes = await fetch(targetUrl, {
                method: req.method,
                headers: req.headers,
                body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
                redirect: 'manual'
            });

            res.status(proxyRes.status);
            for (const [key, value] of proxyRes.headers) {
                res.setHeader(key, value);
            }
            res.send(await proxyRes.buffer());
            return;
        } catch (error) {
            console.error(`Error proxying to ${server.domain}:`, error);
            server.isDown = true;
            removeServer(server);
            if (config.enableSelfHealing) {
                attemptServerHeal(server);
            }
        }
        await new Promise(resolve => setTimeout(resolve, config.be_retry_delay));
    }
    res.status(502).send('Bad Gateway');
}

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.use((req, res) => {
    retryRequest(req, res).catch(error => {
        console.error('Unhandled error in retryRequest:', error);
        res.status(500).send('Internal Server Error');
    });
});

const server = http.createServer(app);
server.listen(config.lbPORT, () => {
    console.log(`Load balancer running on port ${config.lbPORT}`);
});