const jwt = require('jsonwebtoken');
const secret = require('fs').readFileSync('/root/broadcast-studio/.env','utf8').split('\n').find(l=>l.startsWith('JWT_SECRET=')).split('=').slice(1).join('=').trim();
console.log(jwt.sign({ id:'6df7714d-887b-43c7-8b9d-c9d3f1440edf', username:'producer', name:'Producer', role:'producer', studio_id:'4c086bc8-fb67-4943-a2f2-1b5a72164578' }, secret, { expiresIn:'4h' }));
