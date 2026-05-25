importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB5rMiSxH1ugXKBQAQsSHyKh5zhUubEp6g",
  authDomain: "cosmic-pickle.firebaseapp.com",
  projectId: "cosmic-pickle",
  messagingSenderId: "309366498590",
  appId: "1:309366498590:web:6727d781ba23fe657fd50f"
});

const messaging = firebase.messaging();

// 1. Keeps compatibility for Chrome, Firefox, and Android
messaging.onBackgroundMessage((payload) => {
  console.log("BG message", payload);
  self.registration.showNotification(
    payload?.notification?.title || "Notification",
    {
      body: payload?.notification?.body || "",
      icon: "/icon/icon.webp" // Corrected folder path to singular "icon"
    }
  );
});

// =========================================================
// 2. CRUCIAL SAFARI FIX: NATIVE PUSH EVENT LISTENER
// =========================================================
self.addEventListener("push", (event) => {
  let title = "Notification";
  let body = "";

  if (event.data) {
    try {
      // Safely parse the raw incoming JSON data payload from Firebase
      const rawData = event.data.json();
      title = rawData.notification?.title || rawData.data?.title || title;
      body = rawData.notification?.body || rawData.data?.body || body;
    } catch (e) {
      // Fallback if the payload arrives as plain text
      body = event.data.text();
    }
  }

  const options = {
    body: body,
    icon: "/icons/icon.webp" // Corrected folder path to singular "icon"
  };

  // event.waitUntil is mandatory on iOS. It forces Safari to stay 
  // awake until the notification visual banner completely renders.
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// =========================================================
// 3. SERVICE WORKER LIFECYCLE MANAGERS
// =========================================================
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
