#! /bin/bash

## TODO miten asetetaan rajat read/write luvitukselle täällä?!?
## => ERINOMAINEN ominaisuus!!! ja toimii binäärikäännöksessä kans.

## https://docs.deno.com/runtime/fundamentals/security/ 

## Allow reading files in current working directory but disallow writing to ./secrets directory.
##deno run --allow-write=./ --deny-write=./secrets script.ts



deno run \
    --allow-net \
    --allow-run \
    --allow-read \
    --allow-write \
    ./batch_test01.ts

