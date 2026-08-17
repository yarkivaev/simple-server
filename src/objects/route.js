/**
 * Appends one decoded query pair, promoting a repeated key to an array.
 *
 * @param {object} acc - accumulated query object
 * @param {string} key - decoded query key
 * @param {string} val - decoded query value
 * @returns {object} next query object
 */
function assign(acc, key, val) {
    if (Object.hasOwn(acc, key)) {
        const prev = acc[key];
        return { ...acc, [key]: Array.isArray(prev) ? [...prev, val] : [prev, val] };
    }
    return { ...acc, [key]: val };
}

/**
 * Parses a raw query string into an object. A repeated key becomes an array.
 *
 * @param {string|undefined} raw - text after `?`, or empty
 * @returns {object} query map of strings or string arrays
 *
 * @example
 *   query('topic=a&topic=b'); // { topic: ['a', 'b'] }
 */
function query(raw) {
    if (!raw) {
        return {};
    }
    return raw.split('&').reduce((acc, pair) => {
        const [key, val] = pair.split('=');
        return assign(acc, decodeURIComponent(key || ''), decodeURIComponent(val || ''));
    }, {});
}

/**
 * HTTP route with path matching and parameter extraction.
 * Returns immutable object with matches() and handle() methods.
 *
 * @param {string} method - HTTP method (GET, PATCH, etc)
 * @param {string} path - URL pattern with :param placeholders
 * @param {function} action - receives (request, response, params, query)
 * @returns {object} route with matches, handle methods
 *
 * @example
 *   const rt = route('GET', '/items/:id', action);
 *   rt.matches(request); // boolean
 *   rt.handle(request, response);
 */
export default function route(method, path, action) {
    const parts = path.split('/');
    const params = parts
        .map((part, index) => {
            return { part, index };
        })
        .filter((item) => {
            return item.part.startsWith(':');
        })
        .map((item) => {
            return { name: item.part.slice(1), index: item.index };
        });
    const pattern = parts
        .map((part) => {
            return part.startsWith(':') ? '[^/]+' : part;
        })
        .join('/');
    const regex = new RegExp(`^${pattern}$`, 'u');
    return {
        matches(request) {
            const url = request.url.split('?')[0];
            return request.method === method && regex.test(url);
        },
        handle(request, response) {
            const url = request.url.split('?')[0];
            const urlParts = url.split('/');
            const extracted = params.reduce((acc, param) => {
                return { ...acc, [param.name]: urlParts[param.index] };
            }, {});
            return action(request, response, extracted, query(request.url.split('?')[1]));
        }
    };
}
