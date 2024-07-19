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
};

export default config;