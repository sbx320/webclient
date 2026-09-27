import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface Config {
    url?: string
}

const isHttpUrl = (value: unknown): value is string => {
    if (typeof value !== 'string') {
        return false
    }
    try {
        const { protocol } = new URL(value)
        return protocol === 'http:' || protocol === 'https:'
    } catch {
        return false
    }
}

export const getConfigPath = (): string => path.join(app.getPath('userData'), 'config.json')

export const loadConfig = (): Config => {
    const configPath = getConfigPath()
    if (!fs.existsSync(configPath)) {
        return {}
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            console.error(`Config in ${configPath} is not a JSON object, ignoring it`)
            return {}
        }
        if (parsed.url !== undefined && !isHttpUrl(parsed.url)) {
            console.error(`Config url in ${configPath} is not a valid http(s) URL, ignoring it`)
            delete parsed.url
        }
        return parsed
    } catch (error) {
        console.error(`Failed to read config from ${configPath}:`, error)
        return {}
    }
}

export const saveConfig = (config: Config): void => {
    const configPath = getConfigPath()
    try {
        fs.mkdirSync(path.dirname(configPath), { recursive: true })
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
    } catch (error) {
        console.error(`Failed to write config to ${configPath}:`, error)
    }
}

const promptHtml = `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>webclient</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 16px; }
        input { width: 100%; box-sizing: border-box; padding: 6px; margin: 8px 0 12px; }
        .buttons { text-align: right; }
        button { min-width: 80px; margin-left: 8px; }
    </style>
</head>
<body>
    <form id="form">
        <label for="url">URL to open:</label>
        <input id="url" type="url" placeholder="https://" pattern="https?://.+" title="Enter an http:// or https:// URL" required autofocus>
        <div class="buttons">
            <button type="submit">OK</button>
            <button type="button" id="cancel">Cancel</button>
        </div>
    </form>
</body>
</html>`

// Shows a small window asking for the URL. Resolves to null if the user cancels.
const promptForUrl = (): Promise<string | null> => {
    const win = new BrowserWindow({
        width: 480,
        height: 170,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: 'webclient',
    })
    win.removeMenu()

    return new Promise((resolve) => {
        win.on('closed', () => resolve(null))

        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(promptHtml)}`)
            .then(() => win.webContents.executeJavaScript(`
                new Promise((resolve) => {
                    document.getElementById('form').addEventListener('submit', (event) => {
                        event.preventDefault();
                        resolve(document.getElementById('url').value.trim());
                    });
                    document.getElementById('cancel').addEventListener('click', () => resolve(null));
                    document.addEventListener('keydown', (event) => {
                        if (event.key === 'Escape') {
                            resolve(null);
                        }
                    });
                })
            `))
            .then((url: string | null) => {
                resolve(isHttpUrl(url) ? url : null)
                win.close()
            }, () => resolve(null))
    })
}

export const getUrl = async (): Promise<string | null> => {
    const config = loadConfig()
    if (config.url) {
        return config.url
    }

    const url = await promptForUrl()
    if (url) {
        saveConfig({ ...config, url })
    }
    return url
}
