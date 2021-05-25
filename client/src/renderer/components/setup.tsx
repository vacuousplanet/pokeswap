import React, {useContext} from 'react';

import {useHistory} from 'react-router-dom';

import { LobbySettingsContext, LocalPathSettingsContext, LobbyInitModeContext } from '../contexts';

import { romPath } from '../../common/LocalPathSettings';

import './lobby.scss';


// TODO: maybe clean the form up a bit?
const LobbySetup = () => {

    let history = useHistory();

    const [lobby_settings, updateLobbySettings] = useContext(LobbySettingsContext);

    const [local_path_settings, ] = useContext(LocalPathSettingsContext);

    const [, updateLobbyInitMode] = useContext(LobbyInitModeContext);

    const options = 
        local_path_settings.rompaths.length > 0
            ? local_path_settings.rompaths.map((rominfo: romPath) => 
                <option key={rominfo.path} value={rominfo.path}>{rominfo.name}</option>)
            : <option value=''>No Roms found...</option>;

    if (local_path_settings.rompaths.length > 0 && lobby_settings.gamepath === ''){
        updateLobbySettings({type: 'setOne', action: ['gamepath', local_path_settings.rompaths[0].path]});
    }

    return (
        <>
        <div className="horiz-split">
            <div>
                <h2>Create Lobby</h2>
                <form onSubmit={(event) => {
                    event.preventDefault();
                    updateLobbyInitMode('create');
                    history.push("/lobby/connect");
                }}>
                    <div className="form-section">
                        <label>Username</label>
                        <div>
                            <input type="text" name="" id="" value={lobby_settings.username}
                                onChange={event =>
                                    updateLobbySettings({type: "setOne", action: ['username', event.target.value]})
                                }
                            />
                        </div>
                    </div>
                    <div className="form-section">
                        <label>Game selection</label>
                        <div className="custom-select">
                            <select value={lobby_settings.gamepath}
                                onChange={event =>
                                    updateLobbySettings({type: "setOne", action: ['gamepath', event.target.value]})
                                }
                            >
                                {options}
                            </select>
                        </div>
                    </div>
                    <div className="form-section">
                        <label>Lobby Size</label>
                        <div>
                            <input type="number" name="" id="" min="2" max="10" value={lobby_settings.lobby_size}
                                onChange={event => 
                                    updateLobbySettings({type: "setOne", action: ['lobby_size', Number(event.target.value)]})
                                }
                            />
                        </div>
                    </div>
                    <div className="start">
                        <button 
                            type="submit"
                            disabled={
                                (local_path_settings.rompaths.length === 0)
                                || (local_path_settings.bizhawk_path === '')
                                || (lobby_settings.username === '')
                                || (lobby_settings.lobby_size < 2)
                                || (lobby_settings.lobby_size > 10)
                            }
                        >Create
                        </button>
                    </div>
                </form>
            </div>
            <div className="vert-line"/>
            <div>
                <h2>Join Lobby</h2>
                <form onSubmit={(event) => {
                    event.preventDefault();
                    updateLobbyInitMode('join');
                    history.push("/lobby/connect");
                }}>
                    <div className="form-section">
                        <label>Username</label>
                        <div>
                            <input type="text" name="" id="" value={lobby_settings.username} 
                                onChange={event => 
                                    updateLobbySettings({type: "setOne", action: ['username', event.target.value]})
                                }
                            />
                        </div>
                    </div>
                    <div className="form-section">
                        <label>Lobby Code</label>
                        <div>
                            <input type="text" name="" id="" value={lobby_settings.lobby_code} 
                                onChange={event => 
                                    updateLobbySettings({type: "setOne", action: ['lobby_code', event.target.value]})
                                }
                            />
                        </div>
                    </div>
                    <div className="form-section">
                        <label>Lobby Password</label>
                        <div>
                            <input type="text" name="" id="" value={lobby_settings.lobby_password} 
                                onChange={event => 
                                    updateLobbySettings({type: "setOne", action: ['lobby_password', event.target.value]})
                                }
                            />
                        </div>
                    </div>
                    <div className="start">
                        <button 
                            type="submit"
                            disabled={
                                (local_path_settings.rompaths.length === 0)
                                || (local_path_settings.bizhawk_path === '')
                                || (lobby_settings.username === '')
                                || (lobby_settings.lobby_code === '')
                            }
                        >Join
                        </button>
                    </div>
                </form>
            </div>
        </div>
        </>
    )
}

export default LobbySetup;