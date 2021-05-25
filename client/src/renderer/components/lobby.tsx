// once server shit is added, this is gonna be a nightmare file

// update 01/24/2021 - oh yeah baybee it's nightmare time

import React from 'react'

import {
    BrowserRouter as Router,
    Switch,
    Route,
    useRouteMatch
} from "react-router-dom";

import './lobby.scss';

import LobbySetup from './setup';
import LobbyConnecting from './connecting';


const Lobby = () => {

    let { path, url } = useRouteMatch();

    return (
        <>
        <Switch>
            <Route exact path={path}>
                <LobbySetup/>
            </Route>
            <Route path={`${path}/connect/`}>
                <LobbyConnecting />
            </Route>
        </Switch>
        </>
    );
}

export default Lobby;