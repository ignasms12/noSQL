const redis = require('redis');

const client = redis.createClient();

client.get('user:9512', (err, reply)=>{
    console.log('err is ' + err);
    console.log('reply is ' + reply);
});