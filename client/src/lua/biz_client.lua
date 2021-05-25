-- lua client for pokeswap

local state = "idle"

local BADGE_FLAGS_START = 0x10C
local BADGE_MASK = 0x7F80

local ACTIVE_TEAM = 0x020244E8

-- declare gym status
local gym_status = 0

function CHECK_SERVER ()

    if not comm.socketServerIsConnected() then
        print('socket server is not connected')
        return "no connection"
    end

    local responce = comm.socketServerResponse()

    return responce
end


-- request gym status
comm.socketServerSend('gym-status');

local init_responce = CHECK_SERVER()
if string.gmatch(init_responce, "([^"..":".."]+)", 0) == "gym-init" then
    gym_status = tonumber(string.gmatch(init_responce, "([^"..":".."]+)", 1))
end

function READ_GYM_STATUS ()
    local flag_pointer = memory.read_u32_le(0x03005D8C, 'System Bus') + 0x1270
	local flag_vals = memory.read_u16_le(flag_pointer + BADGE_FLAGS_START, 'System Bus')
    local completion = bit.rshift( bit.band(flag_vals, BADGE_MASK), 7)
    return completion
end

function READ_PLAYER_TEAM ()

    -- subtract one so that table concat works correctly (eye-roll)
    local team_data = memory.readbyterange(ACTIVE_TEAM - 1, 605, 'System Bus')

    -- assemble team_data into string for sending
    local team_string = table.concat(team_data, " ")

    return team_string
end

-- have to write to both the save team and the active team (eye-roll)
function WRITE_PLAYER_TEAM (team_string)
    -- team data is in space separated format
    local index = 0
    -- seems a little ineficient,m but memory.writebyterange needs more documentation!
    for str in string.gmatch(team_string, "([^".."%s".."]+)") do
        --save_team_data[save_team_pointer + index] = math.tointeger(tonumber(str))
        memory.writebyte(ACTIVE_TEAM + index, tonumber(str), 'System Bus')
        index = index + 1
    end
    return
end

-- wait a little bit before reading gym team state
local waitcount = 0
while waitcount < 360 do
    waitcount = waitcount + 1
    emu.frameadvance()
end

local blipcount = 0
while true do
    -- check server connection
    local responce = CHECK_SERVER()

    if responce == "no connection" then
        -- TODO: handle no local connection
        emu.frameadvance()
        break
    end

    local ss_flag = false
    for msg in string.gmatch(responce, "([^"..":".."]+)") do
        if ss_flag then
            savestate.save(msg)
            client.exit()
        end

        if msg == "savestate" then
            ss_flag = true
        end
    end

    if state == "idle" then
        if responce ~= nil and responce ~= "" then
            print(responce)
            local gym_flag = false
            for msg in string.gmatch(responce, "([^"..":".."]+)") do
                if gym_flag then
                    gym_flag = false

                    state = "remote gym"
                    gym_status = tonumber(msg)

                    client.pause()

                    local team_data = READ_PLAYER_TEAM()

                    comm.socketServerSend("team:" .. team_data)
                end

                if msg == "gym" then
                    gym_flag = true
                end

                if msg == "pause" then
                    state = "paused"
                    client.pause()
                end

            end
        else
            -- read gym status
            -- to discourage 'blips' (dma restructs mid frame) assert difference thrice
            local gym_status_new = READ_GYM_STATUS()
            if bit.bxor(bit.bor(gym_status_new, gym_status), gym_status) > 0 then
                -- advance blipcount
                blipcount = blipcount + 1

                if blipcount > 4 then

                    -- change state to local gym, update gym status, and pause emu
                    state = "local gym"

                    gym_status = bit.bor(gym_status_new, gym_status)

                    client.pause()

                    -- send gym state out
                    comm.socketServerSend("gym:" .. tostring(gym_status))

                    -- Get party pokemon data
                    local team_data = READ_PLAYER_TEAM()

                    -- Send party data to desktop app
                    comm.socketServerSend("team:" .. team_data)
                    blipcount = 0
                else
                    emu.frameadvance();
                end

            else
                blipcount = 0
                emu.frameadvance();
            end

        end
    else
        -- print(state)
        if state == "remote gym" or state == "local gym" then
            if responce ~=nil and responce ~= "" then
                --print(responce)
                if responce ~= "error" then
                    print('new team received!')
                    local new_team = string.gsub(responce, "team:", "")
                    print(new_team)
                    WRITE_PLAYER_TEAM(new_team)
                    client.unpause()
                    state = "idle"
                end
            else
                client.pause()
            end
        end

        if state == "paused" then
            if responce == "resume" then
                client.unpause()
                state = "idle"
            end
        end

    end
end