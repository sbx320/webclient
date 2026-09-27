{
  "targets": [
    {
      "target_name": "alttab_native",
      "conditions": [
        ["OS=='win'", {
          "sources": [
            "native-win32/main.cpp"
          ],
          "include_dirs": [
            "<!@(node -p \"require('node-addon-api').include\")",
            "include"
          ],
          "libraries": [
            "comctl32.lib",
            "shcore.lib"
          ],
          "dependencies": [
            "<!(node -p \"require('node-addon-api').gyp\")"
          ],
          "defines": [
            "NODE_ADDON_API_CPP_EXCEPTIONS",
            "WINVER=0x0A00",
            "_WIN32_WINNT=0x0A00"
          ],
          "cflags!": ["-fno-exceptions"],
          "cflags_cc!": ["-fno-exceptions"],
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.14"
          },
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "DebugInformationFormat": 1,
              "AdditionalOptions": [
                "/FS"
              ]
            },
            "VCLinkerTool": {
              "GenerateDebugInformation": "true"
            }
          }
        }],
        ["OS!='win'", {
          "sources": []
        }]
      ]
    }
  ]
}