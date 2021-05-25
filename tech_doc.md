# Relevant Technical Documentation

## Table of Contents
1. [Game Boy Advance](#gba)
    - [Hardware](#hardware)
    - [Software](#software)
2. [Emerald DMA](#dma)
3. [Gym Badge Flags](#flags)
4. [Live Team Data](#team)
5. [Pokemon Data Structure](#mondata)

<div id='gba'/>

## Game Boy Advance

<div id='hardware' />

### Hardware

It's important to keep the system bus memory addresses for the GBA in the back of your head when working with the lua side of this project.  Just in case the back of your head is crack-jammed full of other more important garbage, here's a quick reference for system bus memory addresses.

| Area       | Starting Address | Ending Address | Length   | Bandwidth | Description                                |
| ---------- | ---------------- | -------------- | -------- | --------- | ------------------------------------------ |
| System Rom | `0x00000000`     | `0x00003FFF`   |  16 Kb   |  32 bit   | BIOS memory.  Don't worry about this       |
| EWRAM      | `0x02000000`     | `0x0203FFFF`   | 256 Kb   |  16 bit   | CPU-external work RAM.  Slower but big...  |
| IWRAM      | `0x03000000`     | `0x03007FFF`   |  32 Kb   |  32 bit   | CPU-internal work RAM.  Faster but small...|
| IO RAM     | `0x04000000`     | `0x040003FF`   |   1 Kb   |  16 bit   | Graphics/sound/buttons/other IO features   |
| PAL RAM    | `0x05000000`     | `0x050003FF`   |   1 Kb   |  16 bit   | Palette RAM.  2x 256 15-bit color palettes |
| VRAM       | `0x06000000`     | `0x06017FFF`   |  96 Kb   |  16 bit   | Video RAM.  Sprite and Background data     |
| OAM        | `0x07000000`     | `0x070003FF`   |   1 Kb   |  32 bit   | Object Attribute Memory.  Sprite control   |
| PAK ROM    | `0x08000000`     | `< 0x09FFFFFF` | <32 Mb   |  16 bit   | Game ROM.  Thumb instructions              |
| Cart RAM   | `0x0E000000`     | `~ 0x0E00FFFF` | ~64 Kb`*`|   8 bit   | Save data location (SRAM, Flash ROM, etc)  |
***
`*` Cart RAM is technically variable, but it's typically around 64 Kb
***

<div id='software'>

### Software

A GBA ROM is essentially a program written in a mixture of 32-bit ARM instructions and 16-bit Thumb instructions.  For Emerald in particular, this program follows a common format, in which a main 'game loop' finds and executes several important functions, encoded within the ROM cartridge every frame.

To easily keep track of where these important functions/subroutines are, there is a memory table which stores the actual 32-bit memory locations of each function.  An important subroutine (functionality described later) can be found at address `0x08099C3D`.  The first 208 bits found starting at that location look like the following (don't worry about endian jazz right now):

```
10B5041C FFF7E4F8 0004000C 03F0A2FD
A0700020 10BC02BC 0847
```

This gibberish is actually a set of Thumb instructions which, when translated, can be read as the following: 

```
10 B5          push {r4, lr}        --> Appends r4 and lr to the stack (saves them)
04 1C          add  r4, r0, #0      --> Copies r0 into r4
FF F7 E4 F8    bl   #0x8098e0c      --> Branch to 0x08098e0c and come back
00 04          lsl  r0, r0, #16     --> left shift r0  --|
00 0C          lsr  r0, r0, #16     --> right shift r0 --+-- clear highest 16 bits (assures 2 byte flag in r0?)
03 F0 A2 FD    bl   #0x809d790      --> Branch to 0x0809d790 and come back
A0 70          strb r0, [r4, #2]    --> Stores the bottom byte from r0 in address 2 bytes above that held in r4
00 20          movs r0, #0          --> Clears r0
10 BC          pop  {r4}            --> pops r4 into r4
02 BC          pop  {r1}            --> pops original lr into r1
08 47          bx   r1              --> returns/ends subroutine
```

If this still feels complicated, thinking about registers in terms of framiliar higher-level programming concepts can be helpful.

For instance, every register is simply a 32-bit integer variable (`uint_32` or a `long` in C), and the stack is simply a single global stack which holds these `uint_32` (maybe a `std::vector<long>` in C++ (I know there's a proper stack standard template container, but vectors are taught more so stfu (yes there's another nested parenthesis))).

So, in a language like Python, glossing over a lot of how CPU registers work (don't worry about `lr`), this code above basically reads:

```
# globals
r1, r2, r3, ... = 0
stack = []
memory = []

...

def subroutine()
    stack.append(r4)
    r4 = r0

    _0x08098e0c()

    r0 = r0 % (2**16)

    _0x0809d790()

    memory[r4 + 2] = r0 % 256

    r0 = 0
    r4 = stack.pop()

    return
```

Hopefully that's helpful in making stuff less scary.  If not, my b.

<div id="dma"/>

## Emerald DMA

There is a nifty hardware feature in the GBA's CPU called 'DMA' which stands for Direct Memory Access, which can basically be used to move a bunch of memory around really really quickly.  That has a lot of really cool potential.  But Game Freak decided to be lame and only use it to make things harder to decomp 🙄.

When I refer to "Emerald's DMA", I'm refering to the fact that a large portion of the game's active memory has its location randomized every few 1000 or so frames, which means hunting for static memory addresses is often a no no.  What this means in terms of looking for variables/flags that indicate game progression, is that you can't look for memory addresses that change pre/post some sort of interaction/event; you have to look at what functions are called, and then translate the function in order to figure out where Emerald's DMA moved the data.

Luckily, I've already done the painful work of figuring out that the memory location (where Emerald's DMA moves the data structure containing all of the flags/variables) is stored at `0x03005D8C`.  That painful work was done by meticulously analyzing the branches of the subroutine in the [software](#software) section, which is in fact, the 'check flag' function, which checks whether or not a certain flag is set to true or false.

In the future, I'll write some documentation for the flags/variables/data-structure which gets passed around by the DMA.

**TL;DR ALWAYS LOOK IN `0x03005D8C`**

<div id="flags">

## Gym Badge Flags

Once you've accounted for Emerald's DMA, you can do the more traditional pre/post comparison of memory addresses before/after an event, or you can trigger the 'checkflag' function in game for the desired flag, and simple check the memory addresses.

For the gym badges, you can find the flags the latter way by checking the little gym statues at the beginning of the corresponding gym.  The dialog flashed by these statues depend on the returned value of the 'checkflag' function, which means you just need to set a breakpoint at that address and _interpret_ (a hair more involved than just reading) the values in the registers.

By reading further into the 'checkflag' function, you can find that all flags are offset from the DMA shifted address by `0x1270`.  Performing the statue technique outlined above yeilds a further memory offset of `0x10C` for the first gym badges.

Lucikly, all eight gym badges are sequential in memory, which means that we could read in the full 'gym state' as an 8-bit integer yea?!  Not quite (god this is getting into watch for rolling rocks territory).

The flags are stored as 1-bit values, and because you can only do 'byte-aligned' reads from memory, reading a non-aligned 8-bit integer requires reading in a 16-bit integer and then doing some masking + clipping.  In the case of the gym badges, they're stored as:
```
x8765432 1xxxxxxx
```
so 'anding' with the mask:
```
01111111 10000000
```
will trim unimportant data, and shiting by 7 will yield the full gym state:
```
87654321
```

<div id="team"/>

## Live Team Data

Surprisingly (at least surprising to me), the live team data is not stored within the DMA'd data structure, but is in fact a static memory address, at `0x020244E8`.  Nothing too much to say about this, except in the case of swaps 'mid-battle'.

A lot of data pertaining to the starting pokemon are loaded into 'active memory' **before** the battle starts.  This means that when a swap occurs, and only the 'active party' is swapped, there are still fragments of the previous pokemon's data still in the battle scene, which can lead to instances where pokemon can use moves they'd never be able to typically use.  This isn't game breaking and fades after an in-battle team switch or a battle end, but could be avoided by investigating where battle related data goes.

<div id="mondata"/>

## Pokemon Data Structure

The majority of relevant information on Gen III pokemon data structures can be found [here](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_structure_(Generation_III)).

One thing to note with regards to swapping pokemon, is obidience, original trainer IDs, and data-substructure encryption.  Within the mechanics of Emerald, when a pokemon is swapped/traded, with no direct modifications, it will not obey the new trainer if it's above a certain level (said level depends on # gym badges owned).

The obvious thing to do then is swap the pokemon's original trainer IDs as well.  However, the data-substructure for the pokemon is encrypted using the original trainer ID as a key. What this means, is that in order to swap a pokemons original trainer id, the data-substructure must be decrypted using the original ID, and then re-encrypted with the new ID, before the IDs are swapped.  If this doesn't happend, and the ID's are swapped anyways, the pokemon will register as a bad egg.
