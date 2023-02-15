const canvas = document.getElementById('toDraw').transferControlToOffscreen();
if (globalThis.crossOriginIsolated) {
    const myWorker = new Worker('/js/worker.js');
    const buffer = new SharedArrayBuffer(16);
    const uint8 = new Uint8Array(buffer);
    const imageMaps = new Map();
    myWorker.addEventListener('message', message => {
        if (message.data.type === 'loadedImage') {
            imageMaps.set(message.data.name, message.data.id);
            console.log(`${message.data.name} = #${message.data.id}`, imageMaps);
        }
    });
    myWorker.postMessage({ type: 'init', buffer, canvas }, [canvas]);
    setInterval(() => {
        Atomics.add(uint8, 0, 1);
    }, 1000);
    setTimeout(() => {
        const img = new Image();
        img.addEventListener('load', async () => {
            const bmp = await createImageBitmap(img);
            myWorker.postMessage({ type: 'loadImage', name: 'sprHalo', bmp}, [bmp]);
            delete img;
        }, { once: true });
        img.src = '/img/halo_test.png';
    }, 5000);
    setTimeout(() => {
        const img = new Image();
        img.addEventListener('load', async () => {
            const bmp = await createImageBitmap(img);
            myWorker.postMessage({ type: 'loadImage', name: 'sprHalo2', bmp}, [bmp]);
            delete img;
        }, { once: true });
        img.src = '/img/halo_test.png';
    }, 10000);
} else {
    console.log('NOT SECURE!');
}