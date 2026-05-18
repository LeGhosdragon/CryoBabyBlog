importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyB5rMiSxH1ugXKBQAQsSHyKh5zhUubEp6g",
    authDomain: "cosmic-pickle.firebaseapp.com",
    projectId: "cosmic-pickle",
    storageBucket: "cosmic-pickle.firebasestorage.app",
    messagingSenderId: "309366498590",
    appId: "1:309366498590:web:6727d781ba23fe657fd50f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log("Background message:", payload);

    self.registration.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: "/icons/icon.webp"
    });
});