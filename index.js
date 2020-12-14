import Express from "express";
import session from "express-session";
import multer from "multer";

const upload = multer();

const app = Express();

app.set('view-engine', 'ejs')

app.use(Express.json())

app.use(Express.urlencoded({ extended: false}));

app.use(upload.array());
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
        return;
    }

});

app.post('/create', (req, res) => {
    // disallow lobby creation for lobbied users
    if (req.session.lobby in lobbies) {
        return;
    }
    // check for correct username
    // TODO: highlight username field as red
    if(req.body.usernameCreate === '') {
        console.log('must fill username');
        return;
    }
    // TODO: highlight gameVersion field as red
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
        game_version: req.body.gameVersion,
        lobby_size: parseInt(req.body.lobbySize),
        players: [],
    }

    req.session.lobby = new_code;

    res.redirect(`/lobby/${new_code}`)
})


app.get('/lobby/:lobbyID', (req, res) => {
    // authenticate and render lobby page
    if(!(req.params['lobbyID'] in lobbies)) {
        // flash error message
        res.redirect('/');
        return;
    }
    res.render('lobby.ejs')
})

app.get('/lobby/:lobbyID/messages', (req, res) => {
    // authenticate and get messages
    if(!(req.params['lobbyID'] in lobbies)) {
        // flash error message
        res.redirect('/connect');
    }
})

app.post('/lobby/:lobbyID/messages', (req, res) => {
    // authenticate and post message
})


app.post('/lobby/:lobbyID/upload', (req, res) => {
    // authenticate and upload save data
})

// might need to do some socket polling to determine active users
app.post('/lobby/:lobbyID/swap', (req, res) => {
    // start swap if all players in lobbsy locked in
    // otherwise just update that player X is ready
})

app.get('/lobby/:lobbyID/download', (req, res) => {
    // authenticate and recieve save data from lobby
    // client will ping download until done/error
    if(!(req.params['lobbyID'] in lobbies)) {
        // flash error message
        res.redirect('/connect');
    }
})


app.post('/logout', (req, res) => {
    req.session.lobby = undefined;
    // TODO: lobby should check for players
    // if none, delete/queue-delete lobby
    res.redirect('/')
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`))