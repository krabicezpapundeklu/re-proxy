const CONFIGS = [
    {
        prefix: 'https://XXX-XXX/XXX/',
        target: 'c:/XXX/webapp',
        readFromTargetIfPathMatches: /\.(css|js)$/,
        overrides: [
            {
                method: 'get', path: '/XXX', handler: (req, res) => {
                    res.json({fakeData: []});
                }
            },
            {
                method: 'post', path: '/XXX', handler: (req, res) => {
                    res.json({fakeData: []});
                }
            }
        ]
    }
];

const TARGET_PORT = 3000;
const TARGET_HOST = `http://localhost:${TARGET_PORT}`;

if (typeof chrome !== 'undefined') {
    const sourceUrls = CONFIGS.map(config => config.prefix + '*');

    chrome.webRequest.onBeforeRequest.addListener(details => {
        for (let configId = 0; configId < CONFIGS.length; ++configId) {
            const config = CONFIGS[configId];

            if (details.url.startsWith(config.prefix)) {
                const path = details.url.substr(config.prefix.length - 1).replace(/[?#].*/, '');
                let redirect = false;

                if (config.overrides) {
                    for (const override of config.overrides) {
                        if (override.path === path) {
                            redirect = true;
                            break;
                        }
                    }
                }

                if (!redirect && config.target && config.readFromTargetIfPathMatches) {
                    if (path.match(config.readFromTargetIfPathMatches)) {
                        redirect = true;
                    }
                }

                if (redirect) {
                    return {redirectUrl: `${TARGET_HOST}/${configId}${path}`};
                }

                break;
            }
        }
    }, {urls: sourceUrls}, ['blocking']);

    chrome.webRequest.onHeadersReceived.addListener(details => {
        let headers = details.responseHeaders;

        for (let i = 0; i < headers.length; ++i) {
            if (headers[i].name.toLowerCase() === 'content-security-policy') {
                headers.splice(i, 1);
                break;
            }
        }

        return {responseHeaders: headers};
    }, {urls: sourceUrls}, ['blocking', 'responseHeaders']);
} else {
    const express = require('express');
    const cors = require('cors');
    const fs = require('fs');
    const path = require('path');

    const app = express();

    app.use(cors());

    for (let configId = 0; configId < CONFIGS.length; ++configId) {
        const config = CONFIGS[configId];

        if (config.overrides) {
            for (const override of config.overrides) {
                app[override.method](`/${configId}${override.path}`, override.handler);
            }
        }
    }

    app.get(/\/\d+\/.+/, (req, res) => {
        const match = req.path.match(/\/(\d+)(\/.+)/);
        const config = CONFIGS[match[1]];
        const targetPath = path.join(config.target, match[2]);

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
