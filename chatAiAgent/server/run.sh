#! /bin/bash

## look here for more information about options related to security permissions:
## https://docs.deno.com/runtime/fundamentals/security/

## For example, to allow reading files in current working directory but deny writing to ./secrets directory:
## deno run --allow-write=./ --deny-write=./secrets myscript.ts

deno run \
    --allow-net \
    --allow-run \
    --allow-read \
    --allow-write \
    ./src/server.ts $@

