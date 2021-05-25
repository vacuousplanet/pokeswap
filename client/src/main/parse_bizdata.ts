interface BizData {
    code: string;
    content: string;
};

function parseBizData(buf: Buffer): BizData {
    const message_parts = buf.toString().split(':');
    return <BizData>{
        code: message_parts[0],
        content: message_parts.splice(1).join(':').toString(),
    };
}

// team data (separated by spaces)
function getTeamData(team_string: string): Uint8Array {
    return Uint8Array.from(team_string.split(" ").map( num_string =>
        Number(num_string)
    ));
}

// gym status
function getGymData(gym_string: string): number {
    return Number(gym_string);
}

// blank func
function noParse(str: string): string {
    return str;
}

// encode team data into string to send to emulator
function encodeTeamData(new_team: Uint8Array): string {
    let new_team_string: string = "";
    new_team.forEach(val => {
        new_team_string = [new_team_string, val.toString(10)].join(' ')
    });
    return new_team_string.slice(1);
}

const CODE_MAP = new Map<string, any>([
    ['team', getTeamData],
    ['gym', getGymData],
    ['gym-status', noParse]
]);

export {BizData, CODE_MAP, parseBizData, encodeTeamData}