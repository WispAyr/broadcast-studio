const jwt = require('jsonwebtoken');
const secret = require('fs').readFileSync('/root/broadcast-studio/.env','utf8').split('\n').find(l=>l.startsWith('JWT_SECRET=')).split('=').slice(1).join('=').trim();
console.log(jwt.sign({ id:'8421f518-8da1-411a-95b2-939d1ab2b44f', username:'wispayr', name:'WispAyr', role:'super_admin', studio_id:null }, secret, { expiresIn:'4h' }));
