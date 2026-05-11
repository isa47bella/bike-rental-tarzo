const webpush = require('web-push');
const supabase = require('./supabase');

let vapidConfigured = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:arfantabikerental@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
}

async function sendPushToAll(payload) {
  if (!vapidConfigured) return { skipped: true, reason: 'VAPID keys not configured' };
  let subs;
  try {
    const { data } = await supabase.from('push_subscriptions').select('endpoint, subscription').eq('active', true);
    subs = data || [];
  } catch (_) { return { skipped: true, reason: 'push_subscriptions table missing' }; }

  if (subs.length === 0) return { sent: 0 };
  const payloadStr = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map(row => webpush.sendNotification(JSON.parse(row.subscription), payloadStr)
      .catch(async err => {
        if (err.statusCode === 410) {
          await supabase.from('push_subscriptions').update({ active: false }).eq('endpoint', row.endpoint);
        }
        throw err;
      })
    )
  );
  const sent = results.filter(r => r.status === 'fulfilled').length;
  return { sent, total: subs.length };
}

module.exports = { sendPushToAll, vapidConfigured: () => vapidConfigured };
