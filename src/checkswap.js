import { readFileSync, writeFile } from 'fs';

// section dependent structure ( probably move into dictionary )
const section_data_size = 0x0F80;

// global section structure
const sectionID_offset = 0x0FF4;
const checksum_offset = 0x0FF6;
const saveidx_offset = 0x0FFC;

// R/S/E offset is 0x0234
// FR/LG specific offset ( move into dictionary later )
const team_offset_map = {
    RSE: 0x0234,
    FRLG: 0x0034,
};
const team_length = 604;

// do the checking and the swapping and what not
export function checkswap(filename1, filename2, game_version){

    var buffer1 = readFileSync(filename1);
    var buffer2 = readFileSync(filename2);

    // var buffer1_og = Buffer.from(buffer1.subarray(0,buffer1.length));

    // if only one game save is filled (i.e after first save) then we need to check for 'FF'
    var save_offset1 = buffer1[saveidx_offset] > buffer1[0xE000+saveidx_offset] && buffer1[saveidx_offset] != 0xFF ? 0x0000 : 0xE000;
    var save_offset2 = buffer2[saveidx_offset] > buffer2[0xE000+saveidx_offset] && buffer2[saveidx_offset] != 0xFF ? 0x0000 : 0xE000;

    //loop1
    var section_start1 = 0x0000;
    for(var i = save_offset1; i < 0xE000+save_offset1; i += 0x1000){
        if(buffer1[i+sectionID_offset] === 0x01){
            section_start1 = i;
            // console.log('Section 01 found in file 1');
            break;
        }
    }

    //loop2
    var section_start2 = 0x0000;
    for(var i = save_offset2; i < 0xE000+save_offset2; i += 0x1000){
        if(buffer2[i+sectionID_offset] === 0x01){
            section_start2 = i;
            // console.log('Section 01 found in file 2');
            break;
        }
    }

    // do lazy swap
    var team_offset = team_offset_map[game_version];

    var a1 = Buffer.from(buffer1.subarray(section_start1+team_offset, section_start1+team_offset+team_length));
    buffer2.copy(buffer1, section_start1+team_offset, section_start2+team_offset, section_start2+team_offset+team_length);
    a1.copy(buffer2, section_start2+team_offset);

    // compute and fill checksums
    buffer1.writeUInt16LE(CRC32(buffer1.slice(section_start1,section_start1+section_data_size)),section_start1+checksum_offset);
    buffer2.writeUInt16LE(CRC32(buffer2.slice(section_start2,section_start2+section_data_size)),section_start2+checksum_offset);

    // overwrite files
    writeFile(filename1, buffer1, function(err){
        if(err){
            throw err
        }
    });
    writeFile(filename2, buffer2, function(err){
        if(err){
            throw err
        }
    });

    return;
}

export function multicheckswap(filenames, game_version) {
    // get data streams from files
    var buffers = filenames.map(filename => readFileSync(filename));

    // compute save offsets
    var save_offsets = buffers.map(buffer =>
        buffer[saveidx_offset] > buffer[0xE000+saveidx_offset] && buffer[saveidx_offset] != 0xFF ? 0x0000 : 0xE000
    );

    // extract secion starts
    var section_starts = save_offsets.map( (save_offset, index) => {
        var section_start = 0x0000;
        for(var i = save_offset; i < 0xE000+save_offset; i += 0x1000){
            if(buffers[index][i+sectionID_offset] === 0x01){
                section_start = i;
                break;
            }
        }
        return section_start;
    });

    // start with uniform random shuffle
    var rand_order = filenames.map( (_, i) => i);
    for (var i = rand_order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rand_order[i], rand_order[j]] = [rand_order[j], rand_order[i]];
    }

    // create save writing map (random cyclic partitions)
    var save_write_map = filenames.map( (_, i) => i);
    partition_cycles(rand_order).forEach( (pc, i) => {
        save_write_map[rand_order[i]] = pc;
    });

    // copy original save data
    var team_offset = team_offset_map[game_version];
    var team_data = buffers.map((buffer, index) => 
        Buffer.from(buffer.subarray(
            section_starts[index] + team_offset,
            section_starts[index] + team_offset + team_length
        ))
    );

    // overwrite buffers with new team_data
    save_write_map.forEach( (write_to_idx, write_from_idx) => {
        buffers[write_from_idx].copy(
            buffers[write_to_idx],
            section_starts[write_to_idx] + team_offset,
            section_starts[write_from_idx] + team_offset,
            section_starts[write_from_idx] + team_offset + team_length
        );
    });

    // compute and fill checksums
    buffers.forEach( (buffer, index) => {
        buffer.writeUInt16LE(
            CRC32(buffer.slice(section_starts[index], section_starts[index] + section_data_size)),
            section_starts[index] + checksum_offset
        );
    });

    // overwrite files
    filenames.forEach( (filename, index) => {
        writeFile(filename, buffers[index], (err) => {
            if (err)
                throw err;
        });
    });

    return;
}


export function verify(candidate){
    return true;
}

// encryption function
function CRC32(data) {
    var val = 0x00000000;
    for(var i = 0; i < data.length; i += 4){
        val += data[i]+0x0100*data[i+1]+0x010000*data[i+2]+0x01000000*data[i+3];
    }
    return ((val + (val >> 16)) % 0x01000000) % 0x00010000;
}

// randomly partition lobby into cycles
function partition_cycles(rand_order) {
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
            pair_ups.push(partition_cycles(rand_order.slice(rand_order.length - num_forward)));
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