#! /bin/bash

deno run \
    --allow-net \
    --allow-run \
    --allow-read \
    --allow-write \
    ./src/server.ts $@

