## TODO for pokeswap client
 - ✔️ configure/setup ts/electron/react project

    **basic boilerplate works**

    just need to outline some basic functionality and learn some react I suppose

    - ✔️ add sidebar template
    - ✔️ extend `sidebar.tsx` to wrap components
    - ✔️ create pages for 'configuration' and 'lobby'
    - ✔️ for configuation page, add Rom Path file select and BizHawk Path file select
    - ✔️ for lobby page, just add start button for now (login stuff will come later)

    **all done with basic project set up**

    technically, I could go more in depth into the css but nah
 ---

 - ✔️ start bizhawk + rom with flags via desktop app
 - ✔️ create tcp socket in desktop app
 - ✔️ draft lua scripts for bizhawk
 - ✔️ outline bi-directional communication
 - ✔️ probe ROMS for team data memory addresses
 - ✔️ probe ROMS for game progression/state

---

 - ✔️ create new pokeswap-server for API
 - ✔️ connect desktop app client to server
 - ✔️ draft emu pause on signal from desktop app
 - ✔️ draft game state change detection/signaling
 - ✔️ draft team memory transfers

---

 - ✔️ add restartability/rejoin-ability
 - ✔️ store/cache paths and relevant data
 - ✔️ make deployable
 - 📝 create comprehensive readme for setup, etc
 - 📝 polish project structure, css, etc.

---

 - ❌ do frame counts and/or read game time/gen-stats at end of session
 - ❌ figure out elite four stuff
 - ❌ store loadable memory addresses somewhere
 - ❌ allow other roms (fire red, saphire, ruby, etc)
 - ❌ move from 'swap-on-server' to 'swap-between' architecture
 - ❌ add 'poke-shuffle' option