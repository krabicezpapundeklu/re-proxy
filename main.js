const SOURCE = 'https://XXX-XXX/XXX';
const TARGET = 'c:/XXX/webapp';

const READ_FROM_TARGET_IF_URL_MATCHES = /\.js($|\?)/;

const REQUEST_HANDLERS = [
    {
        method: 'get', pathPattern: /\/XXX$/, handler: (req, res) => {
            res.json({fakeData: []});
        }
    },
    {
        method: 'post', pathPattern: /\/XXX$/, handler: (req, res) => {
            res.json({fakeData: []});
        }
    }
];

const TARGET_PORT = 3000;
const TARGET_HOST = `http://localhost:${TARGET_PORT}`;

if (typeof chrome !== 'undefined') {
    chrome.webRequest.onBeforeRequest.addListener(details => {
        let path = new URL(details.url).pathname;
        let redirect = false;

        for (const handler of REQUEST_HANDLERS) {
            if (path.match(handler.pathPattern)) {
                redirect = true;
                break;
            }
        }

        if (path.match(READ_FROM_TARGET_IF_URL_MATCHES)) {
            redirect = true;
        }

        if (redirect) {
            return {redirectUrl: TARGET_HOST + details.url.substr(SOURCE.length)};
        }
    }, {urls: [SOURCE + '*']}, ['blocking']);

    chrome.webRequest.onHeadersReceived.addListener(details => {
        let headers = details.responseHeaders;

        for (let i = 0; i < headers.length; ++i) {
            if (headers[i].name.toLowerCase() === 'content-security-policy') {
                headers.splice(i, 1);
                break;
            }
        }

        return {responseHeaders: headers};
    }, {urls: [SOURCE + '*']}, ['blocking', 'responseHeaders']);
} else {
    const express = require('express');
    const cors = require('cors');
    const fs = require('fs');
    const path = require('path');

    const app = express();

    app.use(cors());

    for (const handler of REQUEST_HANDLERS) {
        app[handler.method](handler.pathPattern, handler.handler);
    }

    app.get(/.*/, (req, res) => {
        const targetPath = path.join(TARGET, req.path);

        if (req.path.endsWith('.css') || req.path.endsWith('.js')) {
            const mapPath = targetPath + '.map';

            if (fs.existsSync(mapPath)) {
                fs.readFile(targetPath, 'utf-8', (err, data) => {
                    if (err) {
                        res.sendStatus(404);
                        return;
                    }

                    const mapName = path.basename(mapPath);
                    const hostMapPath = `${TARGET_HOST}${req.path}.map`;

                    data = data.replace(`sourceMappingURL=${mapName}`, `sourceMappingURL=${hostMapPath}`);

                    res.type(path.extname(req.path));
                    res.send(data);
                });

                return;
            }
        }

        res.sendFile(targetPath);
    })

    app.listen(TARGET_PORT);
}
