import Express from "express";
import dotenv from "dotenv";
import socketIO from 'socket.io';
import Ajv, {JSONSchemaType, DefinedError} from 'ajv';
import {app, server, io, Lobby} from "./ts/lobby";

const ajv = new Ajv();

app.use(Express.json());

app.use(Express.urlencoded({ extended: false}));

//app.use(upload.array());
app.use(Express.static('public'));

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const lobbies = new Map<string, Lobby>();

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

const settings_schema: JSONSchemaType<LobbySettings> = {
    type: "object",
    properties: {
        username: {type: "string", minLength: 1, maxLength: 64},
        gamepath: {type: "string"},
        lobby_size: {type: "number", maximum: 10, minimum: 2},
        lobby_code: {type: "string", maxLength: 6},
        lobby_password: {type: "string", maxLength: 12},
        gym_status: {type: "number", maximum: 255, minimum: 0}
    },
    required: ["username", "gamepath", "lobby_size", "lobby_code", "lobby_password", "gym_status"],
    additionalProperties: false,
};

const validate_settings = ajv.compile(settings_schema);

// lobby and user validation middleware
/*
io.use((socket: userSocket, next) => {
    // check for lobby existance
    console.log(`middleware hit: ${socket.}`)
    if (socket.lobby_code !== undefined && !lobbies.has(socket.lobby_code)) {
        console.log('no lobby there')
        next(new Error(`No lobby with code ${socket.lobby_code} could be found`));
        return;
    }
    // check for user in lobby
    if (lobbies.get(socket.lobby_code).getPlayerState(socket.username) === undefined) {
        console.log('user not in lobby')
        next(new Error(`Not authorized to access ${socket.lobby_code}`));
        return;
    }

    // continue routing otherwise
    next();
});
*/

