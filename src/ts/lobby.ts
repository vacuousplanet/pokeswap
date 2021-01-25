import Express from "express";
import { Server as ioserver } from 'socket.io'
import { Server } from 'http';
import { multicheckswap } from './checkswap';

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

interface uploadStruct {
    data: Buffer;
    status: string;
}

// Base lobby class
// This handles stuff like actual functionality
class LobbyBase {

    _password: string;
    _game_version: string;
    _lobby_size: number;
    _lobby_code: string;
    _players: string[];
    _uploads: Map<string, uploadStruct>;
    _lobby_state: string;
    _player_states: Map<string, string>;

    _progressLobbyState: () => void;

    constructor(password: string, game_version: string, lobby_size: number, lobby_code: string) {
        this._password = password;
        this._game_version = game_version;
        this._lobby_size = lobby_size;
        this._lobby_code = lobby_code;
        this._players = [];
        this._uploads = new Map<string, uploadStruct>();

        this._lobby_state = "NEW";
        this._player_states = new Map<string, string>();

        this._progressLobbyState = () => {
            switch (this._lobby_state) {
                case "NEW":
                    this._lobby_state = "UPLOADING";
                    break;
                case "UPLOADING":
                    this._lobby_state = "SWAPPING";
                    break;
                case "SWAPPING":
                    this._lobby_state = "NEW";
                    break;
            }
        };
    }

    addPlayer(username: string, password: string) {
        if (this._players.length >= this._lobby_size) {
            return undefined;
        }
         // this is kinda bad tbh
        while(this._players.includes(username)) {
            username += '0';
        }
        console.log(`Adding player ${username}`);
        this._players.push(username);
        this._player_states.set(username, "NEW");
        this._uploads.set(username, {
            data: undefined,
            status: "NONE",
        });
        return username;
    }

    removePlayer(username: string) {
        const player_index = this._players.indexOf(username);
        if (player_index > -1) {
            this._players.splice(player_index, 1);
            this._player_states.delete(username);
            this._uploads.delete(username);
        }
    }

    getNumPlayers() {
        return this._players.length;
    }

    // old version had index handle readying/uploads
    // now we can autodectect ready so this can/should be moved into here
    // or into the wrapper class
    addUpload(username: string, team_data: Buffer) {
        this._uploads.set(username, {
            data: team_data,
            status: "UPLOADED",
        });
        if (this.getUploadStatusRemaining("UPLOADED") === 0) {
            
            multicheckswap(
                Array.from(this._uploads.values()).map(upload => upload.data),
                this._game_version
            );

            io.to(this._lobby_code).emit('newTeamsReady');
        }
    }

    getPlayerUploadStatus(username: string) {
        return this._uploads.get(username).status;
    }

    getUploadStatusCount(status: string) {
        var count = 0;
        this._uploads.forEach((user_upload) =>
            count += Number(user_upload.status === status)
        );
        return count;
    }

    getUploadStatusRemaining(status: string) {
        return this._lobby_size - this.getUploadStatusCount(status);
    }

    getTeamData(username: string) {
        return this._uploads.get(username).data
    }

    getGameVersion() {
        return this._game_version;
    }

    resetUploads() {
        this._uploads.forEach((upload, username) => {
            upload = {
                data: undefined,
                status: "NONE",
            }
            this._player_states.set(username, "NEW");
        });
    }

    // Use this to check for unauthorized lobby access
    getPlayerState(username: string) {
        if (this._players.includes(username)) {
            return this._player_states.get(username);
        } else {
            return undefined;
        }
    }

    getLobbyState() {
        return this._lobby_state;
    }

};

// actual Lobby class
// this handles stuff like allowable state calls
export class Lobby extends LobbyBase {
    addUpload(username: string, team_data: Buffer) {
        // check player state
        if (this._player_states.get(username) !== "NEW") {
            return;
        }

        // check lobby state
        const allowable_states = ["NEW", "UPLOADING"];
        if (!allowable_states.includes(this._lobby_state)) {
            return;
        }

        // reset uploads
        if (this._lobby_state === "NEW") {
            this.resetUploads();
        }

        // progress lobby state
        if (this._lobby_state === "NEW" 
            || (this._lobby_state === "UPLOADING" && this.getUploadStatusRemaining("UPLOADED") === 0)) {
            this._progressLobbyState();
        }

        // calls base functionality
        super.addUpload(username, team_data);

        // progress player state
        this._player_states.set(username, "UPLOADED");

        return;
    }
};