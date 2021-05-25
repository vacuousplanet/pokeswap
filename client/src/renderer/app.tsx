import React, {useReducer, useState, useEffect} from 'react';

import { ipcRenderer } from 'electron';

import Sidebar from './components/sidebar';
import {lobbySettingsReducer, localPathSettingsReducer, path_store} from './reducers';
import {
    LobbySettingsContext,
    LocalPathSettingsContext,
    LobbyInitModeContext} from './contexts';
import './app.scss';

const TitleBar = () => {
    return (
        <div className='titlebar'>
            <button
                onClick={() => ipcRenderer.send('quit-pokeswap')}
            >
                x
            </button>
        </div>
    )
}


const App = () => {
    const lobby_settings = useReducer(lobbySettingsReducer, {
        username: '',
        gamepath: '',
        lobby_size: 2,
        lobby_code: '',
        lobby_password: '',
        gym_status: 0,
    });

    const local_path_settings = useReducer(localPathSettingsReducer, {
         bizhawk_path: '',
         rompaths: [],
         server_url: 'http://127.0.0.1:3000',
    });

    const lobby_init_mode = useState('');

    useEffect(() => {
        local_path_settings[1]({
            type: 'set',
            action: path_store.store
        });
    }, []);

    return (
        <LobbySettingsContext.Provider value={lobby_settings}>
            <LocalPathSettingsContext.Provider value={local_path_settings}>
                <LobbyInitModeContext.Provider value={lobby_init_mode}>
                    <TitleBar />
                    <Sidebar />
                </LobbyInitModeContext.Provider>
            </LocalPathSettingsContext.Provider>
        </LobbySettingsContext.Provider>
    )
}

export default App;