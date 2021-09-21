const SOURCE = 'https://XXX-XXX/XXX';
const TARGET = 'c:/XXX/webapp';

const TARGET_PORT = 3000;
const TARGET_HOST = `http://localhost:${TARGET_PORT}`;

if (typeof chrome !== 'undefined') {
    chrome.webRequest.onBeforeRequest.addListener(details => {
        let url = details.url;
        let targetUrl;

        if (url.match(/\.js($|\?)/)) {
            targetUrl = TARGET_HOST + url.substr(SOURCE.length);
        } else if (url.indexOf('/XXX') !== -1) {
            targetUrl = TARGET_HOST + '/fakeXXX';
        }

        if (targetUrl) {
            return {redirectUrl: targetUrl};
        }
    }, {urls: [SOURCE + '/*']}, ['blocking']);

    chrome.webRequest.onHeadersReceived.addListener(details => {
        let headers = details.responseHeaders;

        for (let i = 0; i < headers.length; ++i) {
            if (headers[i].name.toLowerCase() === 'content-security-policy') {
                headers.splice(i, 1);
                break;
            }
        }

        return {responseHeaders: headers};
    }, {urls: [SOURCE + '/*']}, ['blocking', 'responseHeaders']);
} else {
    const express = require('express');
    const cors = require('cors');
    const fs = require('fs');

    const app = express();

    app.use(cors());

    app.get(/.*/, (req, res) => {
        fs.readFile(`${TARGET}/${req.path}`, 'utf-8', (err, data) => {
            if (err) {
                res.sendStatus(404);
                return;
            }

            let file = req.path.substring(req.path.lastIndexOf('/') + 1);

            data = data.replace(`sourceMappingURL=${file}.map`, `sourceMappingURL=${TARGET_HOST}${req.path}.map`);

            res.send(data);
        });
    })

    app.post('/fakeXXX', (req, res) => {
        res.json({fakeData: []});
    });

    app.listen(TARGET_PORT);
}
