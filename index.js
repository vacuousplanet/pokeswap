import Express from "express";
import session from "express-session";
import multer from "multer";

import {multicheckswap} from "./src/checkswap.js";

const upload = multer({dest: './public/data/uploads/'});

const app = Express();

app.set('view-engine', 'ejs');

app.use(Express.json());

app.use(Express.urlencoded({ extended: false}));

//app.use(upload.array());
app.use(Express.static('public'));

// TODO: dotenv secret phrase
app.use(session({
    secret: 'secret phrase',
    resave: false,
    saveUninitialized: false,
}));

// use routes maybe?
// routes
//      lobby/ID#
//      lobby/ID#/messages
//      
var lobbies = {};

// landing
app.get('/', (req, res) => {
    // check for lobby existence
    if(!req.session.lobby || !(req.session.lobby in lobbies)) {
        res.redirect('/connect');
    }
    else {
        res.redirect(`/lobby/${req.session.lobby}`);
    }
});

app.get('/connect', (req, res) => {
    if (req.session.lobby in lobbies) {
        res.redirect(`lobby/${req.session.lobby}`);
        return;
    }
    res.render('connect.ejs')
});

app.post('/connect', (req, res) => {
    // authenticate lobby info and redirect to lobby

    // disallow lobby connection for lobbied users
    if (req.session.lobby in lobbies) {
        res.status(204).send();
        return;
    }

    // check for lobby existence
    if(!(req.body.lobbyID in lobbies)) {
        res.status(204).send();
        console.log('invalid lobby');
        return;
    }

    // create reference to lobby
    var lobby = lobbies[req.body.lobbyID];

    // don't overfill lobby
    if (lobby['lobby_size'] <= lobby['players'].length) {
        console.log('lobby full!');
        res.status(204).send();
        return;
    }

    // this is kinda bad tbh
    while(lobby['players'].includes(req.body.usernameConnect)) {
        req.body.usernameConnect += '0';
    }

    req.session.lobby = req.body.lobbyID;
    req.session.username = req.body.usernameConnect;

    lobby['players'].push(req.body.usernameConnect);

    res.redirect(`lobby/${req.body.lobbyID}`);
});

