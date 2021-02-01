import Express from "express";
import dotenv from "dotenv";
import socketIO from 'socket.io'
import {app, server, io, Lobby} from "./ts/lobby";

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
}

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

    console.log('yo waddup')

    // create lobby signal
    socket.on('create', (lobby_settings: LobbySettings, callback: (a: LobbySettings, status: string) => void) => {
        // TODO: decode lobby_settings and use callback
        console.log(lobby_settings);
        // generate random 6 digit code and verify that it's new
        var new_code = Math.random().toString(36).substr(2, 6);
        while(new_code in lobbies){
            new_code = Math.random().toString(36).substr(2, 6);
        }

        // create lobby @ new code
        lobbies.set(
            new_code,
            new Lobby('lmao', lobby_settings.gamepath, lobby_settings.lobby_size, new_code)
        );

        lobby_settings.lobby_code = new_code;
        lobby_settings.lobby_password = 'lmao';

        // try adding player to lobby
        const revised_username = lobbies.get(new_code).addPlayer(lobby_settings.username, 'lmao');
        if (revised_username === undefined) {
            // lobby full (idk how to handle wrong pw's yet)
            callback(lobby_settings, 'bad')
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

        const revised_username = lobbies.get(lobby_settings.lobby_code).addPlayer(lobby_settings.username, 'lmao');
        if (revised_username === undefined) {
            // lobby full (idk how to handle wrong pw's yet
            callback(lobby_settings, 'bad');
            return;
        }

        socket.username = revised_username;
        socket.lobby_code = lobby_settings.lobby_code;
        socket.join(lobby_settings.lobby_code);

        callback(lobby_settings, 'ok');

        socket.to(socket.lobby_code).emit('player-join', `${socket.username} has joined the lobby...`);

        //socket.emit('lobbyJoined', lobby_settings.lobby_code, revised_username);
    });


    // ready player signal
    socket.on('ready', () => {
        console.log(`hey there ${socket.username} in: ${socket.lobby_code}`);
        console.log(socket.rooms);
        socket.to(socket.lobby_code).emit('player-ready', `${socket.username} is ready...`)
    })

    // state update signal
    socket.on('beat-gym', () => {
        if (socket.lobby_code === undefined) {
            socket.emit('noLobby');
        }

        // tell erbody that the gym was beaten
        socket.to(socket.lobby_code).emit('beatGym');
    });

    // save data upload signal
    socket.on('upload-team', (team_data: Buffer) => {
        if (socket.lobby_code === undefined) {
            socket.emit('noLobby');
        }

        // add upload to lobby
        lobbies.get(socket.lobby_code).addUpload(socket.username, team_data);

    })

    // asking for new team data
    socket.on('download-team', () => {
        socket.emit('downloadTeam', lobbies.get(socket.lobby_code).getTeamData(socket.username));
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