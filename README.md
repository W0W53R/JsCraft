# JsCraft
An implementation of the Minecraft client in JavaScript.

## Features
- Encryption and verification with Mojang servers.
- Compression
- Uses Wisp proxy to connect to Minecraft server

## Issues
- This is not, for now, able to be used to play on any server.
- I have not put in definitions for every packet in the Play stage
- During the Configuration phase, the vanilla server outputs this error to the console: ```Internal Exception: io.netty.handler.codec.DecoderException: Failed to decode packet 'serverbound/minecraft:client_information'```. Im still trying to figure that out.