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

For instance, every register is simply be a 32-bit integer variable (`uint_32` or a `long` in C), and the stack is simply a single global stack which holds these `uint_32` (maybe a `std::vector<long>` in C++ (I know there's a proper stack standard template container, but vectors are more taught so stfu (yes there's another nested parenthesis))).

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

    do_0x08098e0c()

    r0 = r0 % (2**16)

    do_0x0809d790()

    memory[r4 + 2] = r0 % 256

    r0 = 0
    r4 = stack.pop()

    return
```

Hopefully that's helpful in making stuff less scary.  If not, my b.
