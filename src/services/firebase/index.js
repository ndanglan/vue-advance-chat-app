import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const config = {
  apiKey: 'AIzaSyALh8hV_cdiBBLFwohZzbymLtOYRA_vRTg',
  authDomain: 'vue-chat-app-95c93.firebaseapp.com',
  projectId: 'vue-chat-app-95c93',
  storageBucket: 'vue-chat-app-95c93.appspot.com',
  messagingSenderId: '656170722957',
  appId: '1:656170722957:web:f49e1bd4a18ba6f9ace4c4',
  measurementId: 'G-0MM1P7FVN3'
}

initializeApp(config)

export const firestoreDb = getFirestore()
export const realtimeDb = getDatabase()
export const storage = getStorage()
