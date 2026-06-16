// src/services/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyD3Q3kH7Pyan5OqoqCzAXtsnm5G7r51Lqc',
  authDomain: 'little-giant-pos.firebaseapp.com',
  projectId: 'little-giant-pos',
  storageBucket: 'little-giant-pos.firebasestorage.app',
  messagingSenderId: '610984038565',
  appId: '1:610984038565:web:5e33ad584405520c6e3d4c',
  databaseURL: 'https://little-giant-pos-default-rtdb.asia-southeast1.firebasedatabase.app',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);
