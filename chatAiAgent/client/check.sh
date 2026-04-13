#! /bin/bash

deno check \
    ./src/*.ts \
    ./src/commands/*.ts \
    ../shared/*.ts

