#! /bin/bash

deno check \
    ./src/*.ts \
    ./src/client/*.ts \
    ./src/client/commands/*.ts \
    ./src/server/*.ts \
    ./src/server/tools/*.ts \
    ./src/shared/*.ts

