/**
 * MQTT background worker (Feature 10).
 *
 * Next.js Route Handlers are request/response — they can't hold a
 * long-lived MQTT subscription open. This script runs as a separate
 * always-on Node process next to (or on the same box as) the Next.js app:
 * it subscribes to a Mosquitto broker and forwards every message to the
 * existing POST /api/battery/update endpoint, reusing all of that route's
 * validation, debounce, notification, and logging logic instead of
 * duplicating it here.
 *
 * Run it with:
 *   npm run mqtt
 * or as a systemd service / pm2 process / docker-compose service alongside
 * `npm start`. See README.md for the full Mosquitto + VPS setup guide.
 *
 * Environment variables:
 *   MQTT_BROKER_URL   mqtt://<vps-ip>:1883   (required)
 *   MQTT_USERNAME      broker username        (optional)
 *   MQTT_PASSWORD      broker password        (optional)
 *   MQTT_TOPIC         topic filter to subscribe to (default: "battery-central/+/status")
 *   APP_BASE_URL       base URL of the running Next.js app (default: "http://localhost:3000")
 *   API_SECRET_KEY     API key sent as x-api-key when calling /api/battery/update
 *                       (falls back to the system settings' api_secret_key if unset —
 *                        set this explicitly for the worker in production)
 *
 * Expected MQTT payload (JSON), published to e.g. "battery-central/<deviceId>/status":
 *   { "batteryLevel": 87, "isCharging": true, "platform": "ESP32", "lat": 13.75, "lng": 100.5 }
 *
 * The device ID can come either from the topic itself (last-but-one segment
 * of "battery-central/<deviceId>/status") or from a "deviceId" field in the
 * payload — the payload field wins if both are present.
 */

// This is a plain standalone Node/CommonJS worker script (run via `npm run
// mqtt`), not part of the Next.js app bundle, so it intentionally uses
// require() instead of ESM import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mqtt = require('mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME || undefined;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || undefined;
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'battery-central/+/status';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const API_SECRET_KEY = process.env.API_SECRET_KEY || '';

if (!BROKER_URL) {
  console.error('[mqtt-listener] Missing MQTT_BROKER_URL environment variable. Example: mqtt://your-vps-ip:1883');
  process.exit(1);
}

function extractDeviceIdFromTopic(topic) {
  // "battery-central/<deviceId>/status" -> "<deviceId>"
  const parts = topic.split('/');
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

async function forwardToApi(deviceId, payload) {
  const body = {
    deviceId,
    batteryLevel: payload.batteryLevel ?? payload.battery_level ?? payload.level ?? payload.battery,
    isCharging: payload.isCharging ?? payload.is_charging ?? payload.charging ?? payload.plugged,
    platform: payload.platform,
    lat: payload.lat ?? payload.latitude,
    lng: payload.lng ?? payload.longitude,
  };

  const res = await fetch(`${APP_BASE_URL}/api/battery/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_SECRET_KEY ? { 'x-api-key': API_SECRET_KEY } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[mqtt-listener] API rejected update for ${deviceId}: ${res.status} ${text}`);
  } else {
    console.log(`[mqtt-listener] Forwarded update for ${deviceId} (${res.status})`);
  }
}

console.log(`[mqtt-listener] Connecting to ${BROKER_URL} ...`);
const client = mqtt.connect(BROKER_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  reconnectPeriod: 5000,
  clientId: `battery-central-worker-${Math.random().toString(16).slice(2, 10)}`,
});

client.on('connect', () => {
  console.log('[mqtt-listener] Connected to broker.');
  client.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
    if (err) {
      console.error('[mqtt-listener] Failed to subscribe:', err);
    } else {
      console.log(`[mqtt-listener] Subscribed to "${MQTT_TOPIC}"`);
    }
  });
});

client.on('reconnect', () => {
  console.log('[mqtt-listener] Reconnecting to broker...');
});

client.on('error', (err) => {
  console.error('[mqtt-listener] Connection error:', err.message);
});

client.on('message', async (topic, messageBuffer) => {
  let payload;
  try {
    payload = JSON.parse(messageBuffer.toString('utf8'));
  } catch {
    console.error(`[mqtt-listener] Ignoring non-JSON message on "${topic}"`);
    return;
  }

  const deviceId = payload.deviceId || payload.device_id || payload.id || extractDeviceIdFromTopic(topic);
  if (!deviceId) {
    console.error(`[mqtt-listener] Could not determine deviceId for message on "${topic}"`);
    return;
  }

  try {
    await forwardToApi(deviceId, payload);
  } catch (err) {
    console.error(`[mqtt-listener] Failed to forward message for ${deviceId}:`, err);
  }
});

process.on('SIGINT', () => {
  console.log('[mqtt-listener] Shutting down...');
  client.end(false, {}, () => process.exit(0));
});
