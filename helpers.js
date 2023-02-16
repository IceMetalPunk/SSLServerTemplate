export const safeAsync = promise => {
    return promise.then(res => [res, null]).catch(er => [null, er]);
}
export const delay = ms => {
    return new Promise(res => globalThis.setTimeout(res, ms));
}
export const waitForEndpoint = ({retryAttempts, retryDelay}, ...args) => {
    return new Promise(async (res, rej) => {
        let [response, error] = [null, null];
        for (let count = 0; count < retryAttempts; ++count) {
            [response, error] = await safeAsync(fetch(...args));
            if (!error && response) {
                return res(response);
            }
            await delay(retryDelay);
        }
        return rej(error);
    });
}