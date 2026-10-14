#!/bin/bash
# Adds/removes clearly-labelled TEST positions (for screenshots only)
TOK=${BOT_API_TOKEN:-$(cat .bot-token)}; U=http://localhost:3000/api/positions
if [ "$1" = add ]; then
 for j in '{"id":"test-ss-1","bot":"SCAN","symbol":"TESTBTC","side":"LONG","size":0.5,"entry":64000,"price":68120,"note":"TEST"}' \
          '{"id":"test-ss-2","bot":"FILLS","symbol":"TESTETH","side":"SHORT","size":4,"entry":3500,"price":3410,"note":"TEST"}' \
          '{"id":"test-ss-3","bot":"SIZE","symbol":"TESTSOL","side":"LONG","size":40,"entry":160,"price":151.2,"note":"TEST"}' \
          '{"id":"test-ss-4","bot":"RISK","symbol":"TESTDOGE","side":"SHORT","size":10000,"entry":0.14,"price":0.152,"note":"TEST"}'; do
  curl -s -o /dev/null -w "%{http_code} " -X POST -H "Authorization: Bearer $TOK" -H 'content-type: application/json' -d "$j" $U; done; echo
else for i in 1 2 3 4; do curl -s -o /dev/null -w "%{http_code} " -X DELETE -H "Authorization: Bearer $TOK" $U/test-ss-$i; done; echo; fi
