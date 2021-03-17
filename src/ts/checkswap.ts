// main export
export function multicheckswap(buffers: Uint8Array[], game_version: string): Uint8Array[] {
    
    var outs = Array.from(buffers);

    // start with uniform random shuffle
    var rand_order = buffers.map( (_, i) => i);
    for (var i = rand_order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rand_order[i], rand_order[j]] = [rand_order[j], rand_order[i]];
    }

    // create save writing map (random cyclic partitions)
    var save_write_map = buffers.map( (_, i) => i);
    partition_cycles(rand_order).forEach( (pc, i) => {
        save_write_map[rand_order[i]] = pc;
    });

    console.log(save_write_map);

    // copy original save data
    var trainer_names: Buffer[] = [];
    var trainer_ids: Buffer[] = [];
    var team_sizes: number[] = [];
    var team_data = buffers.map((buffer, index) => {
        var team_datum = Buffer.from(buffer)
        // get trainer names/ids from first pokemon in team
        // (dangerous if in game pokemon are traded atm)
        // TODO: Also, check team size <6 (also catches new save file oopsies)
        trainer_names.push(team_datum.slice(0x18, 0x1F));
        trainer_ids.push(team_datum.slice(0x08, 0x0C));
        team_sizes.push(team_datum.slice(0x01, 0x02).readUInt8(0));
        return team_datum;
    });

    console.log(trainer_names)
    console.log(trainer_ids)
    console.log(team_sizes)

    // overwrite buffers with new team_data
    save_write_map.forEach( (write_to_idx, write_from_idx) => {

        var team_datum = Buffer.from(team_data[write_from_idx]);
        // loop through team
        for (let i = 0; i < team_sizes[write_from_idx]; i++) {
            let personality = team_datum.slice(0x04 + 100*i, 0x08 + 100*i);
            let original_enckey = (personality.readUInt32LE(0) ^ trainer_ids[write_from_idx].readUInt32LE(0)) >>> 0;

            var unenc_pokemon_data: number[] = [];
            // decrypt pokemon's data
            for (let j = 0; j < 12; j++) {
                unenc_pokemon_data.push(
                    (team_datum.slice(0x24 + 4*j + 100*i, 0x28 + 4*j + 100*i).readUInt32LE(0) ^ original_enckey) >>> 0
                );
            }

            // replace ot id and ot name
            trainer_names[write_to_idx].copy(team_datum, 0x18 + 100*i);
            trainer_ids[write_to_idx].copy(team_datum, 0x08 + 100*i);

            // re-encrypt pokemon's data with new ot id
            var new_enckey = (personality.readUInt32LE(0) ^ trainer_ids[write_to_idx].readUInt32LE(0));
            for (let j = 0; j < 12; j++) {
                //console.log((unenc_pokemon_data[j] ^ new_enckey) >>> 0);
                team_datum.writeUInt32LE((unenc_pokemon_data[j] ^ new_enckey) >>> 0, 0x24 + 4*j + 100*i);
            }

        }

        outs[write_to_idx] = Uint8Array.from(team_datum)
    });

    return outs;
}

// 

// randomly partition lobby into cycles
function partition_cycles(rand_order: number[]): number[] {
    var pair_ups = [rand_order[1]];
    if (rand_order.length === 3) {
        pair_ups.push(rand_order[2]);
        pair_ups.push(rand_order[0]);
        return pair_ups;
    } else if (rand_order.length === 2) {
        pair_ups.push(rand_order[0]);
        return pair_ups;
    }
    var num_forward = rand_order.length - 2;
    while( num_forward > 1) {
        var roll = Math.floor(Math.random() * (num_forward + 1));
        if (roll === 0) {
            pair_ups.push(rand_order[0]);
            // create slice and recurse
            pair_ups.concat(partition_cycles(rand_order.slice(rand_order.length - num_forward)));
            num_forward = 0;
        } else {
            pair_ups.push(rand_order[rand_order.length - num_forward]);
            --num_forward;
        }
    }
    if(num_forward === 1) {
        pair_ups.push(rand_order[rand_order.length - 1]);
        pair_ups.push(rand_order[0]);
    }
    return pair_ups;
}