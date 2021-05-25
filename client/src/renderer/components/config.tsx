import React, {useState, useContext} from 'react';
import { ipcRenderer } from 'electron';
import './config.scss';

import { LocalPathSettingsContext } from '../contexts';
import { romPath} from '../../common/LocalPathSettings';

// dialog callers
function addRom(): romPath | undefined {
    return ipcRenderer.sendSync('rom_update');
}

function newBizhawkPath(): string | undefined {
    return ipcRenderer.sendSync('bizhawk_path_update');
}

const Config = () => {

    const [local_path_settings, updateLocalPathSettings] = useContext(LocalPathSettingsContext);

    const [serverURLcandidate, changeServerCandidate] = useState(local_path_settings.server_url);

    return (
        <>
        <h2>Configuration</h2>

        <div>
            <h3>ServerURL</h3>
            <div className="romcard">
                <input
                    type="text" name="" id=""
                    value={serverURLcandidate}
                    onChange={(event) => changeServerCandidate(event.target.value)}
                />
                <div className="browse">
                    <button onClick={() => {
                        updateLocalPathSettings({
                            type: "setOne",
                            action: ['server_url', serverURLcandidate]
                        });
                        changeServerCandidate(local_path_settings.server_url);
                    }}>
                        Change...
                    </button>
                </div>
            </div>
        </div>
        <hr/>
        <div className="romAdder">
            <h3>ROM Paths</h3>
            <button className="square" onClick={() => {
                const new_rom_path = addRom()
                if (new_rom_path !== undefined) updateLocalPathSettings({
                    type: 'addRom',
                    action: new_rom_path,
                });
            }}>+</button>
        </div>
        <div>
            {local_path_settings.rompaths.map((rominfo: romPath) =>
                <div key={rominfo.path}>
                    <hr/>
                    <div className="romcard">
                        <div className="path">
                            <h4>{rominfo.name}</h4>
                            <p>{rominfo.path}</p>
                            </div>
                        <div className="browse">
                            <button 
                                onClick={() => {
                                    const new_rom_path = addRom()
                                    if (new_rom_path !== undefined) updateLocalPathSettings({
                                        type: 'replaceRom',
                                        action: [rominfo.path, new_rom_path],
                                    }
                                )}}
                            >
                                Browse...
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        <hr/>
        <div>
            <h3>Bizhawk Path</h3>
            <hr/>
            <div className="romcard">
                <div className="path"><p>{local_path_settings.bizhawk_path}</p></div>
                <div className="browse">
                    <button onClick={() => {
                        const new_bizhawk_path = newBizhawkPath()
                        if (new_bizhawk_path !== undefined) updateLocalPathSettings({
                            type: 'setOne',
                            action: ['bizhawk_path', new_bizhawk_path]
                        })
                    }}>Browse...</button>
                </div>
            </div>
        </div>
        </>
    )
}

export default Config;