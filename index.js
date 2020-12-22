import Express from "express";
import session from "express-session";
import multer from "multer";

import {multicheckswap} from "./src/checkswap.js";
import {Lobby} from "./src/lobby.js";

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

var lobbies = {};


// lobby and user validation middleware
app.use('/lobby/:lobbyID', (req, res, next) => {
    // check for lobby existance
    if (!(req.params['lobbyID'] in lobbies)) {
        res.redirect('/')
        return;
    }
    var lobby = lobbies[req.params['lobbyID']];

    // check for user in lobby
    if (lobby.getPlayerState(req.session.username) === undefined) {
        res.redirect('/')
        return;
    }

    // continue routing otherwise
    next();
});


// landing page
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

    // try adding player
    const username = lobby.addPlayer(req.body.usernameConnect, 'lmao');
    if (username === undefined) {
        console.log('lobby full!');
        res.status(204).send();
        return;
    }

    req.session.lobby = req.body.lobbyID;
    req.session.username = username;

    res.redirect(`lobby/${req.body.lobbyID}`);
});

// TODO: actually flash errors to client here
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

    // Create new lobby
    lobbies[new_code] = new Lobby('lmao', req.body.gameVersion.replace(/\//g, ''), parseInt(req.body.lobbySize));

    req.session.lobby = new_code;
    req.session.username = req.body.usernameCreate;

    lobbies[new_code].addPlayer(req.body.usernameCreate, 'lmao');

    res.redirect(`/lobby/${new_code}`);
});


app.get('/lobby/:lobbyID', (req, res) => {
    // TODO: use lobby object's lobbyState
    var lobby = lobbies[req.params['lobbyID']];

    console.log(lobby.getLobbyState());
    res.render('lobby.ejs', {
        lobbyID: req.params['lobbyID'],
        lobbyState: lobby.getLobbyState(),
    });
});

app.get('/lobby/:lobbyID/messages', (req, res) => {

});

app.post('/lobby/:lobbyID/messages', (req, res) => {
    // authenticate and post message
});


app.post('/lobby/:lobbyID/upload', upload.single('saveFile'), (req, res) => {

    var lobby = lobbies[req.params['lobbyID']];
    // TODO: validate save file (idk exactly how deep this would go)

    // map player to uploaded file and add to lobby data
    lobby.addUpload(req.session.username, req.file);

    // return 204 Code
    res.status(204).send();

});

app.get('/lobby/:lobbyID/check-upload-success', (req, res) => {
    var lobby = lobbies[req.params['lobbyID']];
    res.json({
        status: lobby.getPlayerUploadStatus(req.session.username)
    });
});

app.post('/lobby/:lobbyID/update-lobby-status', (req, res) => {

    console.log(req.body.lobby_state);
    req.session.lobbyState = req.body.lobby_state;

    // everything's fine
    res.status(204).send();
});

app.get('/lobby/:lobbyID/check-uploads', async (req, res) => {

    var lobby = lobbies[req.params['lobbyID']];

    const remaining = lobby.getUploadStatusRemaining("UPLOADED");

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

    // update upload status to ready and 
    var lobby = lobbies[req.params['lobbyID']];

    lobby.readySwap(req.session.username);

    var users_not_ready = lobby.getUploadStatusRemaining("READY");

    if (users_not_ready > 0) {
        // TODO: respond with a thing involving users not ready
        res.status(204).send();
        return;
    }

    // otherwise, do the swapping
    multicheckswap(lobby.listFilepaths(), lobby.getGameVersion());

    res.status(204).send();

    return;
    
});

app.get('/lobby/:lobbyID/check-swap', (req, res) => {

    var lobby = lobbies[req.params['lobbyID']];

    var users_not_ready = lobby.getUploadStatusRemaining("READY");

    res.json({
        remaining: users_not_ready,
        downloads: (users_not_ready === 0),
    });
});

app.post('/lobby/:lobbyID/download', (req, res) => {
    // authenticate and recieve save data from lobby

    const file = lobbies[req.params['lobbyID']].getFilepath(req.session.username);

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