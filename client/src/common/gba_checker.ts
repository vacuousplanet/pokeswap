import {openSync, readSync} from 'fs';

const game_names: { [key: string]: string } = {
    'POKEMON EMER': 'Pokemon Emerald',
    'POKEMON SAPP': 'Pokemon Sapphire',
    'POKEMON RUBY': 'Pokemon Ruby',
    'POKEMON FIRE': 'Pokemon Fire Red',
    'POKEMON LEAF': 'Pokemon Leaf Green',
};

function gameType(path: string): string | undefined {

    var name_buffer = Buffer.alloc(0x0C);
    const fd = openSync(path, 'r');
    readSync(fd, name_buffer, 0, 0x0C, 0xA0);

    return game_names[name_buffer.toString()];
}

export default gameType;