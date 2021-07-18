import Express from "express";
import { Server as ioserver } from 'socket.io'
import { Server } from 'http';
import { multicheckswap } from './checkswap';
import { randomDerangement } from "./derangement";

export const app = Express();

export const server = new Server(app);

export const io = new ioserver(server);

// Lobby class information:

// Lobby states:
//  - NEW
//  - UPLOADING
//  - SWAPPING

/*

So now, instead of the above, the control flow should look something like:

    new_lobby/idle -> uploading -> uploaded/swapping/downloads -> idle ...

since we don't need to know if players are ready anymore

*/

interface LobbySettings {
    username: string;
    gamepath: string;
    lobby_size: number;
    lobby_code: string;
    lobby_password: string;
    gym_status: number;
}

interface Player {
    upload: Uint8Array | undefined;
    state: string;
}

interface LobbyType {
    password: string;
    game_version: string;
    size: number;
    players: Map<string, Player>;
    derangement: Map<string, string>;
    gym_status: number;
    state: string;
}

// Player and Lobby state updater-function generation
interface StateObj {
    state: string;
}
const objectStateUpdater = function <T extends StateObj>() {
    return (obj: T | undefined, state: string) => {
        if (obj?.state) {
            obj.state = state
        }
    }
}
const updatePlayerState = objectStateUpdater<Player>();
const updateLobbyState = objectStateUpdater<LobbyType>();

const advanceGymStatus = function (lobby: LobbyType | undefined, gym_state: number) {
    if (lobby && gym_state > lobby.gym_status) {
        lobby.gym_status = gym_state;
        return true;
    }
    return false;
}

const addPlayerUploadData = function (player: Player | undefined, upload_data: Uint8Array) {
    if (player) {
        player.upload = upload_data;
        updatePlayerState(player, "UPLOADED");
    }
}

const fillDerangement = function (lobby: LobbyType | undefined) {
    if (!lobby) return;
    
    lobby.derangement.clear();
    let player_names = Array.from(lobby.players.keys());

    let index_derangement: number[] = randomDerangement(lobby.players.size);

    player_names.forEach((name, index, names) => {
        lobby.derangement.set(names[index_derangement[index]], name);
    });
}

const createLobby = function (lobbies: Map<string, LobbyType>, lobby_settings: LobbySettings) {
    if(!lobbies.has(lobby_settings.lobby_code)) {
        let new_code = Math.random().toString(36).substr(2, 6);
        while (new_code in lobbies) {
            new_code = Math.random().toString(36).substr(2, 6);
        }

        lobbies.set(new_code, {
            password: lobby_settings.lobby_password,
            game_version: lobby_settings.gamepath,
            size: lobby_settings.lobby_size,
            players: new Map<string, Player>(),
            derangement: new Map<string, string>(),
            gym_status: lobby_settings.gym_status,
            state: "NEW",
        });

        lobby_settings.lobby_code = new_code;
    }

    return lobbies.has(lobby_settings.lobby_code);
}

const getPlayerNames = function (lobbies: Map<string, LobbyType>, lobby_code: string) {
    return lobbies.get(lobby_code)?.players.keys();
}

const addPlayer = function (lobbies: Map<string, LobbyType>, lobby_settings: LobbySettings) {
    if (lobbies.get(lobby_settings.lobby_code)?.players.has(lobby_settings.username) === false) {
        lobbies.get(lobby_settings.lobby_code)?.players.set(lobby_settings.username, {
            upload: undefined,
            state: "NEW",
        });
        lobby_settings.gym_status = lobbies.get(lobby_settings.lobby_code)?.gym_status || lobby_settings.gym_status;
    }

    return lobbies.get(lobby_settings.lobby_code)?.players.has(lobby_settings.username);
}

const readyPlayer = function (lobbies: Map<string, LobbyType>, lobby_code: string, username: string) {
    if (lobbies.get(lobby_code)?.players.has(username)) {
        if (lobbies.get(lobby_code)?.state === "NEW") {
            updatePlayerState(lobbies.get(lobby_code)?.players.get(username), "READY");
        }
    }
}

const checkAllReady = function (lobbies: Map<string, LobbyType>, lobby_code: string) {
    let all_ready = true;
    if (lobbies.has(lobby_code)) {
        lobbies.get(lobby_code)?.players.forEach(v => {
            all_ready &&= (v.state === "READY");
        });
    }

    return all_ready && lobbies.has(lobby_code);
}

const startLobby = function (lobbies: Map<string, LobbyType>, lobby_code: string) {
    updateLobbyState(lobbies.get(lobby_code), "ACTIVE");
    lobbies.get(lobby_code)?.players.forEach(v => updatePlayerState(v, "ACTIVE"));
}

const gymBeaten = function (lobbies: Map<string, LobbyType>, lobby_code: string, gym_state: number) {
    let valid_gym_update = advanceGymStatus(lobbies.get(lobby_code), gym_state);
    //TODO: handle invalid gym update
}

const addUpload = function (lobbies: Map<string, LobbyType>, lobby_code: string, username: string, team_data: Uint8Array) {
    addPlayerUploadData(lobbies.get(lobby_code)?.players.get(username), team_data);
}

const checkAllUploaded = function (lobbies: Map<string, LobbyType>, lobby_code: string) {
    let all_uploaded = true;
    lobbies.get(lobby_code)?.players.forEach(v => {
        all_uploaded &&= v.state === "UPLOADED";
    });
    return all_uploaded && lobbies.has(lobby_code);
}

const generateDerangement = function (lobbies: Map<string, LobbyType>, lobby_code: string) {
    fillDerangement(lobbies.get(lobby_code));
}

const getDerangedData = function (lobbies: Map<string, LobbyType>, lobby_code: string, username: string) {
    let lobby = lobbies.get(lobby_code);
    if (lobby === undefined) return new Uint8Array();

    let data_source = lobby.derangement.get(username);
    if (data_source === undefined) return new Uint8Array();

    let data = lobby.players.get(data_source)?.upload;
    if (data === undefined) return new Uint8Array();

    return data;
}


export const LobbyUtils = {
    createLobby,
    getPlayerNames,
    addPlayer,
    readyPlayer,
    checkAllReady,
    startLobby,
    gymBeaten,
    addUpload,
    checkAllUploaded,
    generateDerangement,
    getDerangedData,
}