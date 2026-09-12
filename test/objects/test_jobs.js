import assert from 'assert';
import jobs from '../../src/objects/jobs.js';

function hang(signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5000);
        signal.addEventListener('abort', () => {
            clearTimeout(timer);
            const error = new Error('job stopped');
            error.code = 'STOPPED';
            reject(error);
        });
    });
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

describe('jobs', function() {
    it('gives an id while the run is still sleeping', function() {
        const board = jobs(() => {
            return new Date();
        });
        const { id } = board.start(async ({ signal }) => {
            await hang(signal);
        });
        const state = board.status(id).state;
        board.stop(id);
        assert.strictEqual(state, 'running', 'jobs finished a run before returning its id');
    });

    it('exposes progress after report', async function() {
        const token = `\u00e9${Math.random().toString(36).slice(2)}`;
        let unlock;
        const reported = new Promise((resolve) => {
            unlock = resolve;
        });
        const board = jobs(() => {
            return new Date();
        });
        const { id } = board.start(async ({ report, signal }) => {
            report({ step: token });
            unlock();
            await hang(signal);
        });
        await reported;
        const step = board.status(id).progress.step;
        board.stop(id);
        assert.strictEqual(step, token, 'jobs hid the reported progress');
    });

    it('marks a stopped run and aborts its signal', async function() {
        let signal;
        let unlock;
        const started = new Promise((resolve) => {
            unlock = resolve;
        });
        const board = jobs(() => {
            return new Date();
        });
        const { id } = board.start(async (ports) => {
            signal = ports.signal;
            unlock();
            await hang(ports.signal);
        });
        await started;
        board.stop(id);
        assert.strictEqual(
            board.status(id).state === 'stopped' && signal.aborted === true,
            true,
            'jobs did not stop the running work'
        );
    });

    it('keeps the result after the run is done', async function() {
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
        assert.strictEqual(
            board.status(id).state === 'done' && board.status(id).result.token === token,
            true,
            'jobs dropped the result of a finished run'
        );
    });

    it('has no record for an unknown id', function() {
        const board = jobs(() => {
            return new Date();
        });
        let missing = false;
        try {
            board.status(`ghost-${Math.random().toString(36).slice(2)}`);
        } catch {
            missing = true;
        }
        assert.strictEqual(missing, true, 'jobs returned a record for an unknown id');
    });
});
