import { existsSync } from 'fs';

import {LobbySettings} from '../common/LobbySettings';
import {LocalPathSettings, romPath} from '../common/LocalPathSettings';

import { isHttpUri, isHttpsUri } from 'valid-url';
import { ipcRenderer} from 'electron';

import Store from 'electron-store';

const storeConfig: Store.Options<LocalPathSettings> = {
    migrations: {

    },
    schema: {
        bizhawk_path: {
            type: 'string',
            default: '',
        },
        server_url: {
            type: 'string',
            default: 'http://127.0.0.1:3000'
        },
        rompaths: {
            type: 'array',
            items: {
                type: "object",
                properties: {
                    path: {
                        type: 'string',
                    },
                    name: {
                        type: 'string',
                    }
                }
            }
        }
    }
}

export const path_store = new Store<LocalPathSettings>(storeConfig);

export const lobbySettingsReducer = (
    state: LobbySettings,
    action: {
        type: 'set' | 'setOne';
        action: [string, unknown] | LobbySettings;
    }
): LobbySettings => {
    if (action.type === 'set') return action.action as LobbySettings;
    const v = action.action as [string, unknown];
    return {
        ...state,
        [v[0]]: v[1],
    };
};

export const localPathSettingsReducer = (
    state: LocalPathSettings,
    action: {
        type: 'set' | 'setOne' | 'addRom' | 'replaceRom';
        action: LocalPathSettings | [string, unknown] | romPath;
    }
): LocalPathSettings => {
    switch(action.type) {
        case 'set':
            const lps_candidate = Object.assign({}, action.action) as LocalPathSettings;

            if (!existsSync(lps_candidate.bizhawk_path)) {
                lps_candidate.bizhawk_path = '';
            }

            lps_candidate.rompaths = lps_candidate.rompaths ? lps_candidate.rompaths.filter(
                rompath => existsSync(rompath.path)
            ) : [];

            if (!isHttpUri(lps_candidate.server_url) && !isHttpsUri(lps_candidate.server_url)) {
                lps_candidate.server_url = storeConfig.schema?.server_url.default
            }

            return lps_candidate as LocalPathSettings;
        case 'setOne':
            const kv_pair = action.action as [string, unknown];
            if (kv_pair[0] === 'server_url' && !isHttpUri(kv_pair[1] as string) && !isHttpsUri(kv_pair[1] as string)) {
                ipcRenderer.send('user-error', 'Invalid Server', `${kv_pair[1]} is not a valide URL`);
                return state
            } else {
                path_store.set(...kv_pair);
                return {
                    ...state,
                    [kv_pair[0]]: kv_pair[1],
                }
            }
        case 'addRom':
            let newpaths = Array.from(state.rompaths);
            newpaths.push(action.action as romPath);

            path_store.set('rompaths', newpaths);
            return {
                ...state,
                rompaths: newpaths
            }
        case 'replaceRom':
            const rom_update_pair = action.action as [string, romPath];
            let paths = Array.from(state.rompaths);
            state.rompaths.forEach( (rompath, index) => {
                if (rompath.path === rom_update_pair[0]) {
                    paths[index] = rom_update_pair[1];
                }
            })
            path_store.set('rompaths', paths);
            return {
                ...state,
                rompaths: paths,
            }
        default:
            return state;
    }
};