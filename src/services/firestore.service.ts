import { Injectable, inject } from '@angular/core';
import {
    Firestore,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    CollectionReference,
    DocumentData,
    onSnapshot,
    Unsubscribe
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class FirestoreService {
    private firestore = inject(Firestore);

    /**
     * Get all documents from a collection
     */
    async getCollection<T>(collectionName: string): Promise<T[]> {
        const collectionRef = collection(this.firestore, collectionName);
        const snapshot = await getDocs(collectionRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    }

    /**
     * Get a single document by ID
     */
    async getDocument<T>(collectionName: string, id: string): Promise<T | null> {
        const docRef = doc(this.firestore, collectionName, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as T;
        }
        return null;
    }

    /**
     * Add a new document to a collection (auto-generated ID)
     */
    async addDocument<T>(collectionName: string, data: Omit<T, 'id'>): Promise<string> {
        const collectionRef = collection(this.firestore, collectionName);
        const docRef = await addDoc(collectionRef, data);
        return docRef.id;
    }

    /**
     * Set a document with a specific ID (creates or overwrites)
     */
    async setDocument<T>(collectionName: string, id: string, data: T): Promise<void> {
        const docRef = doc(this.firestore, collectionName, id);
        await setDoc(docRef, data);
    }

    /**
     * Update an existing document
     */
    async updateDocument<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
        const docRef = doc(this.firestore, collectionName, id);
        await updateDoc(docRef, data as DocumentData);
    }

    /**
     * Delete a document
     */
    async deleteDocument(collectionName: string, id: string): Promise<void> {
        const docRef = doc(this.firestore, collectionName, id);
        await deleteDoc(docRef);
    }

    /**
     * Listen to real-time updates on a collection
     */
    onCollectionSnapshot<T>(
        collectionName: string,
        callback: (data: T[]) => void
    ): Unsubscribe {
        const collectionRef = collection(this.firestore, collectionName);

        return onSnapshot(collectionRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as T));
            callback(data);
        });
    }

    /**
     * Listen to real-time updates on a single document
     */
    onDocumentSnapshot<T>(
        collectionName: string,
        id: string,
        callback: (data: T | null) => void
    ): Unsubscribe {
        const docRef = doc(this.firestore, collectionName, id);

        return onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() } as T);
            } else {
                callback(null);
            }
        });
    }

    /**
     * Query documents with filters
     */
    async queryCollection<T>(
        collectionName: string,
        ...queryConstraints: any[]
    ): Promise<T[]> {
        const collectionRef = collection(this.firestore, collectionName);
        const q = query(collectionRef, ...queryConstraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    }
}
