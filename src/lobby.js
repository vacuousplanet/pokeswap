import {unlink, unlinkSync} from "fs";

// Lobby class information:

// Lobby states:
//  - NEW
//  - UPLOADING
//  - UPLOADED
//  - READYING
//  - DOWNLOADS
//  - RENEWING

// Player states:
//  - NEW
//      Possible lobby states:
//          (NEW, UPLOADING)
//  - UPLOADED
//      Possible lobby states:
//          (UPLOADING, UPLOADED, READYING)
//  - READY
//      Possible lobby states:
//          (READYING, DOWNLOADS, RENEWING)
//  - RENEW
//      Possible lobby states:
//          (RENEWING)
//
// Client/player html data depends on BOTH player and lobby states


// Base lobby class
// This handles stuff like actual functionality
class LobbyBase {

    _password;
    _game_version;
    _lobby_size;
    _players;
    _uploads;
    _lobby_state;
    _player_states;

    _progressLobbyState;

    constructor(password, game_version, lobby_size) {
        this._password = password;
        this._game_version = game_version;
        this._lobby_size = lobby_size;
        this._players = [];
        this._uploads = {};

        this._lobby_state = "NEW";
        this._player_states = {};

        this._progressLobbyState = () => {
            switch (this._lobby_state) {
                case "NEW":
                    this._lobby_state = "UPLOADING";
                    break;
                case "UPLOADING":
                    this._lobby_state = "UPLOADED";
                    break;
                case "UPLOADED":
                    this._lobby_state = "READYING";
                    break;
                case "READYING":
                    this._lobby_state = "DOWNLOADS";
                    break;
                case "DOWNLOADS":
                    this._lobby_state = "RENEWING";
                    break;
                case "RENEWING":
                    this._lobby_state = "NEW";
                    break;
            }
            console.log(`new state: ${this._lobby_state}`);
        };
    }

    // TODO: Check if player can be added (statewise)
    addPlayer(username, password) {
        if (this._players.length >= this._lobby_size) {
            return undefined;
        }
         // this is kinda bad tbh
        while(this._players.includes(username)) {
            username += '0';
        }
        console.log(`Adding player ${username}`);
        this._players.push(username);
        this._player_states[username] = "NEW";
        this._uploads[username] = {
            data: undefined,
            status: "NONE",
        };
        return username;
    }

    // TODO: Check if player can be removed (statewise)
    removePlayer(username) {
        const player_index = this._players.indexOf(username);
        if (player_index > -1) {
            this._players.splice(player_index, 1);
            this._player_states[username] = undefined;
            this._uploads[username] = undefined;
        }
    }

    addUpload(username, file) {
        this._uploads[username] = {
            data: file,
            status: "UPLOADED",
        };
    }

    readySwap(username) {
        this._uploads[username]['status'] = "READY";
    }

    readyRenew(username) {
        this._uploads[username]['status'] = "RENEW";
    }

    getPlayerUploadStatus(username) {
        return this._uploads[username]['status'];
    }

    getUploadStatusCount(status) {
        var count = 0;
        Object.keys(this._uploads).forEach(username =>
            count += (this._uploads[username]['status'] === status)
        );
        return count;
    }

    getUploadStatusRemaining(status) {
        return this._lobby_size - this.getUploadStatusCount(status);
    }

    listFilepaths() {
        return Object.keys(this._uploads).map(username =>
            this._uploads[username]['data']['path']
        );
    }

    getFilepath(username) {
        return this._uploads[username]['data']['path'];
    }

    getGameVersion() {
        return this._game_version;
    }

    resetUploads() {
        Object.keys(this._uploads).forEach(username => {
            unlinkSync(this._uploads[username]['data']['path'], (err) => {
                if (err) throw err;
            });
            this._uploads[username] = {
                data: undefined,
                status: "NONE",
            }
            this._player_states[username] = "NEW";
        });

    }

    // Use this to check for unauthorized lobby access
    getPlayerState(username) {
        if (this._players.includes(username)) {
            return this._player_states[username];
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
    addUpload(username, file) {
        // check player state
        if (this._player_states[username] !== "NEW") {
            return;
        }

        // check lobby state
        const allowable_states = ["NEW", "UPLOADING"];
        if (!allowable_states.includes(this._lobby_state)) {
            return;
        }

        // calls base functionality
        super.addUpload(username, file);

        // progress player state
        this._player_states[username] = "UPLOADED";

        // progress lobby state
        if (this._lobby_state === "NEW" 
            || (this._lobby_state === "UPLOADING" && this.getUploadStatusRemaining("UPLOADED") === 0)) {
            this._progressLobbyState();
        }

        return;
    }

    readySwap(username) {
        // check player state
        if (this._player_states[username] !== "UPLOADED") {
            return;
        }

        // check lobby state
        const allowable_states = ["UPLOADED", "READYING"];
        if (!allowable_states.includes(this._lobby_state)) {
            return;
        }
        // calls base functionality
        super.readySwap(username);

        // progress player state
        this._player_states[username] = "READY";

        // progress lobby state
        if (this._lobby_state === "UPLOADED"
            || (this._lobby_state === "READYING" && this.getUploadStatusRemaining("READY") === 0)) {
                this._progressLobbyState();
        }

        return;
    }

    readyRenew(username) {
        // check player state
        if (this._player_states[username] !== "READY") {
            return;
        }

        // check lobby state
        const allowable_states = ["DOWNLOADS", "RENEWING"];
        if (!allowable_states.includes(this._lobby_state)) {
            return;
        }
        // calls base functionality
        super.readyRenew(username);

        // progress player state
        this._player_states[username] = "RENEW";

        // progress lobby state
        if (this._lobby_state === "DOWNLOADS"
            || (this._lobby_state === "RENEWING" && this.getUploadStatusRemaining("RENEW") === 0)) {
                this._progressLobbyState();
        }

        return;
    }

    getUploadStatusRemaining(status) {
        // special case for renewed lobbies
        if (status === "RENEW" && this._lobby_state !== "RENEWING") {
            return 0;
        } else {
            return super.getUploadStatusRemaining(status);
        }
    }

    getResolvedLobbyState(username){
        switch (this._player_states[username]) {
            case "NEW":
                return "NEW";
            case "UPLOADED":
                if (this._lobby_state !== "READYING"){
                    return this._lobby_state;
                } else {
                    return "UPLOADED";
                }
            case "READY":
                if (this._lobby_state !== "RENEWING"){
                    return this._lobby_state;
                } else {
                    return "DOWNLOADS";
                }
            case "RENEW":
                return this._lobby_state;
        }
    }

};