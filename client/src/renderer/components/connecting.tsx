import React, {useState, useEffect, useContext} from 'react'
import io from 'socket.io-client';
import {useHistory} from 'react-router-dom';
import { ipcRenderer } from 'electron';

import { LobbySettingsContext, LocalPathSettingsContext, LobbyInitModeContext } from '../contexts';
import { LobbySettings } from '../../common/LobbySettings';

import gameType from '../../common/gba_checker'

const WithTimeout = (onSuccess: (a: LobbySettings, status: string) => void, onTimeout: () => void, timeout: number) => {
    let called = false;

    const timer = setTimeout(() => {
        if (called) return;
        called = true;
        onTimeout();
    }, timeout);

    return (...args: [LobbySettings, string]) => {
        if (called) return;
        called = true;
        clearTimeout(timer);
        onSuccess.apply(this, args);
    }
}

const LobbyConnecting = () => {

    let history = useHistory();

    const [lobby_settings, updateLobbySettings] = useContext(LobbySettingsContext);
    const [local_path_settings, ] = useContext(LocalPathSettingsContext);
    const [lobby_init_mode, updateLobbyInitMode] = useContext(LobbyInitModeContext);
    const [status_messages, updateMessages] = useState<string[]>([]);
    const [ready_callback, setReadyCallback] = useState<() => void>(() => () => {});

    const updateMessagesCallback = (msg: string) => {
        updateMessages(arr => [...arr.slice(arr.length > 10 ? 1 : 0), msg]);
    }

    const [logged_on, updateLogStatus] = useState<boolean>(lobby_init_mode === 'success');

    useEffect( () => {
        const socket_server: SocketIOClient.Socket = io.connect(local_path_settings.server_url, {reconnection: true});

        if (lobby_init_mode === "create" || lobby_init_mode === "join" || lobby_init_mode === "resume") {
            const server_settings: LobbySettings = Object.assign({}, lobby_settings);
            let lobby_player_list: string[] = [];

            server_settings.gamepath = gameType(lobby_settings.gamepath) || '';
            socket_server.emit(lobby_init_mode, server_settings, WithTimeout((a: LobbySettings, status: string) => {
                
                if (status === 'ok') {

                    updateLobbyInitMode('success');
                    updateLogStatus(true);

                    // update the lobby settings
                    a.gamepath = lobby_settings.gamepath;
                    updateLobbySettings({type: 'set', action: a});

                    // start loop for sending game data, etc (eye roll)
                    // TODO: I think I could just do a generic emit,
                    //       passing 'upload-team' and 'beat-gym' as arg[0]
                    ipcRenderer.send('game-coms-loop-out');
                    ipcRenderer.on('game-coms-loop-in', (event, ...args) => {
                        switch (args[0]) {
                            case 'team':
                                socket_server.emit('upload-team', args[1], updateMessagesCallback);
                                break;
                            case 'gym':
                                updateLobbySettings({type: "setOne", action: ['gym_status', args[1]]})
                                socket_server.emit('beat-gym', args[1], updateMessagesCallback);
                                break;
                            case 'gym-status':
                                ipcRenderer.send('game-coms-loop-out', `gym-init:${lobby_settings.gym_status}`);
                                return;
                            default:
                                break;
                        }
                        // resend signal for loopy-doopy time
                        ipcRenderer.send('game-coms-loop-out');
                    });

                    // add relevant listeners to the socket
                    socket_server.on('player-joined', updateMessagesCallback);

                    socket_server.on('player-ready', updateMessagesCallback);

                    socket_server.on('start-game', (player_list: string[], msg: string) => {
                        lobby_player_list = Array.from(player_list);
                        updateMessagesCallback(msg);
                        // start bizhawk
                        ipcRenderer.send('start_bizhawk', local_path_settings.bizhawk_path, lobby_settings.gamepath);
                    });
                    
                    socket_server.on('beat-gym', (gym_state: number, msg: string) => {
                        updateMessagesCallback(msg);
                        updateLobbySettings({type: "setOne", action: ['gym_status', gym_state]});
                        ipcRenderer.send('beat-gym', gym_state);
                    });

                    socket_server.on('new-teams-ready', () => {
                        socket_server.emit('download-team', (new_team: Uint8Array | undefined, status: string) => {
                            updateMessagesCallback(status);
                            if (new_team) {
                                ipcRenderer.send('new-team', new_team);
                            }
                        });
                    })

                    socket_server.on('player-disconnect', (dc_player: string) => {
                        ipcRenderer.send('player-disconnect', `${dc_player} disconnected. Continue session?`);
                        updateMessagesCallback(`${dc_player} disconnected`)
                    });

                    socket_server.on('last-player', (msg: string) => {
                        // end session
                        console.log(lobby_player_list)
                        ipcRenderer.send('end-session',
                            lobby_settings.gamepath,
                            lobby_settings.lobby_code,
                            lobby_settings.gym_status,
                            lobby_player_list
                        );
                        updateLobbyInitMode('');
                        history.push('/lobby');
                        //updateMessagesCallback(msg)
                    });

                    ipcRenderer.on('player-vote', (event, ...args) => {
                        socket_server.emit('continue-vote', args[0], (player_list: string[], status: string) => {
                            updateMessagesCallback(status)
                            if (status === "Ending session...") {
                                ipcRenderer.send('end-session',
                                    lobby_settings.gamepath,
                                    lobby_settings.lobby_code,
                                    lobby_settings.gym_status,
                                    player_list
                                );
                                updateLobbyInitMode('');
                                history.push('/lobby')
                            } else if (status === "Continuing session...") {
                                lobby_player_list = Array.from(player_list);
                                ipcRenderer.send('resume-emu');
                            }
                        });
                    });

                    setReadyCallback( () => () => {
                        socket_server.emit('ready');
                    });

                } else {
                    ipcRenderer.send('user-error', 'Server Error', status);
                    updateLobbyInitMode('');
                    history.push('/lobby');
                }
            }, () => {
                ipcRenderer.send('user-error', 'Server Error', `Request to ${local_path_settings.server_url} timed out...`);
                updateLobbyInitMode('');
                history.push('/lobby');
            }, 5000));
        }

        return () => {
            // TODO: tell main to handle game saving, maybe let server know
            socket_server.disconnect();
        }

    }, []);

    return (
        <>
        <h2>{logged_on ? lobby_settings.lobby_code : ""}</h2>
        <div>
            <button hidden={lobby_init_mode === 'ready' || !logged_on} onClick={
                (event) => {
                    // notify ipc
                    updateLobbyInitMode('ready');
                    ready_callback();
                }
            }>
                Ready
            </button>
            <div hidden={!(lobby_init_mode === 'ready')}>
                {status_messages.map((msg: string, ind: number) =>
                    <div key={ind}>
                        <h4>
                            {msg}
                        </h4>
                    </div>
                )}
                <button onClick={event => {
                    updateLobbyInitMode('');
                    ipcRenderer.send('end-session',
                        lobby_settings.gamepath,
                        lobby_settings.lobby_code,
                        lobby_settings.gym_status,
                        [lobby_settings.username],
                    );
                    history.push('/lobby');
                }}>
                    End Session
                </button>
            </div>
        </div>
        </>
    )
}

export default LobbyConnecting;