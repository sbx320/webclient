# webclient

This is a small wrapper application using Electron which wraps a remote Apache Guacamole session and enhances it with some injected Javascript. 

## Features

- Many keyboard shortcuts (e.g. ctrl+w) are forwarded to the remote system, rather than being handled locally
- Mouse forwards/backwards buttons are forwarded as Alt+Left/Right arrow
- Alt-Tab is forwarded to the remote system, rather than being handled locally while the application is running

## Building

```sh
npm install      # setup dependencies
npm start        # build and run
npm run package  # build a portable .exe (Windows) and a .tar.gz (Linux) into release/
```

## Configuration

Settings are stored in `config.json` in the user profile (`%APPDATA%\webclient\config.json`):
