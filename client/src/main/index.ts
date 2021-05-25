import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process'
import { createServer, Socket, AddressInfo } from 'net';
import { resolve, relative } from 'path';
import fs from 'fs'
import Store from 'electron-store';

import gameType from '../common/gba_checker';
import { LobbySettings } from '../common/LobbySettings';

import {BizData, CODE_MAP, parseBizData, encodeTeamData} from './parse_bizdata';

interface SaveSettings {
    gamepath: string;
    ss_path: string;
    lobby_code: string;
    gym_status: number;
    player_list: string[];
    checksums: string[];
};

Store.initRenderer();

var savestate: string = "";

const local_lua_path: string = './src/lua/biz_client.lua'; 

var bizhawk_proc: ChildProcess | null = null;

// default bizhawk socket server
var lua_socket : Socket | null = null;
var rend_game_coms_event = <Electron.IpcMainEvent>{};
const biz_server = createServer(socket => {

    lua_socket = socket

    socket.on('data', data => {
        // assuming data is just space separated team data for now...
        const parsed: BizData = parseBizData(data)
        
        const decoded_content: any = CODE_MAP.get(parsed.code)(parsed.content);

        // send data_buf to ps_server (through renderer)
        rend_game_coms_event.reply('game-coms-loop-in', parsed.code, decoded_content);
    });

}).listen(0);

const { port } = biz_server.address() as AddressInfo;
console.log(`lua socket port on: ${port}`);

// electron stuff
const createWindow = (): void => {
    let win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            devTools: false,
        },
        frame: false,
    });

    win.loadFile('index.html');
}

// file dialog dispatcher
ipcMain.on('rom_update', (event, ...args) => {
    const options: Electron.OpenDialogOptions = {
        properties: ['openFile'],
    };

    dialog.showOpenDialog(options).then(result => {
        if(!result.canceled) {
            const rom_name = gameType(result.filePaths[0]);
            if (rom_name === undefined) {
                
                dialog.showErrorBox('Unknown Rom', `${result.filePaths[0]} does not contain a known ROM`)
                
                event.returnValue = undefined;
                return;
            } else {
                event.returnValue = {
                    path: result.filePaths[0],
                    name: rom_name,
                };
            }
        } else {
            event.returnValue = undefined
        }
    }).catch(err => console.log(err));
    return;
});

// file dialog dispatcher
ipcMain.on('bizhawk_path_update', (event, ...args) => {
    const options: Electron.OpenDialogOptions = {
        properties: ['openFile'],
        filters: [{ name: 'Executables', extensions: ['exe']}],
    };

    dialog.showOpenDialog(options).then(result => {
        if (result.canceled) {
            event.returnValue = '';
        } else if(!result.filePaths[0].endsWith('EmuHawk.exe')) {
            dialog.showErrorBox('Invalid BizHawk Path', `Supplied path, ${result.filePaths[0]}, does not lead to EmuHawk.exe`);
            event.returnValue = '';
        }
        else if(!result.canceled && !(args[0] === result.filePaths[0])) {
            args[0] = result.filePaths[0];
            event.returnValue = result.filePaths[0];
        } else {
            event.returnValue = '';
        }
    }).catch(err => console.log(err));
});

// Start bizhawk dispatcher
ipcMain.on('start_bizhawk', (event, ...args) => {

    // TODO: clear save ram folder in bizhawk

    // start bizhawk
    bizhawk_proc = spawn(args[0], [
        '--socket_ip=127.0.0.1',
        `--socket_port=${port}`,
        `--lua=${resolve(args[0], relative(args[0], local_lua_path))}`
    ].concat(savestate === '' ? [] : [`--load-state=${savestate}`]).concat([args[1]]));

});

// Player vote dispatcher
ipcMain.on('player-disconnect', (event, ...args) => {
    const options = {
        type: 'question',
        buttons: ['Continue', 'End session'],
        defaultID: 1,
        title: 'Player Disconnect',
        message: args[0],
        detail: 'Do you want to continue playing?',
    };
    lua_socket?.write('pause');
    dialog.showMessageBox(null as unknown as BrowserWindow, options).then(
        result => {
            event.reply('player-vote', result.response === 0);
        }
    );
});

// Clean up dispatcher
ipcMain.on('end-session', (event, ...args) => {

    // prompt user for session save location
    if (lua_socket === null) {
        return;
    }

    const options: Electron.SaveDialogSyncOptions = {
        filters: [{name: 'swap-session', extensions: ['json']}]
    }
    var save_out: string | undefined = undefined;
    while(save_out === undefined) {
        save_out = dialog.showSaveDialogSync(options)
        if (save_out === undefined) {
            // show error about having to choose a file path here!
        }
    }

    const session_state: SaveSettings = <SaveSettings> {
        gamepath: args[0],
        ss_path: `${save_out.split('.')[0]}.ss`,
        lobby_code: args[1],
        gym_status: args[2],
        player_list: args[3],
        checksums: [],
    }
    // write savestate next to json
    lua_socket.write(`savestate:${save_out.split('.')[0]}.ss`.replace(/\\/g, '/').replace('C:', ''));
    fs.writeFileSync(save_out, JSON.stringify(session_state), {encoding: 'utf-8'});

});

ipcMain.on('game-coms-loop-out', (event, ...args) => {
    if (args.length > 0) {
        lua_socket?.write(args[0])
    }
    rend_game_coms_event = event;
});

ipcMain.on('resume-emu', (event, ...args) => {
    lua_socket?.write('resume');
});

ipcMain.on('new-team', (event, ...args) => {
    // seems like only an Array buffer can be sent this way (annoying)
    const new_team_data = new Uint8Array(args[0])
    lua_socket?.write(`team:${encodeTeamData(new_team_data)}`)
});

ipcMain.on('beat-gym', (event, ...args) => {
    lua_socket?.write(`gym:${args[0]}`);
});

// User error dialog dispatcher
ipcMain.on('user-error', (event, ...args) => {
    //console.log(args);
    dialog.showErrorBox(args[0], args[1]);
});

ipcMain.on('quit-pokeswap', (event, ...args) => {
    app.quit();
});

ipcMain.on('get-load-file', (event, ...args) => {
    const options: Electron.OpenDialogOptions = {
        properties: ['openFile'],
        filters: [{ name: 'swap-sessions', extensions: ['json']}],
    };

    dialog.showOpenDialog(options).then(result => {
        if (result.canceled) {
            event.returnValue = undefined;
        } else {
            // load file
            const resume_state: SaveSettings = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));

            // TODO: check format
            
            // check gamepath
            // TODO: flash error message
            const romname = gameType(resume_state.gamepath)
            if (romname === undefined) {
                event.returnValue = false;
            }

            // TODO: fill checksum vals

            // set save state and gym status
            savestate = resume_state.ss_path;
            console.log(savestate);

            const lobby_settings = <LobbySettings>{
                username: resume_state.player_list[0],
                gamepath: resume_state.gamepath,
                lobby_size: resume_state.player_list.length,
                lobby_code: resume_state.lobby_code,
                lobby_password: 'lmao',
                gym_status: resume_state.gym_status,
            }

            //lobby_init_mode = 'resume';

            event.returnValue = lobby_settings;
        }
    }).catch(err => console.log(err));
});

app.on('ready', createWindow);