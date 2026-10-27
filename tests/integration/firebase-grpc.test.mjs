import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { initializeApp, deleteApp } from 'firebase/app';
import {
    getAuth, connectAuthEmulator, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
    getFirestore, connectFirestoreEmulator, collection, addDoc, doc,
    getDocFromServer, getDocsFromServer, updateDoc, deleteDoc,
    onSnapshot, runTransaction, terminate,
} from 'firebase/firestore';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// Fail closed: this test must never connect to a real Firebase project.
const projectId = 'demo-ontime-grpc';
assert.equal(process.env.GCLOUD_PROJECT, projectId);
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');

test('Firebase Auth, task CRUD, subscriptions, isolation and Admin gRPC', { timeout: 60000 }, async () => {
    const app = initializeApp({ projectId, apiKey: 'demo-key', appId: 'demo-app' }, 'grpc-integration');
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    const admin = initializeAdmin({ projectId }, 'grpc-integration-admin');
    const adminDb = getAdminFirestore(admin);
    const email = `grpc-${Date.now()}@example.test`;
    const password = 'Emulator-only-password123!';
    try {
        const user = (await createUserWithEmailAndPassword(auth, email, password)).user;
        const uid = user.uid;
        await signOut(auth);
        assert.equal(auth.currentUser, null);
        await signInWithEmailAndPassword(auth, email, password);
        assert.equal(auth.currentUser.uid, uid);
        const tasks = collection(db, 'users', uid, 'tasks');
        const ref = await addDoc(tasks, { taskName: 'gRPC integration', completed: false });
        assert.equal((await getDocFromServer(ref)).data().taskName, 'gRPC integration');
        assert.equal((await getDocsFromServer(tasks)).size, 1);
        const observed = new Promise((resolve, reject) => {
            const timer = setTimeout(() => { stop(); reject(new Error('Subscription timeout')); }, 10000);
            const stop = onSnapshot(ref, { includeMetadataChanges: true }, snap => {
                if (!snap.metadata.fromCache && snap.data()?.completed === true) {
                    clearTimeout(timer); stop(); resolve();
                }
            }, error => { clearTimeout(timer); reject(error); });
        });
        await updateDoc(ref, { taskName: 'edited', completed: true });
        await observed;
        await runTransaction(db, async tx => {
            const current = await tx.get(ref);
            assert.equal(current.data().taskName, 'edited');
            tx.update(ref, { completed: false });
        });
        // Admin uses the Node gRPC transport through google-gax.
        const adminRef = adminDb.doc(ref.path);
        assert.equal((await adminRef.get()).data().completed, false);
        await adminRef.update({ description: 'Admin gRPC write' });
        assert.equal((await getDocFromServer(ref)).data().description, 'Admin gRPC write');
        await signOut(auth);
        await assert.rejects(getDocFromServer(ref), { code: 'permission-denied' });
        await createUserWithEmailAndPassword(auth, `other-${email}`, password);
        await assert.rejects(getDocFromServer(ref), { code: 'permission-denied' });
        await signOut(auth);
        await signInWithEmailAndPassword(auth, email, password);
        await deleteDoc(ref);
        assert.equal((await getDocFromServer(doc(db, ref.path))).exists(), false);
        assert.equal((await getDocsFromServer(tasks)).size, 0);
        // Check the transport actually resolved for the Web SDK's Node entry.
        const grpc = JSON.parse(await readFile(new URL('../../node_modules/@grpc/grpc-js/package.json', import.meta.url)));
        assert.equal(grpc.version, '1.14.6');
    } finally {
        await signOut(auth);
        await terminate(db);
        await adminDb.terminate();
        await deleteAdmin(admin);
        await deleteApp(app);
    }
});
