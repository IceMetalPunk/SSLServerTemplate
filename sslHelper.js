import {config} from 'dotenv'
config();
import http from 'http'
import https from 'https'
import path from 'path'
import express from 'express'
import fs from 'fs'
import LetsEncrypt from '@andrewiski/letsencrypt'
import * as url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export default async (opts, HTTP_CALLBACK, HTTPS_CALLBACK, FINAL_CALLBACK) => {
    const {HTTP_PORT, HTTPS_PORT, WEB_DOMAIN, DNS_EMAIL} = opts;
    let {CERTS_DIR} = opts;
    if (CERTS_DIR && CERTS_DIR.startsWith('./')) {
        CERTS_DIR = path.join(__dirname, CERTS_DIR);
    }

    if (!fs.existsSync(CERTS_DIR)) {
        fs.mkdirSync(CERTS_DIR, {
            recursive: true,
            mode: '744'
        });
    }

    const httpsServerKey = path.join(CERTS_DIR, `${WEB_DOMAIN}.pem.key`);
    const httpsServerCert = path.join(CERTS_DIR,`${WEB_DOMAIN}.pem.crt`);
    const dnsNames = [WEB_DOMAIN];
    const certificateSubscriberEmail = DNS_EMAIL;

    const letsEncryptOptions = {
        CERTS_DIR,
        useLetsEncryptStagingUrl: false
    }

    const letsEncrypt = new LetsEncrypt(letsEncryptOptions);
    const app = express();
    const redirectionApp = express();
    redirectionApp.all('*', (req, res) => {
        const baseURL = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const url = new URL(baseURL);
        url.protocol = 'https';
        res.redirect(url.toString());
    });

    app.get('/.well-known/acme-challenge/*', letsEncrypt.httpRequestHandler);

    let https_server = null;
    let http_server = null;

    const getHttpsServerOptions = () => {
        const httpsOptions = {};
        if(fs.existsSync(httpsServerKey) && fs.existsSync(httpsServerCert) ){
            httpsOptions.key = fs.readFileSync(httpsServerKey);
            httpsOptions.cert = fs.readFileSync(httpsServerCert);
        }
        return httpsOptions;
    };

    const startHttpServer = () => {
        return new Promise(res => {
            http_server = http.createServer(redirectionApp).listen(HTTP_PORT, (...args) => {
                res(...args);
                HTTP_CALLBACK?.(...args);
            });
        })
    }

    const startHttpsServer = () => {
        return new Promise((res, rej) => {
            const httpsOptions = getHttpsServerOptions();
            try {
                if (httpsOptions?.key && httpsOptions?.cert) {
                    https_server = https.createServer(httpsOptions, app).listen(HTTPS_PORT, (...args) => {
                        res(...args);
                        HTTPS_CALLBACK?.(...args);
                    });
                } else {
                    const err = 'HTTPS missing key and certs; server not started!';
                    console.error(err);
                    rej(err);
                }
            } catch (ex) {
                const err = `HTTPS failed to start server on port ${HTTPS_PORT}!`;
                console.error(err, ex);
                rej(err);
            }
        });
    }
    const updateHttpsServer = () => {
        if(https_server === null){
            startHttpsServer();
            letsEncrypt.options.http_srv = https_server;
        }
    };

    const checkCertificateStatus = async () => {
        await letsEncrypt.checkCreateRenewScheduleCertificate(
            {
                keyFile:  httpsServerKey,
                certFile: httpsServerCert,
                dnsNames: dnsNames,
                certificateSubscriberEmail: certificateSubscriberEmail,
                autoRenew: true,
                https_server: https_server,
                useLetsEncryptStagingUrl : false,
                skipDryRun: true,
                skipChallengeTest: true
            }
        )
        .then(() => {
            updateHttpsServer();
            FINAL_CALLBACK?.();
        })
        .catch(err => console.error('Error creating/renewing server certificate! ', err));   
    }

    await startHttpServer();
    await startHttpsServer();
    await checkCertificateStatus();
    return {
        server: app,
        redirectionServer: redirectionApp
    };
}