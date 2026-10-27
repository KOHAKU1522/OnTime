import assert from "node:assert/strict";
import { test } from "node:test";
import { watchTasks } from "../src/utils/taskSubscription.js";
import { assertFirebaseConfig } from "../src/utils/firebaseConfig.js";

function harness() {
    const states = [];
    const errors = [];
    let next, fail, timeout;
    let detached = false;
    const stop = watchTasks({
        listen: (success, error) => { next = success; fail = error; return () => { detached = true; }; },
        onState: state => states.push(state),
        onError: error => errors.push(error.code),
        schedule: callback => { timeout = callback; return callback; },
        cancel: callback => { if (timeout === callback) timeout = null; },
    });
    return {
        states, errors, stop,
        next: (rows, fromCache = false) => next({
            metadata: { fromCache },
            docs: rows.map(([id, data]) => ({ id, data: () => data })),
        }),
        fail: code => fail({ code }),
        timeout: () => timeout?.(),
        detached: () => detached,
        current: () => states.at(-1),
    };
}

test("cache cannot establish zero tasks; metadata-only server confirmation can", () => {
    const h = harness();
    h.next([], true);
    assert.equal(h.current().status, "loading");
    h.next([]);
    assert.equal(h.current().status, "ready");
    assert.deepEqual(h.current().tasks, []);
    h.stop();
});

test("permission failure stays an error and retry creates a fresh subscription", () => {
    const h = harness();
    h.fail("permission-denied");
    assert.equal(h.current().status, "error");
    h.next([]); // A terminated listener cannot clear the error.
    assert.equal(h.current().status, "error");
    assert.deepEqual(h.errors, ["permission-denied"]);
    h.stop();
    const retry = harness();
    retry.next([["one", { taskName: "fixture" }]]);
    assert.equal(retry.current().status, "ready");
    assert.equal(retry.current().tasks.length, 1);
    retry.stop();
});

test("timeout exposes connection failure and the live listener can recover", () => {
    const h = harness();
    h.next([], true);
    h.timeout();
    assert.equal(h.current().status, "error");
    assert.deepEqual(h.errors, ["deadline-exceeded"]);
    h.next([["one", {}]]);
    assert.equal(h.current().status, "ready");
    h.stop();
});

test("disconnect after a successful empty result no longer claims zero tasks", () => {
    const h = harness();
    h.next([]);
    h.next([], true);
    assert.equal(h.current().status, "loading");
    h.timeout();
    assert.equal(h.current().status, "error");
    h.stop();
});

test("snapshot updates reflect add, edit and delete; document ID is authoritative", () => {
    const h = harness();
    h.next([["one", { id: "wrong", taskName: "before" }]]);
    assert.equal(h.current().tasks[0].id, "one");
    h.next([["one", { taskName: "after" }], ["two", {}]]);
    assert.equal(h.current().tasks[0].taskName, "after");
    assert.equal(h.current().tasks.length, 2);
    h.next([["two", {}]]);
    assert.equal(h.current().tasks.length, 1);
    h.stop();
});

test("cleanup detaches and ignores late callbacks from the old account", () => {
    const h = harness();
    h.stop();
    h.next([["old-account", {}]]);
    h.fail("permission-denied");
    h.timeout();
    assert.equal(h.detached(), true);
    assert.equal(h.states.length, 1);
    assert.deepEqual(h.errors, []);
});

test("synchronous setup failure becomes an error state", () => {
    const states = [];
    const stop = watchTasks({
        listen: () => { throw { code: "invalid-argument" }; },
        onState: state => states.push(state), onError: () => {},
    });
    assert.equal(states.at(-1).status, "error");
    stop();
});

test("missing Firebase configuration reports variable names without values", () => {
    assert.throws(() => assertFirebaseConfig({ VITE_API_KEY: "private-test-marker" }), error => {
        assert.ok(error.message.includes("VITE_PROJECT_ID"));
        assert.ok(!error.message.includes("private-test-marker"));
        return true;
    });
    assert.doesNotThrow(() => assertFirebaseConfig({
        VITE_API_KEY: "test", VITE_AUTH_DOMAIN: "test", VITE_PROJECT_ID: "test", VITE_APP_ID: "test",
    }));
});
