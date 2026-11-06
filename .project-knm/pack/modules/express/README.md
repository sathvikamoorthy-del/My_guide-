# express

Express 4 API framework module (STORY-053a). Provides `http-server`.

- `createApp({ routes, middleware, providers })` builds the app from the scaffold glue: providers register first (`register(app)`), then JSON parsing, then middleware outer to inner (`{ id, handler }`), then routes (`{ id, mount(router) }`), a JSON 404 and an error handler that never leaks internals on a 500. Duplicate ids are rejected. Async handlers are wrapped so rejections reach the error handler.
- `start(port?)` reads the glue files and listens (`PORT`, default 3000; `0` = free port).
- No `x-powered-by` header; body limit 1 MB (an adaptation point).
