import React, {useContext} from 'react'

import {useHistory} from 'react-router-dom';

import { ipcRenderer } from 'electron';

import { LobbySettingsContext, LocalPathSettingsContext, LobbyInitModeContext } from '../contexts';
import { LobbySettings } from '../../common/LobbySettings';

import './lobby.scss';

// TODO: use context's here instead!!
const Resume = () => {

    let history = useHistory();

    const [local_path_settings, ] = useContext(LocalPathSettingsContext);
    const [ , updateLobbySettings] = useContext(LobbySettingsContext);
    const [ , updateLobbyInitMode] = useContext(LobbyInitModeContext);

    return (
        <>
        <div>
            <h3>
                Resume from file
            </h3>
        </div>
        <div>
            <button disabled={local_path_settings.bizhawk_path === '' || local_path_settings.server_url === ''}
                onClick={event=>{
                    event.preventDefault();
                    const new_settings: LobbySettings | undefined = ipcRenderer.sendSync('get-load-file');
                    if (new_settings != undefined) {
                        console.log(new_settings)
                        updateLobbySettings({type: "set", action: new_settings});
                        updateLobbyInitMode('resume');
                        history.push('/lobby/connect');
                    }
                }}
            >
                Load
            </button>
        </div>
        </>
    )
}

export default Resume;