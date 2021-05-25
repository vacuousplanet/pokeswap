import { ipcRenderer } from 'electron';
import React, { useState } from 'react';
import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link,
    Redirect,
    useLocation
} from "react-router-dom";

import Config from './config';
import Lobby from './lobby';
import Resume from './resume';

import './sidebar.scss';


type SidebarProps = {
    collapsed: boolean,
    toggleCollapse: React.Dispatch<React.SetStateAction<boolean>>,
}


const SidebarContent = ({collapsed, toggleCollapse}: SidebarProps) => {

    const location = useLocation();
    const connected = location.pathname === "/lobby/connect"

    console.log(location.pathname);

    return (
        <>
        <div className={collapsed || connected ? "closed" : "open"}>
            <Link to="/lobby">Lobby</Link>
            <Link to="/resume">Resume</Link>
            <Link to="/config">Configuration</Link>
        </div>
        <button
            className={(collapsed ? "inactive" : "active") + " square"}
            disabled={connected}
            hidden={connected}
            style={connected ? {visibility: "hidden"} : {visibility: "visible"}}
            onClick={() => toggleCollapse(collapsed => !collapsed)}
        >
            ☰
        </button>
        </>
    );
}


const Sidebar = () => {
    const [collapsed, toggleCollapse] = useState(true);

    return (
        <>
        <Router>
            <SidebarContent collapsed={collapsed} toggleCollapse={toggleCollapse} />
            
            <div className={collapsed ? "full" : "partial"}>
                <Switch>
                    <Route path="/lobby">
                        <Lobby />
                    </Route>
                    <Route path="/resume">
                        <Resume />
                    </Route>
                    <Route path="/config">
                        <Config />
                    </Route>
                    <Redirect from="/" to="/lobby"/>
                </Switch>
            </div>
        </Router>
        </>
    );
};

export default Sidebar;