globalThis.addEventListener('message', message => {
    const { buffer, canvas} = message.data;
    const ctx = canvas.getContext('2d');
    const uint8 = new Uint8Array(buffer);

    const draw = time => {
        const txt = `Time: ${time.toFixed(2)} | Data: ${Atomics.load(uint8, 0)}`;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        ctx.fillText(txt, 2, 2, canvas.width - 4);
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
})