io.on('connection', (socket: userSocket) => {

    //console.log('yo waddup')

    // create lobby signal
    socket.on('create', (lobby_settings: LobbySettings, callback: (a: LobbySettings, status: string) => void) => {

        if (!validate_settings(lobby_settings)) {
            callback(lobby_settings, `Invalid lobby settings; encountered errors: ${validate_settings.errors}`);
            return;
        }

        // registered sockets shouldn't make lobbies
        if (Object.keys(socket).indexOf('username') >= 0 && socket.username !== undefined) {
            callback(lobby_settings, `Socket is already registered as user: ${socket.username}`);
            return;
        }

        // lockout registered users from making lobbies
        if (lobbies.has(lobby_settings.lobby_code)) {
            if (lobbies.get(lobby_settings.lobby_code)?.getPlayerState(lobby_settings.username) !== undefined) {
                callback(lobby_settings, `${lobby_settings.username} is already in lobby ${lobby_settings.lobby_code}`);
                return;
            }
        }

        // generate random 6 digit code and verify that it's new
        var new_code = Math.random().toString(36).substr(2, 6);
        while(new_code in lobbies){
            new_code = Math.random().toString(36).substr(2, 6);
        }

        // create lobby @ new code
        lobbies.set(
            new_code,
            new Lobby('lmao', lobby_settings.gamepath, lobby_settings.lobby_size, new_code, lobby_settings.gym_status)
        );

        const lobby = lobbies.get(new_code);

        if (!lobby) {
            callback(lobby_settings, 'Unable to create lobby with provided settings...');
            return;
        }

        lobby_settings.lobby_code = new_code;
        lobby_settings.lobby_password = 'lmao';

        // try adding player to lobby
        const revised_username = lobby.addPlayer(lobby_settings.username, 'lmao');
        if (revised_username === undefined) {
            // lobby full (idk how to handle wrong pw's yet)
            callback(lobby_settings, 
                'Unable to add player to new lobby.\n\n' +
                'This is likely a bug on our end, so please report this on the ' +
                'issue page at https://github.com/vacuousplanet/pokeswap'
            );
            return;
        }

        socket.username = revised_username;
        socket.lobby_code = new_code;

        // create room for lobby
        socket.join(new_code);

        // send username back to client
        callback(lobby_settings, 'ok');
    });

    // join lobby signal
    socket.on('join', (lobby_settings: LobbySettings, callback: (a: LobbySettings, status: string) => void) => {

        if (!validate_settings(lobby_settings)) {
            callback(lobby_settings, `Invalid lobby settings; encountered errors: ${validate_settings.errors}`);
            return;
        }

        if (!lobbies.has(lobby_settings.lobby_code)) {
            callback(lobby_settings, `Invalid lobby code ${lobby_settings.lobby_code}`);
            return;
        }

        const revised_username = lobbies.get(lobby_settings.lobby_code)?.addPlayer(lobby_settings.username, 'lmao');
        if (revised_username === undefined) {
            // lobby full (idk how to handle wrong pw's yet
            callback(lobby_settings, 'Lobby is full...');
            return;
        }

        socket.username = revised_username;
        socket.lobby_code = lobby_settings.lobby_code;
        socket.join(lobby_settings.lobby_code);

        // make typescript behave (eye-roll)
        const lobby = lobbies.get(lobby_settings.lobby_code);
        if (lobby) {
            lobby_settings.gym_status = lobby.getInitGymStatus();
        }

        callback(lobby_settings, 'ok');

        io.in(socket.lobby_code).emit('player-joined', `${socket.username} has joined the lobby...`);

        //socket.emit('lobbyJoined', lobby_settings.lobby_code, revised_username);
    });

    socket.on('resume', (lobby_settings: LobbySettings, callback: (a: LobbySettings, status: string) => void) => {

        if (!validate_settings(lobby_settings)) {
            callback(lobby_settings, `Invalid lobby settings; encountered errors: ${validate_settings.errors}`);
            return;
        }

        // TODO: validate users somehow
        if (!lobbies.has(lobby_settings.lobby_code)) {
            // create lobby

            // generate random 6 digit code and verify that it's new
            var new_code = Math.random().toString(36).substr(2, 6);
            while(new_code in lobbies){
                new_code = Math.random().toString(36).substr(2, 6);
            }

            // create lobby @ new code
            lobbies.set(
                new_code,
                new Lobby('lmao', lobby_settings.gamepath, lobby_settings.lobby_size, new_code, lobby_settings.gym_status)
            );

            const lobby = lobbies.get(new_code);

            if (!lobby) {
                callback(lobby_settings, 'Unable to create lobby with provided settings...');
                return;
            }

            lobby_settings.lobby_code = new_code;
            lobby_settings.lobby_password = 'lmao';

            // try adding player to lobby
            const revised_username = lobby.addPlayer(lobby_settings.username, 'lmao');
            if (revised_username === undefined) {
                // lobby full (idk how to handle wrong pw's yet)
                callback(lobby_settings, 
                    'Unable to add player to new lobby.\n\n' +
                    'This is likely a bug on our end, so please report this on the ' +
                    'issue page at https://github.com/vacuousplanet/pokeswap'
                );
                return;
            }

            socket.username = revised_username;
            socket.lobby_code = new_code;

            // create room for lobby
            socket.join(new_code);

            // send username back to client
            callback(lobby_settings, 'ok');

        } else {
            // join lobby
            const revised_username = lobbies.get(lobby_settings.lobby_code)?.addPlayer(lobby_settings.username, 'lmao')
            if (revised_username === undefined) {
                callback(lobby_settings, 'Lobby is full...');
                return;
            }

            socket.username = revised_username;
            socket.lobby_code = lobby_settings.lobby_code;
            socket.join(lobby_settings.lobby_code);

            const lobby = lobbies.get(lobby_settings.lobby_code);
            if (lobby) {
                lobby_settings.gym_status = lobby.getInitGymStatus();
            }

            callback(lobby_settings, 'ok');

            io.in(socket.lobby_code).emit('player-joined', `${socket.username} has joined the lobby...`);
        }

    });

    // ready player signal
    // noticing that a callback should generally be passed here
    socket.on('ready', (callback: (status: string) => void) => {
        

        console.log('ready signal')

        if (!socket.lobby_code || !socket.username) {
            callback('Socket is not registered');
            return;
        }

        const lobby = lobbies.get(socket.lobby_code);

        if (!lobby) {
            callback(`Could not find lobby ${socket.lobby_code}`);
            return;
        }

        if (!lobby.getPlayerState(socket.username)) {
            callback(`Unautorized attempt to access lobby...`);
            return;
        }

        lobby.readyPlayer(socket.username);

        //console.log(`hey there ${socket.username} in: ${socket.lobby_code}`);
        //console.log(socket.rooms);
        // tell lobby object the player is ready freddy

        io.in(socket.lobby_code).emit('player-ready', `${socket.username} is ready...`)
    });

    // state update signal
    socket.on('beat-gym', (gym_state: number, callback: (status: string) => void) => {
        if (!socket.lobby_code || !socket.username) {
            callback('Socket is not registered');
            return;
        }

        const lobby = lobbies.get(socket.lobby_code);

        if (!lobby) {
            callback(`Could not find lobby ${socket.lobby_code}`);
            return;
        }

        if (!lobby.getPlayerState(socket.username)) {
            callback(`Unautorized attempt to access lobby...`);
            return;
        }

        console.log(`${socket.username} beat gym`)

        // tell erbody that the gym was beaten
        socket.to(socket.lobby_code).emit('beat-gym', gym_state, `${socket.username} has beaten a new gym!`);

        callback('submitted new gym status...')
    });

    // save data upload signal
    socket.on('upload-team', (team_data: Uint8Array, callback: (status: string) => void) => {
        if (!socket.lobby_code || !socket.username) {
            callback('Socket is not registered');
            return;
        }

        // add upload to lobby
        const lobby = lobbies.get(socket.lobby_code);

        if (!lobby) {
            callback(`Could not find lobby ${socket.lobby_code}`);
            return;
        }

        console.log(`${socket.username} uploaded team:`)
        console.log(team_data);

        lobby.addUpload(socket.username, team_data);

        callback('successful team upload');

    });

    // asking for new team data
    socket.on('download-team', (callback: (new_team: Uint8Array | undefined, status: string) => void) => {
        if (!socket.lobby_code || !socket.username) {
            callback(<Uint8Array>{}, 'Socket is not registered');
            return;
        }

        const lobby = lobbies.get(socket.lobby_code);

        if (!lobby) {
            callback(<Uint8Array>{}, `Could not find lobby ${socket.lobby_code}`);
            return;
        }

        callback(lobby.getTeamData(socket.username), 'ok');
        return;
    });

    // TODO: send back updated lobby state with removed player info
    socket.on('continue-vote', (vote: boolean, callback: (player_list: string[], status: string) => void) => {
        if (!socket.lobby_code || !socket.username) {
            callback([], 'Socket is not registered');
            return;
        }

        const lobby = lobbies.get(socket.lobby_code);

        if (!lobby) {
            callback([], `Could not find lobby ${socket.lobby_code}`);
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

    // TODO: send lobby state?
    socket.on('disconnect', () => {
        if (!socket.lobby_code || !socket.username) {
            return;
        }

        const lobby = lobbies.get(socket.lobby_code);

        if (!lobby) {
            return;
        }


        if (lobby.getPlayerState(socket.username)) {
            console.log(`removing player ${socket.username}`);
            lobby.removePlayer(socket.username);
            if (lobby.getNumPlayers() < 2) {
                console.log(`deleting lobby ${socket.lobby_code}`);
                lobbies.delete(socket.lobby_code);
            }
        }

        return;

    });

});

/*  OLD LOGOUT CODE
app.post('/lobby/:lobbyID/logout', (req, res) => {

    var lobby = lobbies[req.params['lobbyID']];

    // TODO: Handle arbitrary state log outs in lobby class
    const allowable_states = ["NEW", "UPLOADING"];
    if (!allowable_states.includes(lobby.getLobbyState())) {
        res.status(204).send();
        return;
    }

    lobby.removePlayer(req.session.username);

    console.log(lobbies);

    console.log(lobby.getNumPlayers())
    if (lobby.getNumPlayers() === 0) {
        console.log('should delete lobby')
        lobby = undefined;
        delete lobbies[req.params['lobbyID']];
    }

    console.log(lobbies);

    req.session.lobby = undefined;
    req.session.username = undefined;

    // TODO: delete other session parameters (username, etc)
    //       as well as any other user specific data (uploads)
    res.redirect('/');
});
*/

const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));