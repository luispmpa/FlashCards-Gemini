import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Authentication helpers
const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (e: any) {
        if (e.code === 'auth/cancelled-popup-request') {
           console.log('Popup cancelled');
           return;
        }
        console.error("Login failed", e);
        throw e;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (e) {
        console.error("Logout failed", e);
    }
};

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
