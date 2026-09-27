import { BrowserWindow } from 'electron'
import { MyNativeAddon as WindowsAltTabNativeAddon } from './native-wrapper.js'

type AltTabPhase = 'tab-down' | 'tab-up' | 'alt-up' | 'force-release'

export class AltTab {
    private window: BrowserWindow | null = null
    private windowsAddon: WindowsAltTabNativeAddon | null = null
    private altTabCallback = this.onAltTabPressed.bind(this)

    private isAltDownMessage(wParam: number): boolean {
        // WM_SYSKEYDOWN (0x0104) 
        // WM_KEYDOWN (0x0100)
        return wParam === 0x0104 || wParam === 0x0100
    }

    private isAltUpMessage(wParam: number): boolean {
        // WM_SYSKEYUP (0x0105)
        // WM_KEYUP (0x0101)
        return wParam === 0x0105 || wParam === 0x0101
    }

    onAltTabPressed(wParam: number, vkCode: number) {
        // Tab (0x09)
        if (vkCode === 0x09) {
            if (this.isAltDownMessage(wParam)) {
                this.sendAltTabPhase('tab-down', vkCode)
            } else if (this.isAltUpMessage(wParam)) {
                this.sendAltTabPhase('tab-up', vkCode)
            }
            return
        }

        // Alt (0x12)
        if (vkCode === 0x12 && this.isAltUpMessage(wParam)) {
            this.sendAltTabPhase('alt-up', vkCode)
        }
    }
    constructor(window: BrowserWindow) {
        this.window = window

        this.window.on('focus', () => this.installHookIfNeeded())

        this.window.on('blur', () => {
            this.uninstallHookIfNeeded()
            this.sendAltTabPhase('force-release', 0x12)
        })
        this.window.on('closed', () => {
            this.window = null
            this.uninstallHookIfNeeded()
        })

        if (this.window.isFocused()) {
            this.installHookIfNeeded()
        }
    }

    public exit() {
        this.sendAltTabPhase('force-release', 0x12)
        this.uninstallHookIfNeeded()
    }

    private installHookIfNeeded() {
        if (!this.windowsAddon) {
            this.windowsAddon = new WindowsAltTabNativeAddon()
            this.windowsAddon.onAltTabPressed(this.altTabCallback)
        }

        this.windowsAddon.hook()
    }

    private uninstallHookIfNeeded() {
        this.windowsAddon?.unhook()
    }

    private sendAltTabPhase(phase: AltTabPhase, keyCode: number) {
        if (!this.window || this.window.isDestroyed()) {
            return
        }

        const script = `window.__guacamoleForwardAltTab("${phase}", ${keyCode});`
        this.window.webContents.executeJavaScript(script)
    }

    public addAltTabForwardingScript() {
        if (!this.window || this.window.isDestroyed()) {
            return
        }

        this.window.webContents.executeJavaScript(`
        (() => {
            const ALT_KEYSYM = 65513;
            const TAB_KEYSYM = 65289;

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

            window.__guacamoleAltTabState = {
                remoteAltDown: false,
                lastTabDownAt: 0
            };

            window.__guacamoleForwardAltTab = (phase, keyCode) => {
                const client = getClient();
                if (!client) {
                    return false;
                }

                const state = window.__guacamoleAltTabState;
                if (!state) {
                    return false;
                }

                if (phase === 'tab-down') {
                    if (!state.remoteAltDown) {
                        client.sendKeyEvent(1, ALT_KEYSYM);
                        state.remoteAltDown = true;
                    }
                    client.sendKeyEvent(1, TAB_KEYSYM);
                    state.lastTabDownAt = Date.now();
                    return true;
                }

                if (phase === 'tab-up') {
                    client.sendKeyEvent(0, TAB_KEYSYM);
                    return true;
                }

                if (phase === 'alt-up') {
                    if (state.remoteAltDown) {
                        client.sendKeyEvent(0, ALT_KEYSYM);
                        state.remoteAltDown = false;
                    }
                    return true;
                }

                if (phase === 'force-release') {
                    if (state.remoteAltDown) {
                        client.sendKeyEvent(0, ALT_KEYSYM);
                        state.remoteAltDown = false;
                    }
                    return true;
                }

                return false;
            };
        })();
    `)
    }
}