#! /bin/bash

./prepare_html.sh
exit_status=$?
if [ $exit_status -ne 0 ]; then
    echo "prepare-HTML-script returned an error-status: $exit_status."
    exit
fi

deno check \
    ./src/*.ts \
    ./src/tools/*.ts \
    ../shared/*.ts

