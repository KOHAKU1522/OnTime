# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Netlify Functions runtime

Use Node.js 24. Netlify runs `npm run build:netlify`, which builds the frontend
and prebundles functions from `netlify/functions/` into `netlify/build/`.
Do not deploy the source functions directly: `firebase-admin` uses
`jwks-rsa -> jose`, and Lambda disables native CommonJS `require(esm)`.
The generated bundles avoid that runtime dependency while retaining Firestore
and its runtime protobuf files as external dependencies.

Run `npm run test:functions` to verify that the AI endpoint starts with
`--no-experimental-require-module` and still rejects unauthenticated requests.

After changing this build configuration, redeploy the site on Netlify.
If `AWS_LAMBDA_JS_RUNTIME` is explicitly configured in the Netlify UI, set it to
`nodejs24.x` there (it cannot be set in `netlify.toml`).
Server-only environment variables for AI parsing are `GEMINI_API_KEY`,
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
Never prefix server secrets with `VITE_`.
