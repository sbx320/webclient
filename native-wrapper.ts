import { EventEmitter } from 'node:events'
import bindings from 'bindings'

type NativeAltTabHook = {
    install: (callback: (wParam: number, vkCode: number) => void) => void
    uninstall: () => void
}

type NativeModule = {
    AltTabHook: new () => NativeAltTabHook
}

const getNativeModule = (): NativeModule | null => {
    if (process.platform !== 'win32') {
        return null
    }

    try {
        return bindings('alttab_native') as NativeModule
    } catch (err) {
        console.warn('Failed to load native Alt+Tab addon', err)
        return null
    }
}

const native = getNativeModule()

export class MyNativeAddon extends EventEmitter {
    private readonly addon: NativeAltTabHook | null
    private callback: (wParam: number, vkCode: number) => void

    constructor() {
        super()
        this.addon = native ? new native.AltTabHook() : null
        this.callback = () => { }
    }

    isSupported(): boolean {
        return this.addon !== null
    }

    onAltTabPressed(callback: (wParam: number, vkCode: number) => void): void {
        this.callback = callback
    }

    hook(): void {
        if (!this.addon) {
            return
        }

        this.addon.install(this.callback)
    }

    unhook(): void {
        if (!this.addon) {
            return
        }

        this.addon.uninstall()
    }
}

