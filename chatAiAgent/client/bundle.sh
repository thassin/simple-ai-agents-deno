#! /bin/bash

echo RUN cleanup...
rm -f wwwroot/*.js*

echo RUN bundler...
deno run --allow-env --allow-read --allow-write --allow-run _bundler.ts

if [ $? -eq 0 ] 
then 
	echo "--OK--"
else 
	echo "--ERROR--"
fi

