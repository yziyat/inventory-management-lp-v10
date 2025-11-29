import { Injectable, inject, signal } from '@angular/core';
import {
    Auth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    User as FirebaseUser
} from '@angular/fire/auth';
import {
    Firestore,
    doc,
    setDoc,
    getDoc,
    DocumentReference
} from '@angular/fire/firestore';
import { User, UserRole } from '../models/user.model';

@Injectable({
    providedIn: 'root'
})
export class FirebaseAuthService {
    private auth = inject(Auth);
    private firestore = inject(Firestore);

    currentFirebaseUser = signal<FirebaseUser | null>(null);
    currentUser = signal<User | null>(null);
    isLoading = signal(true);

    constructor() {
        // Listen to Firebase auth state changes
        onAuthStateChanged(this.auth, async (firebaseUser) => {
            this.currentFirebaseUser.set(firebaseUser);

            if (firebaseUser) {
                // Load user data from Firestore
                const userData = await this.getUserData(firebaseUser.uid);
                this.currentUser.set(userData);
            } else {
                this.currentUser.set(null);
            }

            this.isLoading.set(false);
        });
    }

    /**
     * Sign up a new user with email and password
     */
    async signUp(email: string, password: string, userData: Omit<User, 'id'>): Promise<User> {
        try {
            // Create Firebase auth user
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const firebaseUser = userCredential.user;

            // Create user document in Firestore
            const newUser: User = {
                id: firebaseUser.uid,
                username: userData.username,
                firstName: userData.firstName,
                lastName: userData.lastName,
                role: userData.role,
                password: '' // Don't store password in Firestore
            };

            await this.saveUserData(firebaseUser.uid, newUser);
            this.currentUser.set(newUser);

            return newUser;
        } catch (error: any) {
            console.error('Sign up error:', error);
            throw this.handleAuthError(error);
        }
    }

    /**
     * Sign in with email and password
     */
    async signIn(email: string, password: string): Promise<User> {
        try {
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            const firebaseUser = userCredential.user;

            // Load user data from Firestore
            const userData = await this.getUserData(firebaseUser.uid);
            this.currentUser.set(userData);

            return userData;
        } catch (error: any) {
            console.error('Sign in error:', error);
            throw this.handleAuthError(error);
        }
    }

    /**
     * Sign out current user
     */
    async signOut(): Promise<void> {
        try {
            await firebaseSignOut(this.auth);
            this.currentUser.set(null);
            this.currentFirebaseUser.set(null);
        } catch (error: any) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    /**
     * Get user data from Firestore
     */
    private async getUserData(uid: string): Promise<User> {
        const userDocRef = doc(this.firestore, `users/${uid}`);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            throw new Error('User data not found');
        }

        return userDoc.data() as User;
    }

    /**
     * Save user data to Firestore
     */
    private async saveUserData(uid: string, userData: User): Promise<void> {
        const userDocRef = doc(this.firestore, `users/${uid}`);
        await setDoc(userDocRef, userData);
    }

    /**
     * Handle Firebase auth errors
     */
    private handleAuthError(error: any): Error {
        let message = 'Authentication error';

        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'This email is already in use';
                break;
            case 'auth/invalid-email':
                message = 'Invalid email address';
                break;
            case 'auth/operation-not-allowed':
                message = 'Operation not allowed';
                break;
            case 'auth/weak-password':
                message = 'Password is too weak';
                break;
            case 'auth/user-disabled':
                message = 'This account has been disabled';
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                message = 'Invalid email or password';
                break;
            case 'auth/invalid-credential':
                message = 'Invalid credentials';
                break;
            default:
                message = error.message || 'Authentication error';
        }

        return new Error(message);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.currentUser() !== null;
    }

    /**
     * Check if user is admin
     */
    isAdmin(): boolean {
        return this.currentUser()?.role === 'admin';
    }

    /**
     * Check if user is editor or admin
     */
    isEditor(): boolean {
        const role = this.currentUser()?.role;
        return role === 'admin' || role === 'editor';
    }
}
