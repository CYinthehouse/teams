/* Firebase Messaging service worker for KoreanLearnin Teams.
   This file MUST live at /teams/firebase-messaging-sw.js — the SW scope
   defaults to its location, and the firebase-messaging SDK looks for it
   there unless explicitly told otherwise.

   IMPORTANT: When you change anything in this file, bump SW_VERSION so
   browsers force-update the service worker instead of serving the cached
   old version. iOS in particular caches SWs aggressively.
*/
const SW_VERSION = 'fcm-sw-v1';

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Same config as the main app — values are public, restricted by Firebase
// security rules + referrer / API-key restrictions in Google Cloud.
firebase.initializeApp({
  apiKey: 'AIzaSyBismf9dfYPRPZdimmhZyqxecQnwSL4O8M',
  authDomain: 'koreanlearnin-teams.firebaseapp.com',
  projectId: 'koreanlearnin-teams',
  storageBucket: 'koreanlearnin-teams.firebasestorage.app',
  messagingSenderId: '437370841898',
  appId: '1:437370841898:web:6c329a30956d4170a60c53',
});

const messaging = firebase.messaging();

/* Background message handler.
   Fires when the app is NOT in the foreground (tab closed, phone locked,
   different tab focused). Foreground messages are handled by onMessage in
   the main page, not here.

   Cloud Functions send pushes with BOTH a `notification` block AND a
   `data` block. The notification block makes iOS auto-display the message
   (Apple won't fire pushes without one in most cases). The data block
   carries our routing info (taskId, kind) so the click handler can deep-
   link the user.

   On Android/Chrome the SDK will display the notification block
   automatically too — but we override here so we can attach our icon,
   badge, click action, etc. */
messaging.onBackgroundMessage((payload) => {
  const notif = payload.notification || {};
  const data = payload.data || {};

  const title = notif.title || data.title || 'KoreanLearnin Teams';
  const body  = notif.body  || data.body  || '';

  const options = {
    body,
    icon: '/teams/icon-192.png',
    badge: '/teams/icon-192.png',
    // Tag groups notifications by kind so e.g. multiple class reminders
    // collapse into one row instead of stacking. Pokes use the poke id so
    // each one is distinct (you can be poked by multiple people).
    tag: data.tag || data.kind || 'klrn-teams',
    // Vibration pattern (Android only; iOS ignores). 200ms buzz, 100 gap,
    // 200 buzz — distinctive enough to recognize without a full second of
    // vibration that drives people crazy.
    vibrate: [200, 100, 200],
    // We attach data so notificationclick can route to the right place.
    data: {
      url: data.url || '/teams/',
      taskId: data.taskId || null,
      kind: data.kind || null,
      ts: Date.now(),
    },
    // requireInteraction=true keeps the notification visible on desktop
    // until the user dismisses it — important for class reminders that
    // someone might miss if it auto-disappears in 5 seconds. iOS / Android
    // ignore this flag (they always require interaction).
    requireInteraction: data.kind === 'class_reminder' || data.kind === 'attendance_contact',
  };

  return self.registration.showNotification(title, options);
});

/* Click handler: open the app, or focus an already-open window, and
   navigate to the right task if a taskId was attached. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/teams/';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    // Try to focus an already-open Teams window (any URL under /teams/).
    for (const client of clientList) {
      if (client.url.includes('/teams/') && 'focus' in client) {
        // Send a message so the page can deep-link to the task without a
        // full reload. The page listens for this in the main script.
        client.postMessage({
          type: 'notification-click',
          taskId: data.taskId || null,
          kind: data.kind || null,
        });
        return client.focus();
      }
    }

    // Otherwise open a fresh window.
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});

/* Force the new SW to take over immediately on update — without this,
   you'd have to close every tab to pick up SW changes. */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
