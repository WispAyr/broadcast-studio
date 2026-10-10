#!/bin/bash
# NAR show-sponsor change, effective Mon 28 Sep 2026 06:00 BST.
#  Breakfast (Ali & Michael): Dash Claims -> Caledonian Windows
#  Up the Road (Billy & Bex, weekdays 14:00): Andrew Wright Windows -> Ayrshire Trade Frames,
#  and the Main Wall shows that card at 14:00 instead of the generic schedule list.
set -euo pipefail
cd /root/broadcast-studio/server
DB=data/broadcast.db
U=/uploads/c916d613-d5c1-4beb-8db2-14da3a228c74
test -f data$U/tvcard-a-m-caledonian.jpg && test -f data$U/tvcard-up-the-road.jpg
sqlite3 $DB ".backup data/backups/broadcast.db.bak-sponsorswitch-$(date +%Y%m%d%H%M)"
sqlite3 $DB <<SQL
.timeout 10000
BEGIN;
UPDATE layouts SET modules=replace(modules,'tvcard-a-m.jpg','tvcard-a-m-caledonian.jpg'), updated_at=datetime('now')
 WHERE id='bf50745a-d261-4baa-b492-5853cd2c3928';
UPDATE layouts SET name='Card — Up the Road with Billy and Bex',
 modules=replace(replace(modules,'tvcard-billy-bex.jpg','tvcard-up-the-road.jpg'),'Drivetime — Billy & Bex','Up the Road — Billy & Bex'),
 updated_at=datetime('now') WHERE id='7f2939db-4a36-401b-8316-57bb7a5c0365';
UPDATE console_buttons SET icon='$U/tvcard-a-m-caledonian.jpg' WHERE id='dfab7297-61ec-47ad-a069-3ff25a4a8e67';
UPDATE console_buttons SET label='Up the Road', icon='$U/tvcard-up-the-road.jpg' WHERE id='c17a9e9a-bee8-436e-b8dd-170f0db26a06';
COMMIT;
SQL
# The layout name now matches the station website's show title, so the hourly
# nar-schedule-sync links the 14:00 weekday slots to it (and keeps them linked).
/usr/local/bin/node src/nar-schedule-sync.js
echo "--- after"
sqlite3 $DB "select name, json_extract(modules,'\$[0].config.src') from layouts where id in ('bf50745a-d261-4baa-b492-5853cd2c3928','7f2939db-4a36-401b-8316-57bb7a5c0365');"
sqlite3 $DB "select dow,start,layout_id from card_wall_schedule where label like 'Up the Road%' or label like 'Ali & Michael%' order by dow,start;"
