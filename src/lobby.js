

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
//
// Client/player html data depends on BOTH player and lobby states


// Base lobby class
// This handles stuff like actual functionality
class LobbyBase {

    #password;
    #game_version;
    #lobby_size;
    #players;
    #uploads;
    #lobby_state;
    #player_states;

    constructor(password, game_version, lobby_size) {
        this.#password = password;
        this.#game_version = game_version;
        this.#lobby_size = lobby_size;
        this.#players = [];
        this.#uploads = {};

        this.#lobby_state = "NEW";
        this.#player_states = {};
    }

    // TODO: Check if player can be added (statewise)
    addPlayer(username, password) {
        this.players.push(username);
        this.player_states[username] = "NEW";
        this.uploads[username] = {
            data: undefined,
            status: "NONE",
        };
    }

    // TODO: Check if player can be removed (statewise)
    removePlayer(username) {
        const player_index = this.players.indexOf(username);
        if (player_index > -1) {
            this.players.splice(player_index, 1);
            this.player_states[username] = undefined;
            this.uploads[username] = undefined;
        }
    }

    addUpload(username, file) {
        this.uploads[username] = {
            data: file,
            status: "UPLOADED",
        };
    }

    readySwap(username) {
        this.uploads[username]['status'] = "READY";
    }

    getUploadStatusCount(status) {
        var count = 0;
        Object.keys(this.uploads).forEach(username =>
            count += (this.uploads[username]['status'] === status)
        );
        return count;
    }

    getUploadStatusRemaining(status) {
        return this.lobby_size - this.getUploadStatusCount(status);
    }

    listFilepaths() {
        return Object.keys(this.uploads).map(username =>
            this.uploads[username]['data']['path']
        );
    }

    getFilepath(username) {
        return this.uploads[username]['data']['path'];
    }

    // Use this to check for unauthorized lobby access
    getPlayerState(username) {
        if (this.players.includes(username)) {
            return this.player_states[username];
        } else {
            return undefined;
        }
    }

    getLobbyState() {
        return this.lobby_state;
    }

}

// actual Lobby class
// this handles stuff like allowable state calls
export default class Lobby extends LobbyBase {

}