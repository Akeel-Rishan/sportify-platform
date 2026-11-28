import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:https';
import browserSecurity from '../../apps/api/dist/modules/auth/browser-security.js';

const chrome = process.argv[2];
const exec = promisify(execFile);
if (!chrome || process.argv.length !== 3)
  throw new Error('Specify the absolute Chromium executable path.');
const root = await mkdtemp(join(tmpdir(), 'sportify-step12-browser-'));
let server;
let phase = 'test-certificate';
try {
  const key = join(root, 'fixture-key.pem');
  const cert = join(root, 'fixture-cert.pem');
  await exec(
    process.env.SPORTIFY_OPENSSL ?? 'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=app.sportify.test',
      '-addext',
      'subjectAltName=DNS:app.sportify.test,DNS:venue.sportify.test',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { timeout: 20000, windowsHide: true },
  );
  phase = 'https-fixture';
  const observations = {
    dashboard: 0,
    sibling: 0,
    siblingCookie: false,
    siblingCsrfDenied: false,
    siblingPreflightDenied: false,
  };
  const { BrowserAuth, newSessionSecret } = browserSecurity;
  const token = newSessionSecret();
  const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
  const express = createRequire(requireApi.resolve('@nestjs/platform-express'))('express');
  const fixtureApp = express();
  const certificate = await readFile(cert);
  const spki = createHash('sha256')
    .update(
      new X509Certificate(certificate).publicKey.export({
        type: 'spki',
        format: 'der',
      }),
    )
    .digest('base64');
  let home;
  let sibling;
  let security;
  const name = '__Host-sportify_session';
  const html = (response, body) =>
    response
      .writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      .end(body);
  fixtureApp.use((request, response) => {
    const host = request.headers.host;
    const path = request.url;
    if (host === new URL(sibling).host && path === '/sibling') {
      observations.sibling++;
      observations.siblingCookie ||= (request.headers.cookie ?? '').includes(name);
      html(
        response,
        `<!doctype html><script>
        (async()=>{
          try { await fetch(${JSON.stringify(home + '/logout')},{method:'POST',mode:'no-cors',credentials:'include',body:'x'}); } catch {}
          try { await fetch(${JSON.stringify(home + '/logout')},{method:'POST',credentials:'include',headers:{'X-CSRF-Token':'x'}}); } catch {}
          parent.postMessage('finished',${JSON.stringify(home)});
        })();
      </script>`,
      );
      return;
    }
    if (host !== new URL(home).host) {
      response.writeHead(404).end();
      return;
    }
    try {
      if (path === '/csrf') {
        response.setHeader('Cache-Control', 'no-store');
        response.end(security.bootstrap(request, response));
        return;
      }
      if (path === '/login' && request.method === 'POST') {
        security.checkMutation(request);
        security.setSession(response, token, new Date(Date.now() + 600000));
        response.writeHead(204).end();
        return;
      }
      if (path === '/logout' && request.method === 'OPTIONS') {
        observations.siblingPreflightDenied = request.headers.origin === sibling;
        response.writeHead(403).end();
        return;
      }
      if (path === '/logout' && request.method === 'POST') {
        assert.equal(security.checkMutation(request), token);
        security.clearSession(response);
        response.writeHead(204).end();
        return;
      }
      if (path === '/session') {
        if (security.session(request) === token) observations.dashboard++;
        response.writeHead(security.session(request) === token ? 204 : 401).end();
        return;
      }
      if (path === '/') {
        html(
          response,
          `<!doctype html><main>RUNNING</main><script>
          const set = (status) => document.querySelector('main').textContent = status;
          const csrf = () => fetch('/csrf',{headers:{'X-CSRF-Bootstrap':'1'}}).then(r=>{if(!r.ok)throw Error();return r.text()});
          const post = (path,proof) => fetch(path,{method:'POST',headers:{'X-CSRF-Token':proof}});
          (async()=>{
            if ((await post('/login',await csrf())).status!==204) throw Error();
            if (document.cookie.includes('__Host-sportify_session=')) throw Error();
            if ((await fetch('/session')).status!==204) throw Error();
            const child = document.createElement('iframe');
            const finished = new Promise(resolve=>addEventListener('message',event=>{
              if(event.origin===${JSON.stringify(sibling)} && event.source===child.contentWindow && event.data==='finished') resolve();
            }));
            child.src=${JSON.stringify(sibling + '/sibling')};
            document.body.append(child);
            await finished;
            if ((await fetch('/session')).status!==204) throw Error();
            if ((await post('/logout',await csrf())).status!==204) throw Error();
            if ((await fetch('/session')).status!==401) throw Error();
            set('PASS');
          })().catch(()=>set('FAIL'));
        </script>`,
        );
        return;
      }
    } catch {
      if (path === '/logout' && request.headers.origin === sibling)
        observations.siblingCsrfDenied = true;
      response.writeHead(403).end();
      return;
    }
    response.writeHead(404).end();
  });
  server = createServer({ key: await readFile(key), cert: certificate }, fixtureApp);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  home = 'https://app.sportify.test:' + port;
  sibling = 'https://venue.sportify.test:' + port;
  security = new BrowserAuth({
    dashboardOrigin: new URL(home),
    secureCookies: true,
    csrfKey: randomBytes(32),
  });
  phase = 'chromium-launch-and-navigation';
  const { stdout } = await exec(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--no-proxy-server',
      '--ignore-certificate-errors-spki-list=' + spki,
      '--host-resolver-rules=MAP *.sportify.test 127.0.0.1',
      '--user-data-dir=' + join(root, 'chrome'),
      '--virtual-time-budget=12000',
      '--dump-dom',
      home,
    ],
    { timeout: 30000, maxBuffer: 262144, windowsHide: true },
  );
  phase = 'browser-result';
  assert.ok(stdout.includes('<main>PASS</main>'), 'Browser fixture did not finish successfully.');
  assert.deepEqual(observations, {
    dashboard: 2,
    sibling: 1,
    siblingCookie: false,
    siblingCsrfDenied: true,
    siblingPreflightDenied: true,
  });
  console.log(
    'PASS Chromium: HttpOnly, Secure host-only session, sibling request and preflight denied, same-origin logout clears cookie.',
  );
} catch (error) {
  const code =
    Number.isInteger(error?.code) || /^[A-Z_]+$/.test(error?.code ?? '') ? error.code : null;
  console.error(JSON.stringify({ event: 'step12.chromium', result: 'FAIL', phase, code }));
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true, maxRetries: 3 });
}
