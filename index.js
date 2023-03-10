import {config} from 'dotenv'
config();
import helmet from 'helmet'
import express from 'express'
import startSecureServer from './sslHelper.js'

const HTTP_PORT = process.env.HTTP_PORT || '80';
const HTTPS_PORT = process.env.HTTPS_PORT || '443';
const CERTS_DIR = process.env.CERTS_DIR || './certs';
const WEB_DOMAIN = process.env.WEB_DOMAIN;
const DNS_EMAIL = process.env.DNS_EMAIL;
const { server } = await startSecureServer(
    {
        HTTP_PORT, HTTPS_PORT, CERTS_DIR, WEB_DOMAIN, DNS_EMAIL
    },
    () => console.log(`HTTP server listening on port ${HTTP_PORT}...`),
    () => console.log(`HTTPS server listening on port ${HTTPS_PORT}...`),
    () => console.log('Certs checked, all servers up and running!')
);

server.use(helmet());
server.use(express.static('./public', {extensions: ['html']}));
server.get('/', (req, res) => {
    res.send('How did you get here?');
});
server.all('*', (req, res) => res.redirect('/'));