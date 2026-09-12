import { randomUUID } from 'node:crypto';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Throws when a job id is absent from the in-memory board.
 *
 * @param {string} id - requested job id
 */
function missing(id) {
    const error = new Error(`job ${id} is unknown`);
    error.code = 'NOT_FOUND';
    throw error;
}

/**
 * Frozen public snapshot of one job record.
 *
 * @param {object} item - internal job record
 * @returns {object} id, state, progress, started, optional result/error
 */
function copy(item) {
    return Object.freeze({
        id: item.id,
        state: item.state,
        progress: item.progress,
        started: item.started,
        result: item.result,
        error: item.error
    });
}

/**
 * In-memory board of long-running jobs with abort and progress.
 *
 * @param {function} clock - time provider returning Date
 * @returns {object} frozen board with start, status, stop
 *
 * @example
 *   const board = jobs(() => new Date());
 *   const { id } = board.start(async ({ signal, report }) => {
 *     report({ step: 'work' });
 *     return { ok: true };
 *   });
 *   board.status(id);
 *   board.stop(id);
 */
export default function jobs(clock) {
    const items = new Map();
    const controllers = new Map();
    function read(id) {
        const item = items.get(id);
        if (!item) {
            missing(id);
        }
        return item;
    }
    function patch(id, fields) {
        const item = items.get(id);
        if (!item) {
            return;
        }
        items.set(id, { ...item, ...fields });
    }
    function expire(id) {
        setTimeout(() => {
            items.delete(id);
            controllers.delete(id);
        }, HOUR_MS);
    }
    function settle(id, state, extra) {
        const item = items.get(id);
        if (!item || item.state !== 'running') {
            return;
        }
        patch(id, { state, ...extra });
        expire(id);
    }
    function reportTo(id) {
        return function report(progress) {
            const item = items.get(id);
            if (!item || item.state !== 'running') {
                return;
            }
            patch(id, { progress });
        };
    }
    function begin(id, run, controller) {
        Promise.resolve()
            .then(() => {
                return run({ signal: controller.signal, report: reportTo(id) });
            })
            .then((result) => {
                settle(id, 'done', { result });
            })
            .catch((error) => {
                if (controller.signal.aborted) {
                    settle(id, 'stopped');
                    return;
                }
                settle(id, 'failed', { error: error.message });
            });
    }
    return Object.freeze({
        start(run) {
            const id = randomUUID();
            const controller = new AbortController();
            items.set(id, {
                id,
                state: 'running',
                progress: {},
                started: clock().toISOString()
            });
            controllers.set(id, controller);
            begin(id, run, controller);
            return { id };
        },
        status(id) {
            return copy(read(id));
        },
        stop(id) {
            const item = read(id);
            const controller = controllers.get(id);
            if (controller) {
                controller.abort();
            }
            if (item.state === 'running') {
                settle(id, 'stopped');
            }
            return copy(read(id));
        }
    });
}
