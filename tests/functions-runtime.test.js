import assert from "node:assert/strict";
import { before, test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { buildFunctions } from "../scripts/build-functions.mjs";

const run = promisify(execFile);
before(() => buildFunctions());

test("AI function starts with Lambda require(esm) disabled and rejects unauthenticated requests", async () => {
    const source = `
        import assert from "node:assert/strict";
        globalThis.fetch = () => { throw new Error("Unexpected network call"); };
        const { default: handler } = await import("./netlify/build/parse-task.mjs");
        const get = await handler(new Request("https://example.test/parse-task"));
        assert.equal(get.status, 405);
        const post = await handler(new Request("https://example.test/parse-task", {
            method: "POST", body: "{}",
        }));
        assert.equal(post.status, 401);
        assert.equal((await post.json()).code, "UNAUTHORIZED");
    `;
    const result = await run(process.execPath, ["--no-experimental-require-module", "--input-type=module", "-e", source], {
        cwd: new URL("../", import.meta.url),
        env: {
            ...process.env,
            GEMINI_API_KEY: "test-not-a-real-api-key",
            FIREBASE_PROJECT_ID: "test-project",
            FIREBASE_CLIENT_EMAIL: "test@example.test",
            // Only the config check runs: no credentials are initialized.
            FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY----- test-only",
        },
    });
    assert.equal(result.stderr, "");
});

test("news bundle remains independent of Firebase Admin", async () => {
    const bundle = await readFile(new URL("../netlify/build/generate-news.mjs", import.meta.url), "utf8");
    assert.ok(!bundle.includes("@google-cloud/firestore"));
    const { parseFeed } = await import("../netlify/build/generate-news.mjs");
    const items = parseFeed('<rss><channel><item><title>Test</title><link>javascript:alert(1)</link></item></channel></rss>');
    assert.equal(items[0].link, "");
});
