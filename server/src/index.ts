import Express from "express";
import dotenv from "dotenv";
import socketIO from 'socket.io';
import Ajv, { JSONSchemaType, DefinedError } from 'ajv';
import { app, server, io, LobbyUtils } from "./ts/lobby";
import { signals } from "../../shared/signals";

const ajv = new Ajv();

app.use(Express.json());

app.use(Express.urlencoded({ extended: false }));

//app.use(upload.array());
app.use(Express.static('public'));

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const lobbies = new Map<string, LobbyType>();

interface userSocket extends socketIO.Socket {
    username: string | undefined;
    lobby_code: string | undefined;
}

// initialization object from client
interface LobbySettings {
    username: string;
    gamepath: string;
    lobby_size: number;
    lobby_code: string;
    lobby_password: string;
    gym_status: number;
}

// TODO: Move these interfaces to a shared declaration file
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

const settings_schema: JSONSchemaType<LobbySettings> = {
    type: "object",
    properties: {
        username: { type: "string", minLength: 1, maxLength: 64 },
        gamepath: { type: "string" },
        lobby_size: { type: "number", maximum: 10, minimum: 2 },
        lobby_code: { type: "string", maxLength: 6 },
        lobby_password: { type: "string", maxLength: 12 },
        gym_status: { type: "number", maximum: 255, minimum: 0 }
    },
    required: ["username", "gamepath", "lobby_size", "lobby_code", "lobby_password", "gym_status"],
    additionalProperties: false,
};

const validate_settings = ajv.compile(settings_schema);

io.on('connection', (socket: userSocket) => {

    // create lobby signal
    socket.on(signals.create, (lobby_settings: LobbySettings, callback: (a: LobbySettings, status: string) => void) => {
        // check lobby settings schema
        if (!validate_settings(lobby_settings)) {
            callback(lobby_settings, `Invalid lobby settings; encountered errors: ${validate_settings.errors}`);
            return;
        }

        // disallow lobby creation from registered sockets
        if (Object.keys(socket).indexOf('username') >= 0 && socket.username !== undefined) {
            callback(
                lobby_settings, 
                `Socket is already registered as user: ${socket.username}, in lobby ${socket.lobby_code}`
            );
            return;
        }

        // create lobby
        if (!LobbyUtils.createLobby(lobbies, lobby_settings)) {
            callback(lobby_settings, 'Unable to create lobby with provided settings...');
            return;
        }

        if (!LobbyUtils.addPlayer(lobbies, lobby_settings)) {
            callback(lobby_settings,
                'Unable to add player to new lobby.\n\n' +
                'This is likely a bug on our end, so please report this on the ' +
                'issue page at https://github.com/vacuousplanet/pokeswap'
            );
            return;
        }

        // register socket username and lobby code
        socket.username = lobby_settings.username;
        socket.lobby_code = lobby_settings.lobby_code;

        // create room for lobby
        socket.join(lobby_settings.lobby_code);

        callback(lobby_settings, 'ok');
    });

    // join lobby signal
    socket.on(signals.join, (lobby_settings: LobbySettings, callback: (a: LobbySettings, status: string) => void) => {
        // check lobby settings schema
        if (!validate_settings(lobby_settings)) {
            callback(lobby_settings, `Invalid lobby settings; encountered errors: ${validate_settings.errors}`);
            return;
        }

        // disallow lobby joining from registered sockets
        if (Object.keys(socket).indexOf('username') >= 0 && socket.username !== undefined) {
            callback(
                lobby_settings,
                `Socket is already registered as user: ${socket.username}, in lobby ${socket.lobby_code}`
            );
            return;
        }

        // TODO: add more depth to error signalling
        // add player
        if (!LobbyUtils.addPlayer(lobbies, lobby_settings)) {
            callback(lobby_settings, 'Unable to join lobby...');
            return;
        }

        // register socket username and lobby code
        socket.username = lobby_settings.username;
        socket.lobby_code = lobby_settings.lobby_code;

        // create room for lobby
        socket.join(lobby_settings.lobby_code);

        callback(lobby_settings, 'ok');

        // notify other players
        io.in(socket.lobby_code).emit('player-joined', `${socket.username} has joined the lobby...`);
    });

    // ready player signal
    // noticing that a callback should generally be passed here
    socket.on(signals.ready, (callback: (status: string) => void) => {
        if (!socket.lobby_code || !socket.username) {
            callback('Socket is not registered');
            return;
        }

        LobbyUtils.readyPlayer(lobbies, socket.lobby_code, socket.username);
        io.in(socket.lobby_code).emit('player-ready', `${socket.username} is ready...`);
        if (LobbyUtils.checkAllReady(lobbies, socket.lobby_code)) {
            LobbyUtils.startLobby(lobbies, socket.lobby_code);
            io.in(socket.lobby_code).emit(
                'start-game',
                LobbyUtils.getPlayerNames(lobbies, socket.lobby_code),
                'All players ready; starting emulation...'
            );
        }
    });

    // state update signal
    socket.on(signals.beat_gym, (gym_state: number, callback: (status: string) => void) => {
        if (!socket.lobby_code || !socket.username) {
            callback('Socket is not registered');
            return;
        }

        LobbyUtils.gymBeaten(lobbies, socket.lobby_code, gym_state);

        // tell erbody that the gym was beaten
        socket.to(socket.lobby_code).emit('beat-gym', gym_state, `${socket.username} has beaten a new gym!`);
        callback('submitted new gym status...');
    });

    // save data upload signal
    socket.on(signals.upload_team, (team_data: Uint8Array, callback: (status: string) => void) => {
        if (!socket.lobby_code || !socket.username) {
            callback('Socket is not registered');
            return;
        }

        // add upload to lobby
        LobbyUtils.addUpload(lobbies, socket.lobby_code, socket.username, team_data);
        if (LobbyUtils.checkAllUploaded(lobbies, socket.lobby_code)) {
            LobbyUtils.generateDerangement(lobbies, socket.lobby_code);
            io.to(socket.lobby_code).emit('new-teams-ready');
        }

        callback('successful team upload');
    });

    // asking for new team data
    socket.on(signals.download_team, (callback: (new_team: Uint8Array | undefined, status: string) => void) => {
        if (!socket.lobby_code || !socket.username) {
            callback(<Uint8Array>{}, 'Socket is not registered');
            return;
        }

        callback(LobbyUtils.getDerangedData(lobbies, socket.lobby_code, socket.username), 'ok');
    });

    /*
    // TODO: send back updated lobby state with removed player info
    socket.on(signals.continue_vote, (vote: boolean, callback: (player_list: string[], status: string) => void) => {
        if (!socket.lobby_code || !socket.username) {
            callback([], 'Socket is not registered');
            return;
        }

        const responce = lobby.addVote(socket.username, vote);
        const expected_players = lobby.getExpectedPlayers();
        if (responce === "Ending session...") {
            lobbies.delete(socket.lobby_code);
        }
        callback(expected_players, responce);
        return;
    });

    socket.on(signals.disconnect, () => {
        if (!socket.lobby_code || !socket.username) {
            return;
        }

        LobbyUtils.handlePlayerDisconnect(lobbies, socket.lobby_code, socket.username);
    });
    */

});

const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));