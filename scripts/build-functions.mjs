import { build } from "esbuild";
import { pathToFileURL } from "node:url";

// Netlify traces v2 functions without bundling their dependencies. Prebundle
// jwks-rsa -> jose so Lambda does not need native require(esm), which it disables.
export async function buildFunctions(outdir = "netlify/build") {
    return Promise.all(["parse-task", "generate-news"].map(name => build({
        entryPoints: [`netlify/functions/${name}.js`],
        outdir,
        outExtension: { ".js": ".mjs" },
        bundle: true,
        platform: "node",
        target: "node24",
        format: "esm",
        // Firestore loads protobuf files at runtime: preserve its npm package.
        external: ["@google-cloud/firestore", "@google-cloud/storage"],
        // Static import lets Netlify trace Firestore and its transitive dependencies.
        banner: name === "parse-task" ? {
            js: 'import "@google-cloud/firestore"; import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
        } : undefined,
        logLevel: "warning",
    })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await buildFunctions();
}
