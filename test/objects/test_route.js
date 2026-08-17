import assert from 'assert';
import route from '../../src/objects/route.js';

describe('route', function() {
    it('matches request with correct method and path', function() {
        const rt = route('GET', '/machines', () => {});
        const request = { method: 'GET', url: '/machines' };
        assert(rt.matches(request) === true);
    });

    it('does not match request with wrong method', function() {
        const rt = route('GET', '/machines', () => {});
        const request = { method: 'POST', url: '/machines' };
        assert(rt.matches(request) === false);
    });

    it('does not match request with wrong path', function() {
        const rt = route('GET', '/machines', () => {});
        const request = { method: 'GET', url: '/users' };
        assert(rt.matches(request) === false);
    });

    it('matches request with path parameter', function() {
        const id = `id${Math.random()}`;
        const rt = route('GET', '/machines/:id', () => {});
        const request = { method: 'GET', url: `/machines/${id}` };
        assert(rt.matches(request) === true);
    });

    it('extracts single path parameter', function() {
        const id = `id${Math.random()}`;
        let extracted;
        const rt = route('GET', '/machines/:id', (req, res, params) => {
            extracted = params;
        });
        const request = { method: 'GET', url: `/machines/${id}` };
        rt.handle(request, {});
        assert(extracted.id === id);
    });

    it('extracts multiple path parameters', function() {
        const machineId = `m${Math.random()}`;
        const alertId = `a${Math.random()}`;
        let extracted;
        const rt = route('GET', '/machines/:machineId/alerts/:alertId', (req, res, params) => {
            extracted = params;
        });
        const request = { method: 'GET', url: `/machines/${machineId}/alerts/${alertId}` };
        rt.handle(request, {});
        assert(extracted.machineId === machineId && extracted.alertId === alertId);
    });

    it('extracts query parameters', function() {
        const value = `v${Math.random()}`;
        let extracted;
        const rt = route('GET', '/machines', (req, res, params, query) => {
            extracted = query;
        });
        const request = { method: 'GET', url: `/machines?key=${value}` };
        rt.handle(request, {});
        assert(extracted.key === value);
    });

    it('extracts multiple query parameters', function() {
        const val1 = `v${Math.random()}`;
        const val2 = `v${Math.random()}`;
        let extracted;
        const rt = route('GET', '/machines', (req, res, params, query) => {
            extracted = query;
        });
        const request = { method: 'GET', url: `/machines?a=${val1}&b=${val2}` };
        rt.handle(request, {});
        assert(extracted.a === val1 && extracted.b === val2);
    });

    it('decodes URL-encoded query values', function() {
        let extracted;
        const rt = route('GET', '/machines', (req, res, params, query) => {
            extracted = query;
        });
        const request = { method: 'GET', url: '/machines?key=%D1%82%D0%B5%D1%81%D1%82' };
        rt.handle(request, {});
        assert(extracted.key === '\u0442\u0435\u0441\u0442');
    });

    it('returns empty query object when no query string', function() {
        let extracted;
        const rt = route('GET', '/machines', (req, res, params, query) => {
            extracted = query;
        });
        const request = { method: 'GET', url: '/machines' };
        rt.handle(request, {});
        assert(Object.keys(extracted).length === 0);
    });

    it('ignores query string when matching path', function() {
        const rt = route('GET', '/machines', () => {});
        const request = { method: 'GET', url: '/machines?key=value' };
        assert(rt.matches(request) === true);
    });

    it('calls action with request and response', function() {
        let receivedReq;
        let receivedRes;
        const rt = route('GET', '/machines', (req, res) => {
            receivedReq = req;
            receivedRes = res;
        });
        const request = { method: 'GET', url: '/machines' };
        const response = { data: Math.random() };
        rt.handle(request, response);
        assert(receivedReq === request && receivedRes === response);
    });

    it('handles query parameter without value', function() {
        let extracted;
        const rt = route('GET', '/machines', (req, res, params, query) => {
            extracted = query;
        });
        const request = { method: 'GET', url: '/machines?flag' };
        rt.handle(request, {});
        assert(extracted.flag === '', 'empty value should be empty string');
    });

    it('keeps a single repeated query key as a string', function() {
        const topic = `MX210/icht-${1 + Math.floor(Math.random() * 4)}/GET/AI4/VALUE`;
        let extracted;
        const rt = route('GET', '/readings', (req, res, params, query) => {
            extracted = query;
        });
        rt.handle({ method: 'GET', url: `/readings?topic=${encodeURIComponent(topic)}` }, {});
        assert.strictEqual(
            extracted.topic,
            topic,
            'a single topic query key must stay a string'
        );
    });

    it('collects repeated query keys into an array', function() {
        const first = `MX210/icht-\u0442\u0435\u0441\u0442-${Math.floor(Math.random() * 90 + 10)}/GET/AI1/VALUE`;
        const second = `MX210/icht-\u0442\u0435\u0441\u0442-${Math.floor(Math.random() * 90 + 10)}/GET/AI4/VALUE`;
        let extracted;
        const rt = route('GET', '/readings', (req, res, params, query) => {
            extracted = query;
        });
        rt.handle({
            method: 'GET',
            url: `/readings?topic=${encodeURIComponent(first)}&topic=${encodeURIComponent(second)}`
        }, {});
        assert.deepStrictEqual(
            extracted.topic,
            [first, second],
            'repeated topic query keys must not collapse to the last value'
        );
    });
});
