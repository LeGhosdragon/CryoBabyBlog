importScripts("https://gstatic.com");
importScripts("https://gstatic.com");

firebase.initializeApp({
  apiKey: "AIzaSyB5rMiSxH1ugXKBQAQsSHyKh5zhUubEp6g",
  authDomain: "cosmic-pickle.firebaseapp.com",
  projectId: "cosmic-pickle",
  messagingSenderId: "309366498590",
  appId: "1:309366498590:web:6727d781ba23fe657fd50f"
});

const messaging = firebase.messaging();

// Your original Firebase wrapper (Works on Chrome/Firefox/Android)
messaging.onBackgroundMessage((payload) => {
  console.log("BG message", payload);
  self.registration.showNotification(
    payload?.notification?.title || "Notification",
    {
      body: payload?.notification?.body || "",
      icon: "icons/icon.webp"
    }
  );
});

// =========================================================
// ADD THIS: LOW-LEVEL SAFARI COMPATIBILITY LAYER
// =========================================================
self.addEventListener("push", (event) => {
  let title = "Notification";
  let body = "";

  if (event.data) {
    try {
      // Parse the incoming JSON structure from Firebase
      const rawData = event.data.json();
      title = rawData.notification?.title || rawData.data?.title || title;
      body = rawData.notification?.body || rawData.data?.body || body;
    } catch (e) {
      // Fallback if Firebase sends plain text
      body = event.data.text();
    }
  }

  const options = {
    body: body,
    icon: "icons/icon.webp"
  };

  // Crucial: event.waitUntil forces Safari to keep the worker 
  // alive until the visual notification banner finishes rendering.
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));


