import errorResponse from '../objects/errorResponse.js';
import jsonResponse from '../objects/jsonResponse.js';
import route from '../objects/route.js';
import sseResponse from '../objects/sseResponse.js';

/**
 * Reads a job snapshot or sends 404.
 *
 * @param {object} board - jobs board
 * @param {string} id - job id
 * @param {object} res - HTTP response
 * @returns {object|undefined} snapshot when present
 */
function snapshot(board, id, res) {
    try {
        return board.status(id);
    } catch {
        errorResponse('NOT_FOUND', `job ${id} is unknown`, 404).send(res);
        return undefined;
    }
}

/**
 * Emits one SSE event matching the job state.
 *
 * @param {object} sse - sseResponse handle
 * @param {object} current - job snapshot
 */
function emitState(sse, current) {
    if (current.state === 'running') {
        sse.emit('progress', current.progress);
        return;
    }
    if (current.state === 'done') {
        sse.emit('done', current.result);
        return;
    }
    if (current.state === 'failed') {
        sse.emit('failed', { message: current.error });
        return;
    }
    sse.emit('stopped', {});
}

/**
 * Encodes mutable job fields for change detection.
 *
 * @param {object} current - job snapshot
 * @returns {string} JSON fingerprint
 */
function encode(current) {
    return JSON.stringify({
        state: current.state,
        progress: current.progress,
        result: current.result,
        error: current.error
    });
}

/**
 * Streams job events until the job leaves running.
 *
 * @param {object} board - jobs board
 * @param {string} id - job id
 * @param {object} req - HTTP request
 * @param {object} res - HTTP response
 * @param {function} clock - time provider for heartbeats
 */
function follow(board, id, req, res, clock) {
    const first = snapshot(board, id, res);
    if (!first) {
        return;
    }
    const sse = sseResponse(res, clock);
    let last = '';
    const timers = { pulse: undefined, beat: undefined };
    function stop() {
        clearInterval(timers.pulse);
        clearInterval(timers.beat);
        sse.close();
    }
    function tick() {
        try {
            const current = board.status(id);
            const encoded = encode(current);
            if (encoded === last) {
                return;
            }
            last = encoded;
            emitState(sse, current);
            if (current.state !== 'running') {
                stop();
            }
        } catch {
            sse.emit('failed', { message: `job ${id} is unknown` });
            stop();
        }
    }
    timers.pulse = setInterval(() => {
        tick();
    }, 25);
    timers.beat = setInterval(() => {
        sse.heartbeat();
    }, 15000);
    req.on('close', stop);
    tick();
}

/**
 * HTTP routes for job snapshot, SSE stream, and stop.
 *
 * @param {string} base - URL prefix
 * @param {object} board - jobs board
 * @param {function} [clock] - optional time provider
 * @returns {object[]} GET snapshot, GET stream, DELETE stop
 *
 * @example
 *   jobRoutes('/api/v1', jobs(() => new Date()));
 */
export default function jobRoutes(base, board, clock) {
    const time = clock || function time() {
        return new Date();
    };
    return [
        route('GET', `${base}/jobs/:id/stream`, (req, res, params) => {
            follow(board, params.id, req, res, time);
        }),
        route('GET', `${base}/jobs/:id`, (req, res, params) => {
            const current = snapshot(board, params.id, res);
            if (!current) {
                return;
            }
            jsonResponse(current).send(res);
        }),
        route('DELETE', `${base}/jobs/:id`, (req, res, params) => {
            try {
                jsonResponse(board.stop(params.id)).send(res);
            } catch {
                errorResponse('NOT_FOUND', `job ${params.id} is unknown`, 404).send(res);
            }
        })
    ];
}
