// Paste the web app config from Firebase console → Project settings → Your apps.
// While apiKey is empty the app runs in DEMO MODE (sample data saved in this browser only).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA3b_yPbsDSTq3hISNjtdrQ5yE5shDbKvw',
  authDomain: 'heebee-workshops.firebaseapp.com',
  projectId: 'heebee-workshops',
  storageBucket: 'heebee-workshops.firebasestorage.app',
  messagingSenderId: '263958580807',
  appId: '1:263958580807:web:3c7b7751ffef7a6177eb62',
};

// Firestore database ID as created in the console (this project's is literally "default", not "(default)").
export const FIRESTORE_DATABASE_ID = 'default';

// Accounts allowed into /admin. Keep in sync with firestore.rules and storage.rules.
export const ADMIN_EMAILS = ['gavish@heebeecoffee.com'];

export const MAX_POSTS_PER_CHEF = 21;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const DEMO = !FIREBASE_CONFIG.apiKey;
