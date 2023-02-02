const canvas = document.getElementById('toDraw').transferControlToOffscreen();
if (globalThis.crossOriginIsolated) {
    const myWorker = new Worker('/js/worker.js');
    const buffer = new SharedArrayBuffer(16);
    const uint8 = new Uint8Array(buffer);
    myWorker.postMessage({ buffer, canvas }, [canvas]);
    setInterval(() => {
        Atomics.add(uint8, 0, 1);
    }, 1000);
} else {
    console.log('NOT SECURE!');
}