app.post('/create', (req, res) => {
    // disallow lobby creation for lobbied users
    if (req.session.lobby in lobbies) {
        return;
    }
    // check for correct username
    if(req.body.usernameCreate === '') {
        console.log('must fill username');
        return;
    }

    else if(req.body.gameVersion === 'Choose a game version'){
        console.log('must choose game version');
        return;
    }
    else if(req.body.lobbySize === ''){
        req.body.lobbySize = '2';
    }

    // generate random 6 digit code and verify that it's new
    var new_code = Math.random().toString(36).substr(2, 6);
    while(new_code in lobbies){
        new_code = Math.random().toString(36).substr(2, 6);
    }
    console.log(`Creating new lobby ${new_code}`);
    
    // TODO: generate password and pre-authenticate session

    // might want to specify Lobby object ?
    lobbies[new_code] = {
        password: 'lmao',
        game_version: req.body.gameVersion.replace(/\//g, ''),
        lobby_size: parseInt(req.body.lobbySize),
        players: [],
        uploads: {},
        downloads: false,
    };

    req.session.lobby = new_code;
    req.session.username = req.body.usernameCreate;

    lobbies[new_code]['players'].push(req.body.usernameCreate);

    res.redirect(`/lobby/${new_code}`);
});


app.get('/lobby/:lobbyID', (req, res) => {
    // authenticate and render lobby page
    if(!(req.params['lobbyID'] in lobbies)) {
        // flash error message
        res.redirect('/');
        return;
    }

    res.render('lobby.ejs', {
        lobbyID: req.params['lobbyID'],
        lobbyState: req.session.lobbyState,
    });
});

app.get('/lobby/:lobbyID/messages', (req, res) => {
    // authenticate and get messages
    if(!(req.params['lobbyID'] in lobbies)) {
        // flash error message
        res.redirect('/connect');
    }
});

app.post('/lobby/:lobbyID/messages', (req, res) => {
    // authenticate and post message
});


app.post('/lobby/:lobbyID/upload', upload.single('saveFile'), (req, res) => {
    // authenticate and upload save data
    if(!(req.params['lobbyID'] in lobbies)) {
        console.log('not a valid lobby');
        return;
    }
    // TODO: validate user

    var lobby = lobbies[req.params['lobbyID']];
    // TODO: validate save file (idk exactly how deep this would go)

    // map player to uploaded file and add to lobby data
    lobby['uploads'][req.session.username] = {
        data: req.file,
        status: 'success',
    };

    // return 204 Code
    res.status(204).send();

});

app.get('/lobby/:lobbyID/check-upload-success', (req, res) => {
    if(!(req.params['lobbyID'] in lobbies)) {
        console.log('not a valid lobby');
        return;
    }

    var lobby = lobbies[req.params['lobbyID']];
    if(lobby['uploads'][req.session.username] === undefined){
        res.json({
            status : 'waiting',
        })
    } else {
        res.json({
            status : lobby['uploads'][req.session.username]['status'],
        })
    }
});

app.post('/lobby/:lobbyID/update-lobby-status', (req, res) => {
    if(!(req.params['lobbyID'] in lobbies)) {
        console.log('not a valid lobby');
        return;
    }
    console.log(req.body.lobby_state)
    req.session.lobbyState = req.body.lobby_state;

    // everything's fine
    res.status(204).send();
});

app.get('/lobby/:lobbyID/check-uploads', async (req, res) => {
    if(!(req.params['lobbyID'] in lobbies)) {
        console.log('not a valid lobby');
        return;
    }

    var lobby = lobbies[req.params['lobbyID']];

    const remaining = lobby['lobby_size'] - Object.keys(lobby['uploads']).length;
    if (remaining === 0) {
        req.session.lobbyState = "UPLOADS_FULL";
    }

    res.json({
        remaining: remaining,
    });
});


app.post('/lobby/:lobbyID/swap', (req, res) => {
    // start swap if all players in lobby locked in
    // otherwise just update that player X is ready
    if (!(req.params['lobbyID'] in lobbies)) {
        res.status(204).send();
        return;
    }

    // update upload status to ready and 
    var lobby = lobbies[req.params['lobbyID']];

    lobby['uploads'][req.session.username]['status'] = 'ready';

    var start_swap = true;
    var users_not_ready = 0;
    for (const username in lobby['uploads']) {
        const user_ready = (lobby['uploads'][username]['status'] === 'ready');
        users_not_ready += Number(!user_ready);
        start_swap = start_swap && user_ready;
    }

    if (!start_swap) {
        // TODO: respond with a thing involving users not ready
        res.status(204).send();
        return;
    }

    // otherwise, do the swapping
    multicheckswap(
        Object.keys(lobby['uploads']).map( key => lobby['uploads'][key]['data']['path']),
        lobby['game_version']
    );

    lobby['downloads'] = true;

    res.status(204).send();

    return;
    
});

app.get('/lobby/:lobbyID/check-swap', (req, res) => {
    if(!(req.params['lobbyID'] in lobbies)) {
        console.log('not a valid lobby');
        return;
    }

    var lobby = lobbies[req.params['lobbyID']];

    var users_not_ready = 0;
    for (const username in lobby['uploads']) {
        const user_ready = (lobby['uploads'][username]['status'] === 'ready');
        users_not_ready += Number(!user_ready);
    }

    res.json({
        remaining: users_not_ready,
        downloads: lobby['downloads'],
    });
});

app.post('/lobby/:lobbyID/download', (req, res) => {
    // authenticate and recieve save data from lobby
    if(!(req.params['lobbyID'] in lobbies)) {
        // flash error message or something idk
        res.redirect('/connect');
        return;
    }

    const file = lobbies[req.params['lobbyID']]['uploads'][req.session.username]['data']['path'];

    // TODO: Check that file is actually ready!!!
    res.download(file);

});


app.post('/logout', (req, res) => {
    req.session.lobby = undefined;
    // TODO: lobby should check for players
    //       if none, delete/queue-delete lobby

    // TODO: delete other session parameters (username, etc)
    //       as well as any other user specific data (uploads)
    res.redirect('/');
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));