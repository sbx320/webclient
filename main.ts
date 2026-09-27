import { app, BrowserWindow, globalShortcut, Menu, screen } from 'electron'
import { AltTab } from './alttab.js'
import { getUrl } from './config.js'

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason)
})

app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')

class GuacamoleClient {
    window: BrowserWindow
    altTab: AltTab

    constructor(url: string) {
        const currentDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
        const { x, y, width, height } = currentDisplay.bounds

        this.window = new BrowserWindow({
            x: x + width / 4,
            y: y + height / 4,
            width: width / 2,
            height: height / 2,
        })
        this.window.maximize()

        Menu.setApplicationMenu(null)
        this.window.loadURL(url)

        this.altTab = new AltTab(this.window)

        this.window.webContents.on('did-finish-load', () => {
            this.addMouseButtonForwarding()
            this.altTab.addAltTabForwardingScript()
        })
    }

    private addMouseButtonForwarding() {
        // Guacamole does not support mouse button 4 and 5 (back/forward) by default
        // instead manually forward them as alt+left / alt+right events to the frontend
        this.window.webContents.executeJavaScript(`
            (() => {
                
                const getClient = () => {
                    const body = document.getElementsByTagName('body')[0];
                    if (!body || typeof angular === 'undefined') {
                        return null;
                    }

                    try {
                        const scope = angular.element(body).scope();
                        return scope.getManagedClientGroups()[0].clients[0].client;
                    } catch {
                        return null;
                    }
                };

                document.addEventListener('mouseup', (event) => {
                    if (event.button === 3 || event.button === 4) {
                        event.preventDefault();
                        event.stopPropagation();

                        const client = getClient();
                        if (!client) {
                            return;
                        }
                        const ALT_KEYSYM = 65513;
                        const dirKey = event.button === 3 ? 65361 : 65363;
                        client.sendKeyEvent(1, ALT_KEYSYM);
                        client.sendKeyEvent(1, dirKey);
                        client.sendKeyEvent(0, dirKey);
                        client.sendKeyEvent(0, ALT_KEYSYM);
                    }
                });
            })();
        `)
    }

    public exit() {
        this.altTab.exit()
    }
}


let client: GuacamoleClient | null = null

app.whenReady().then(async () => {
    const url = await getUrl()
    if (!url) {
        app.quit()
        return
    }

    client = new GuacamoleClient(url)

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            client = new GuacamoleClient(url)
        }
    })
})

app.on('window-all-closed', () => {
    // Closing the URL prompt should not quit before the main window is created
    if (client) {
        app.quit()
    }
})

app.on('will-quit', () => {
    client?.exit()
    globalShortcut.unregisterAll()
})

