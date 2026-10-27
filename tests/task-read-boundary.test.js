import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Render the real UI component with React; no Firebase credentials or network.
const result = await build({
    stdin: {
        contents: `
            import React from 'react';
            import { renderToStaticMarkup } from 'react-dom/server';
            import Boundary from './src/components/TaskReadBoundary.jsx';
            export function render(status) {
                return renderToStaticMarkup(<Boundary status={status} error={{code:'permission-denied'}} onRetry={() => {}}>
                    <p>タスクはありません</p>
                </Boundary>);
            }
        `,
        resolveDir: fileURLToPath(new URL("../", import.meta.url)),
        loader: "jsx",
    },
    bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
});
const module = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);

test("loading and errors never render zero-task content", () => {
    const loading = module.exports.render("loading");
    assert.ok(loading.includes('role="status"'));
    assert.ok(!loading.includes("タスクはありません"));
    const error = module.exports.render("error");
    assert.ok(error.includes('role="alert"'));
    assert.ok(error.includes("再試行"));
    assert.ok(!error.includes("タスクはありません"));
});

test("only a successful read renders task content", () => {
    assert.ok(module.exports.render("ready").includes("タスクはありません"));
});
