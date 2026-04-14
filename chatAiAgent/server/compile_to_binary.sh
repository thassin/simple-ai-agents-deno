#! /bin/bash

## run prepare_html.sh -script to make sure HTML is up-to-date.

./prepare_html.sh
exit_status=$?
if [ $exit_status -ne 0 ]; then
    echo "prepare-HTML-script returned an error-status: $exit_status."
    exit
fi

## look here for more information about compilation to native app:
## https://docs.deno.com/runtime/reference/cli/compile/

deno compile \
    --allow-net \
    --allow-run \
    --allow-read \
    --allow-write \
    --output chatAiAgent_binary \
    ./src/server.ts

