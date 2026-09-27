#include <napi.h>
#include <functional>
#include <string>
#include <Windows.h>

struct KeyEventData
{
    int keyevent;
    int vkCode;
};

static std::function<void(int, int)> callback;
static bool trackingAltTab = false;
class NodeAddon : public Napi::ObjectWrap<NodeAddon>
{
private:
    Napi::Env env;
    Napi::FunctionReference altTabHookCallback;
    std::function<void(int, int)> callback;
    bool trackingAltTab;
    napi_threadsafe_function tsfn;
    inline static HHOOK hook = nullptr;
    inline static NodeAddon *activeInstance = nullptr;

public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function func = DefineClass(env, "AltTab", {InstanceMethod("install", &NodeAddon::InstallHook), InstanceMethod("uninstall", &NodeAddon::UninstallHook)});

        Napi::FunctionReference *constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);
        exports.Set("AltTabHook", func);
        return exports;
    }

    NodeAddon(const Napi::CallbackInfo &info)
        : Napi::ObjectWrap<NodeAddon>(info),
          env(info.Env()),
          trackingAltTab(false),
          tsfn(nullptr)
    {
        napi_status status = napi_create_threadsafe_function(
            env,
            nullptr,
            nullptr,
            Napi::String::New(env, "AltTabHookCallback"),
            0,
            1,
            nullptr,
            nullptr,
            this,
            [](napi_env env, napi_value js_callback, void *context, void *data)
            {
                Napi::Env napi_env(env);
                Napi::HandleScope scope(napi_env);

                auto addon = static_cast<NodeAddon *>(context);
                auto payload = static_cast<KeyEventData *>(data);
                if (payload == nullptr)
                {
                    return;
                }

                try
                {
                    if (!addon->altTabHookCallback.IsEmpty())
                    {
                        addon->altTabHookCallback.Value().Call(addon->Value(), {Napi::Number::New(napi_env, payload->keyevent), Napi::Number::New(napi_env, payload->vkCode)});
                    }
                }
                catch (...)
                {
                }

                delete payload;
            },
            &tsfn);

        if (status != napi_ok)
        {
            Napi::Error::New(env, "Failed to create threadsafe function").ThrowAsJavaScriptException();
            return;
        }

        callback = [this](int keyevent, int vkCode)
        {
            if (tsfn != nullptr)
            {
                auto payload = new KeyEventData{keyevent, vkCode};
                napi_status status = napi_call_threadsafe_function(tsfn, payload, napi_tsfn_nonblocking);
                if (status != napi_ok)
                {
                    delete payload;
                }
            }
        };
    }

    ~NodeAddon()
    {
        if (activeInstance == this)
        {
            activeInstance = nullptr;
        }

        if (tsfn != nullptr)
        {
            napi_release_threadsafe_function(tsfn, napi_tsfn_release);
            tsfn = nullptr;
        }

        altTabHookCallback.Reset();
    }

private:
    void HandleKeyboardEvent(int keyevent, int vkCode)
    {
        if (callback)
        {
            callback(keyevent, vkCode);
        }
    }

    static LRESULT CALLBACK KeyboardLLProc(int nCode, WPARAM wParam, LPARAM lParam)
    {
        auto addon = activeInstance;
        if (nCode >= 0 && addon != nullptr)
        {
            KBDLLHOOKSTRUCT *keyData = reinterpret_cast<KBDLLHOOKSTRUCT *>(lParam);
            bool isKeyDown = (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN);
            bool isKeyUp = (wParam == WM_KEYUP || wParam == WM_SYSKEYUP);
            bool isAltDown = (GetAsyncKeyState(VK_MENU) & 0x8000) != 0 || (keyData->flags & LLKHF_ALTDOWN) != 0;

            if (keyData->vkCode == VK_TAB && isAltDown && (isKeyDown || isKeyUp))
            {
                addon->trackingAltTab = true;
                addon->HandleKeyboardEvent(static_cast<int>(wParam), static_cast<int>(keyData->vkCode));
                return 1;
            }

            bool isAltKey = keyData->vkCode == VK_MENU || keyData->vkCode == VK_LMENU || keyData->vkCode == VK_RMENU;
            if (addon->trackingAltTab && isAltKey && isKeyUp)
            {
                addon->HandleKeyboardEvent(static_cast<int>(wParam), VK_MENU);
                addon->trackingAltTab = false;
            }
        }

        return CallNextHookEx(addon != nullptr ? addon->hook : nullptr, nCode, wParam, lParam);
    }
    Napi::Value InstallHook(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        if (info.Length() < 1 || !info[0].IsFunction())
        {
            Napi::TypeError::New(env, "Expected callback function").ThrowAsJavaScriptException();
            return env.Undefined();
        }

        if (hook)
        {
            // Already installed; avoid leaking the previous hook handle
            return env.Undefined();
        }

        altTabHookCallback = Napi::Persistent(info[0].As<Napi::Function>());
        activeInstance = this;
        hook = SetWindowsHookEx(WH_KEYBOARD_LL, KeyboardLLProc, GetModuleHandle(nullptr), 0);
        if (!hook)
        {
            activeInstance = nullptr;
            altTabHookCallback.Reset();
            Napi::Error::New(env, "Failed to install low-level keyboard hook").ThrowAsJavaScriptException();
        }
        return env.Undefined();
    }

    Napi::Value UninstallHook(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        if (hook)
        {
            UnhookWindowsHookEx(hook);
            hook = nullptr;
        }
        trackingAltTab = false;
        if (activeInstance == this)
        {
            activeInstance = nullptr;
        }
        altTabHookCallback.Reset();
        return env.Undefined();
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    return NodeAddon::Init(env, exports);
}

NODE_API_MODULE(my_addon, Init)