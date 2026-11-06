import { createApp } from './app';
import { routes } from '../glue/routes';
import { middleware } from '../glue/middleware';
import { providers } from '../glue/providers';
// Starts the app on PORT (default 3000). Pass 0 to get a free port (tests).
export function start(port = Number(process.env.PORT ?? 3000)) {
    const app = createApp({ routes, middleware, providers });
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => resolve(server));
        server.on('error', reject);
    });
}
