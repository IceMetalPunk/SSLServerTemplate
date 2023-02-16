import { config } from 'dotenv'
config();
import helmet from 'helmet'
import express from 'express'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import startSecureServer from './sslHelper.js'
import { spawn } from 'child_process'
import path from 'path'
import { safeAsync, waitForEndpoint } from './helpers.js';

console.log('Loading StableDiffusion API...');
const sdPath = path.join('C:', 'Users', 'iceme', 'Documents', 'StableDiffusion-WebUI');
const stableDiffAPI = spawn(path.join(sdPath, 'start.bat'), {
    cwd: sdPath,
    stdio: ['ignore', 'ignore', 'ignore']
});
process.on('beforeExit', () => {
    stableDiffAPI.kill();
});

const HTTP_PORT = process.env.HTTP_PORT || '80';
const HTTPS_PORT = process.env.HTTPS_PORT || '443';
const CERTS_DIR = process.env.CERTS_DIR || './certs';
const WEB_DOMAIN = process.env.WEB_DOMAIN;
const DNS_EMAIL = process.env.DNS_EMAIL;

let baseModelMap = {};
if (existsSync('modelMap.json')) {
    const baseModelMapRaw = await fs.readFile('modelMap.json', 'utf8');
    baseModelMap = JSON.parse(baseModelMapRaw);
}

const [modelResponse, apiError] = await safeAsync(waitForEndpoint({
    retryAttempts: 50,
    retryDelay: 1000
}, 'http://127.0.0.1:7860/sdapi/v1/sd-models'));
let modelNSFWMap = baseModelMap;
if (!apiError) {
    const modelArray = await modelResponse.json();
    for (let entry of modelArray) {
        // Mark obviously NSFW models immediately
        const isObviouslyNSFW = /porn|sex|fuck|nsfw|horny|nude|naked/.test(entry.model_name.toLowerCase());
        if (/inpainting|pix2pix|img2img/.test(entry.model_name.toLowerCase())) {
            continue;
        }
        let isNSFW = isObviouslyNSFW;
        /* If model seems SFW, double-check against the Civit.ai database.
            
            NOTE: This is not foolproof! Models that are not on Civit.ai (including custom merges) and
            models that are too old to have calculated hashes to look up will NOT be caught by this!

            Manual oversight is recommended/required when models are added to verify the correct NSFW tags! */
        if (!isNSFW && (entry.sha256 || entry.hash)) {
            console.log(`Checking NSFW status of ${entry.model_name}...`);
            const searchQuery = entry.sha256 || entry.hash;
            const modelQuery = await fetch(`https://civitai.com/api/v1/models?query=${searchQuery}`);
            const modelResponse = await modelQuery.json();
            if (modelResponse?.items?.length) {
                isNSFW = isNSFW || modelResponse.items[0].nsfw;
            }
        }
        modelNSFWMap[entry.title] = modelNSFWMap[entry.title] ?? isNSFW;
    }
    await fs.writeFile('modelMap.json', JSON.stringify(modelNSFWMap, null, 2), 'utf8');
    console.log('API and model list loaded!');
} else {
    console.log('ERROR: Could not get models after 50 attempts!');
}
const defaultModel = Object.keys(modelNSFWMap).find(model => !modelNSFWMap[model]);

const { server } = await startSecureServer(
    {
        HTTP_PORT, HTTPS_PORT, CERTS_DIR, WEB_DOMAIN, DNS_EMAIL
    },
    () => console.log(`HTTP server listening on port ${HTTP_PORT}...`),
    () => console.log(`HTTPS server listening on port ${HTTPS_PORT}...`),
    () => console.log('Certs checked, all servers up and running!')
);

server.use(helmet());
server.use(express.urlencoded({ extended: true }));
const handleSDRequest = async (req, res) => {
    let image = '';
    console.log('Processing SD request...');
    const body = JSON.stringify({
        prompt: req?.body?.prompt,
        steps: 40,
        restore_faces: true,
        negative_prompt: 'ugly, distorted',
        sd_model_checkpoint: req?.body?.model || defaultModel,
        width: Number(req?.body?.width || 704),
        height: Number(req?.body?.height || 768)
    });
    if (req?.body && req?.body?.prompt) {
        const response = await fetch(`http://127.0.0.1:7860/sdapi/v1/txt2img`,
            {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                },
                redirect: 'follow',
                referrerPolicy: 'no-referrer',
                body
            }
        );
        const json = await response.json();
        const url = `data:image/png;base64,${json.images[0]}`;
        image = `<a href="${url}"><img src="${url}"></a>`;
    }
    console.log('Request complete.');
    return res.send(`
    <html>
        <head>
        </head>
        <body>
            ${image}
            <form action='/stablediffusion' method='post'>
                <input type='text' name='prompt' placeholder='Prompt' size='400'${body.prompt ? ` value="${body.prompt}"` : ''}><br>
                <select name='model'>
                    ${Object.keys(modelNSFWMap).map(model => {
                        return `<option value="${model}"${model === body.sd_model_checkpoint ? ' selected' : ''}>${model}</option>`;
                    }).join(' ')}
                </select>
                <input type='number' size='4' name='width' placeholder='W' min=512 value=512> X <input type='number' name='height' size='4' placeholder='H' min=512 value=512><br>
                <input type='submit' value='Generate!'>
            </form>
        </body>
    </html>
    `)
}
server.get('/stablediffusion', handleSDRequest);
server.post('/stablediffusion', handleSDRequest);

server.use(express.static('./public', { extensions: ['html'] }));
server.get('/', (req, res) => {
    res.send('How did you get here?');
});
server.all('*', (req, res) => res.redirect('/'));