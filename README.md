# SSL Server Template

Easy to clone for new project scaffolding. Auto-creates and auto-renews SSL certs via Let's Encrypt when proper .env/environment variables are set (see top of `index.js`). Also forces all HTTP traffic to redirect through HTTPS.

**NOTE:** In `sslHelper.js`, set `useLetsEncryptStagingUrl` to `true` while testing to avoid Let's Encrypt rate limiting. Once the server works with the staging URL (unsecure certs), then turn that off, delete your certs folder, and re-run to get production-ready (trusted) certs generated from then on.