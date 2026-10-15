#!/bin/bash
# Keeps sync-feed.js running (restarts it if it exits). Start: nohup ./sync-feed-watchdog.sh >/dev/null 2>&1 &
cd "$(dirname "$0")"; echo $$ > sync-feed.pid
while true; do node sync-feed.js; echo "$(date -u +'%F %T')Z sync-feed.js exited ($?), restart in 10s" >> sync.log; sleep 10; done
