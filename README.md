# @yarkivaev/simple-server

Generic HTTP/SSE building blocks: `route`, `routes`, JSON/SSE responses, request timeouts, pagination, virtual clock.

Repository: `https://github.com/yarkivaev/simple-server`

## Install

```
npm install @yarkivaev/simple-server
```

Published to [registry.npmjs.org](https://www.npmjs.com/package/@yarkivaev/simple-server) on push to `main` (GitHub Actions `release.yml` via `yarkivaev/npm-workflows`).

## Usage

```javascript
import http from 'http';
import { route, routes, jsonResponse } from '@yarkivaev/simple-server';

const api = routes([
  route('GET', '/health', async (req, res) => {
    jsonResponse({ ok: true }).send(res);
  })
]);

http.createServer((req, res) => api.handle(req, res)).listen(3000);
```
