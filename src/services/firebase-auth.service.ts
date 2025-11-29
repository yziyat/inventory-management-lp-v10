import { Injectable, inject, signal } from '@angular/core';
import {
    Auth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    sendEmailVerification,
    User as FirebaseUser
} from '@angular/fire/auth';
import {
    Firestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
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

            // Send email verification
            await sendEmailVerification(firebaseUser);

            // Get the next display ID
            const nextDisplayId = await this.getNextDisplayId();

            // Create user document in Firestore
            const newUser: User = {
                id: firebaseUser.uid,
                displayId: nextDisplayId,
                username: userData.username,
                firstName: userData.firstName,
                lastName: userData.lastName,
                role: 'viewer', // Default role
                status: 'pending', // Default status
                emailVerified: false,
                password: '' // Don't store password in Firestore
            };

            await this.saveUserData(firebaseUser.uid, newUser);
            // Do not set currentUser here, force them to login after verification
            // this.currentUser.set(newUser); 

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

            // Check if email is verified
            if (!firebaseUser.emailVerified) {
                await this.signOut();
                throw new Error('Please verify your email address before logging in.');
            }

            // Check if account is approved
            if (userData.status === 'pending') {
                await this.signOut();
                throw new Error('Your account is pending approval by an administrator.');
            }

            if (userData.status === 'rejected') {
                await this.signOut();
                throw new Error('Your account has been rejected.');
            }

            if (userData.status === 'suspended') {
                await this.signOut();
                throw new Error('Your account has been suspended. Please contact the administrator.');
            }

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

        if (error.message === 'Please verify your email address before logging in.' ||
            error.message === 'Your account is pending approval by an administrator.' ||
            error.message === 'Your account has been rejected.' ||
            error.message === 'Your account has been suspended. Please contact the administrator.') {
            return error;
        }

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

    /**
     * Get the next display ID for a new user
     */
    private async getNextDisplayId(): Promise<number> {
        try {
            const usersRef = collection(this.firestore, 'users');
            const q = query(usersRef, orderBy('displayId', 'desc'), limit(1));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                return 1;
            }

            const lastUser = querySnapshot.docs[0].data() as User;
            return (lastUser.displayId || 0) + 1;
        } catch (error) {
            console.error('Error getting next display ID:', error);
            // Fallback: if query fails (e.g. missing index), try to get all users and find max
            try {
                const usersRef = collection(this.firestore, 'users');
                const querySnapshot = await getDocs(usersRef);
                if (querySnapshot.empty) return 1;

                const maxId = querySnapshot.docs.reduce((max, doc) => {
                    const data = doc.data() as User;
                    return Math.max(max, data.displayId || 0);
                }, 0);
                return maxId + 1;
            } catch (e) {
                console.error('Fallback error:', e);
                return 1;
            }
        }
    }
}
