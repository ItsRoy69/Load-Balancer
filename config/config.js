import dotenv from 'dotenv';

dotenv.config();

const config = {
  lbPORT: parseInt(process.env.LB_PORT, 10) || 80,
  _lbAlgo: process.env.LB_ALGO || 'rr',
  be_servers: JSON.parse(process.env.BE_SERVERS || '[]'),
  be_retries: parseInt(process.env.BE_RETRIES, 10) || 3,
  be_retry_delay: parseInt(process.env.BE_RETRY_DELAY, 10) || 200,
  be_ping_path: process.env.BE_PING_PATH || '/ping',
  be_ping_retries: parseInt(process.env.BE_PING_RETRIES, 10) || 3,
  be_ping_retry_delay: parseInt(process.env.BE_PING_RETRY_DELAY, 10) || 500,
  health_check_interval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000,
  send_alert_webhook: process.env.SEND_ALERT_WEBHOOK,
  alert_on_be_failure_streak: parseInt(process.env.ALERT_ON_BE_FAILURE_STREAK, 10) || 3,
  alert_on_all_be_failure_streak: parseInt(process.env.ALERT_ON_ALL_BE_FAILURE_STREAK, 10) || 3,
  enableSelfHealing: process.env.ENABLE_SELF_HEALING === 'true',
  _test_only_chances_of_healing_server: parseFloat(process.env.TEST_ONLY_CHANCES_OF_HEALING_SERVER) || 0.5,
  enableStickySession: process.env.ENABLE_STICKY_SESSION === 'true',
  stickySessionCookieName: process.env.STICKY_SESSION_COOKIE_NAME || 'SERVERID',
  stickySessionCookieMaxAge: parseInt(process.env.STICKY_SESSION_COOKIE_MAX_AGE, 10) || 3600000,
  enableCache: process.env.ENABLE_CACHE === 'true',
  cacheTTL: parseInt(process.env.CACHE_TTL, 10) || 300,
  contentBasedRouting: JSON.parse(process.env.CONTENT_BASED_ROUTING || '[]'),

  regions: [
    {
      name: 'us-east',
      servers: [
        { domain: process.env.US_EAST_SERVER_1, weight: 1 },
        { domain: process.env.US_EAST_SERVER_2, weight: 1 },
      ],
    },
    {
      name: 'us-west',
      servers: [
        { domain: process.env.US_WEST_SERVER_1, weight: 1 },
        { domain: process.env.US_WEST_SERVER_2, weight: 1 },
      ],
    },
    {
      name: 'eu-west',
      servers: [
        { domain: process.env.EU_WEST_SERVER_1, weight: 1 },
        { domain: process.env.EU_WEST_SERVER_2, weight: 1 },
      ],
    },
    {
      name: 'eu-central',
      servers: [
        { domain: process.env.EU_CENTRAL_SERVER_1, weight: 1 },
        { domain: process.env.EU_CENTRAL_SERVER_2, weight: 1 },
      ],
    },
    {
      name: 'ap-southeast',
      servers: [
        { domain: process.env.AP_SOUTHEAST_SERVER_1, weight: 1 },
        { domain: process.env.AP_SOUTHEAST_SERVER_2, weight: 1 },
      ],
    },
    {
      name: 'ap-northeast',
      servers: [
        { domain: process.env.AP_NORTHEAST_SERVER_1, weight: 1 },
        { domain: process.env.AP_NORTHEAST_SERVER_2, weight: 1 },
      ],
    },
    {
      name: 'sa-east',
      servers: [
        { domain: process.env.SA_EAST_SERVER_1, weight: 1 },
        { domain: process.env.SA_EAST_SERVER_2, weight: 1 },
      ],
    },
  ],
  defaultRegion: process.env.DEFAULT_REGION || 'us-east',
  enableGeoRouting: process.env.ENABLE_GEO_ROUTING === 'true',
  geoRoutingService: process.env.GEO_ROUTING_SERVICE,
  enableLatencyBasedRouting: process.env.ENABLE_LATENCY_BASED_ROUTING === 'true',
  latencyCheckInterval: parseInt(process.env.LATENCY_CHECK_INTERVAL, 10) || 300000,
  enableRateLimit: process.env.ENABLE_RATE_LIMIT === 'true',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 900000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  enableSSL: process.env.ENABLE_SSL === 'true',
  sslCertPath: process.env.SSL_CERT_PATH,
  sslKeyPath: process.env.SSL_KEY_PATH,

  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'json',

  workerProcesses: parseInt(process.env.WORKER_PROCESSES, 10) || 1,

  enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER === 'true',
  circuitBreakerErrorThreshold: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD, 10) || 50,
  circuitBreakerResetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 10) || 30000,

  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,

  customErrorPages: JSON.parse(process.env.CUSTOM_ERROR_PAGES || '{}'),

  enableWebSocket: process.env.ENABLE_WEBSOCKET === 'true',

  enableCORS: process.env.ENABLE_CORS === 'true',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  corsMethods: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE',

  enableCompression: process.env.ENABLE_COMPRESSION === 'true',
  compressionLevel: parseInt(process.env.COMPRESSION_LEVEL, 10) || 6,

  ipWhitelist: process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [],
  ipBlacklist: process.env.IP_BLACKLIST ? process.env.IP_BLACKLIST.split(',') : [],

  enableRequestTransform: process.env.ENABLE_REQUEST_TRANSFORM === 'true',
  enableResponseTransform: process.env.ENABLE_RESPONSE_TRANSFORM === 'true',

  enableApiKeyAuth: process.env.ENABLE_API_KEY_AUTH === 'true',
  apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : [],

  enableMonitoring: process.env.ENABLE_MONITORING === 'true',
  monitoringPath: process.env.MONITORING_PATH || '/monitoring',

  enableDynamicConfig: process.env.ENABLE_DYNAMIC_CONFIG === 'true',
  dynamicConfigInterval: parseInt(process.env.DYNAMIC_CONFIG_INTERVAL, 10) || 60000,

  gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT, 10) || 30000,

  healthScoreThreshold: parseInt(process.env.HEALTH_SCORE_THRESHOLD, 10) || 30,
  systemLoadThreshold: parseInt(process.env.SYSTEM_LOAD_THRESHOLD, 10) || 80,
  enablePrioritization: process.env.ENABLE_PRIORITIZATION === 'true',
  lowPriorityMaxLoad: parseInt(process.env.LOW_PRIORITY_MAX_LOAD, 10) || 80,
};

export default config;