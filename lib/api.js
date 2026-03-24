export const createApi = (baseUrl) => {
    return async (path, options = {}) => {
        const method = options.method || "GET";
        const fetchOptions = { method, redirect: "follow" };
        if (options.body) fetchOptions.body = options.body;
        const res = await fetch(`${baseUrl}${path}`, fetchOptions);
        if (!res.ok) throw new Error(`API ${method} ${path}: ${res.status}`);
        return res.json();
    };
};
