importScripts('https://www.gstatic.com/firebasejs/9.24.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.24.0/firebase-messaging-compat.js');

// ✅ Same config
firebase.initializeApp({
  apiKey: "AIzaSyAYq4RhrbHNoJlX4TP0PonQNuPGE5-nc58",
  authDomain: "first-project-4ba00.firebaseapp.com",
  databaseURL: "https://first-project-4ba00-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "first-project-4ba00",
  storageBucket: "first-project-4ba00.appspot.com",
  messagingSenderId: "679004245122",
  appId: "1:679004245122:web:2b610906456030f74cf89b",
  measurementId: "G-MPP649FMMM"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/Websites-/icon.png' // optional
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
