import assert from 'assert';
import jobs from '../../src/objects/jobs.js';
import jobRoutes from '../../src/server/jobRoutes.js';
import routes from '../../src/server/routes.js';

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        chunks: [],
        headersSent: false,
        writeHead(code) {
            this.statusCode = code;
            this.headersSent = true;
        },
        write(chunk) {
            this.chunks.push(chunk);
        },
        end(data) {
            this.body = data;
        },
        on() {}
    };
}

function until(check, ms) {
    const deadline = Date.now() + ms;
    return new Promise((resolve, reject) => {
        function tick() {
            if (check()) {
                resolve();
                return;
            }
            if (Date.now() >= deadline) {
                reject(new Error('deadline'));
                return;
            }
            setTimeout(tick, 10);
        }
        tick();
    });
}

function mockReq(method, url) {
    const listeners = {};
    return {
        method,
        url,
        on(event, fn) {
            listeners[event] = fn;
            return this;
        }
    };
}

describe('jobRoutes', function() {
    it('returns a snapshot for a started job', async function() {
        const board = jobs(() => {
            return new Date();
        });
        const { id } = board.start(async ({ signal }) => {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, 5000);
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new Error('job stopped'));
                });
            });
        });
        const api = routes(jobRoutes('/api/v1', board), { requestTimeoutMs: 1000 });
        const res = mockRes();
        await api.handle(mockReq('GET', `/api/v1/jobs/${id}`), res);
        board.stop(id);
        const body = JSON.parse(res.body);
        assert.strictEqual(
            res.statusCode === 200 && body.id === id && body.state === 'running',
            true,
            'jobRoutes hid the running job snapshot'
        );
    });

    it('answers 404 for an unknown job', async function() {
        const board = jobs(() => {
            return new Date();
        });
        const api = routes(jobRoutes('/api/v1', board), { requestTimeoutMs: 1000 });
        const res = mockRes();
        const ghost = `ghost-${Math.random().toString(36).slice(2)}`;
        await api.handle(mockReq('GET', `/api/v1/jobs/${ghost}`), res);
        assert.strictEqual(res.statusCode, 404, 'jobRoutes invented a snapshot for an unknown job');
    });

    it('stops a running job on delete', async function() {
        const board = jobs(() => {
            return new Date();
        });
        const { id } = board.start(async ({ signal }) => {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, 5000);
                signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    const error = new Error('job stopped');
                    error.code = 'STOPPED';
                    reject(error);
                });
            });
        });
        const api = routes(jobRoutes('/api/v1', board), { requestTimeoutMs: 1000 });
        const res = mockRes();
        await api.handle(mockReq('DELETE', `/api/v1/jobs/${id}`), res);
        assert.strictEqual(
            res.statusCode === 200 && board.status(id).state === 'stopped',
            true,
            'jobRoutes left the job running after delete'
        );
    });

    it('streams a done event for a finished job', async function() {
        const token = `\u00e9${Math.random().toString(36).slice(2)}`;
        const board = jobs(() => {
            return new Date();
        });
        const { id } = board.start(async () => {
            return { token };
        });
        await until(() => {
            return board.status(id).state !== 'running';
        }, 1000);
        const api = routes(jobRoutes('/api/v1', board), { requestTimeoutMs: 1000 });
        const res = mockRes();
        await api.handle(mockReq('GET', `/api/v1/jobs/${id}/stream`), res);
        const stream = res.chunks.join('');
        assert.strictEqual(
            stream.includes('event: done') && stream.includes(token),
            true,
            'jobRoutes did not stream the finished result'
        );
    });
});
