/**
 * One-off MQTT connectivity test — connects to a broker, publishes a single
 * fake battery reading, then exits. Built for exactly this situation:
 * checking whether a Mosquitto broker on a VPS is actually reachable from
 * the public internet.
 *
 * IMPORTANT: run this from a machine that is NOT the VPS itself. A VPS
 * connecting to its own public IP often fails (or behaves differently) due
 * to hairpin NAT, so testing from the VPS's own SSH session doesn't tell you
 * whether a real device out on the internet can reach it. Run this from your
 * PC, phone (via a Node.js app / Termux), or any other machine instead.
 *
 * Usage:
 *   node scripts/test-mqtt-pub.js <broker-url> [deviceId] [username] [password]
 *
 * Examples:
 *   node scripts/test-mqtt-pub.js mqtt://103.91.205.91:1883 test1 battery_device "B7DAYQr4@Mzf"
 *   node scripts/test-mqtt-pub.js mqtt://103.91.205.91:1883
 *     (no username/password — only works if the broker allows anonymous connections)
 */
// This is a plain standalone Node/CommonJS script (run directly with
// `node`), not part of the Next.js app bundle, so it intentionally uses
// require() instead of ESM import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mqtt = require('mqtt');

const [, , brokerUrl, deviceId = 'test1', username, password] = process.argv;

if (!brokerUrl) {
  console.error('Usage: node scripts/test-mqtt-pub.js <broker-url> [deviceId] [username] [password]');
  console.error('Example: node scripts/test-mqtt-pub.js mqtt://103.91.205.91:1883 test1 battery_device "your-password"');
  process.exit(1);
}

console.log(`Connecting to ${brokerUrl} ...`);

const client = mqtt.connect(brokerUrl, {
  username: username || undefined,
  password: password || undefined,
  connectTimeout: 8000,
  reconnectPeriod: 0, // don't retry — this is a one-shot test
});

const giveUpTimer = setTimeout(() => {
  console.error('\nNo connection and no error after 10s — the broker is probably unreachable');
  console.error('(port blocked by a firewall, or nothing listening on that address/port).');
  process.exit(1);
}, 10000);

client.on('connect', () => {
  clearTimeout(giveUpTimer);
  console.log('Connected to broker.');
  const topic = `battery-central/${deviceId}/status`;
  const payload = JSON.stringify({ batteryLevel: 55, isCharging: true, platform: 'TEST' });
  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('Publish failed:', err.message);
      process.exitCode = 1;
    } else {
      console.log(`Published to "${topic}": ${payload}`);
      console.log('Check your MQTT worker logs / the dashboard for device "' + deviceId + '".');
    }
    client.end();
  });
});

client.on('error', (err) => {
  clearTimeout(giveUpTimer);
  console.error('Connection error:', err.message);
  client.end(true);
  process.exit(1);
});
