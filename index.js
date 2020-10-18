const express = require('express');
const redis = require("redis");
const app = express();
const bodyParser = require("body-parser");

app.use(bodyParser.json());

class Customer {
    constructor(fName, lName, dob){
        this.firstName = fName;
        this.lastName = lName;
        this.dob = dob;
        this.balance = 0;
    }
}

const client = redis.createClient();
const multi = client.multi();

app.listen(5678, () => {
    
    console.log("Listening at 5678 port");

    client.on('connect', () => {
        console.log("connected");
    });
} );

function getUserCount(callback){
    var retVal;
    client.get('userCount', (err, reply) =>{
        if(err){
            console.log(err);
            callback(err.message);
        }
        else{
            retVal = parseInt(reply);
            console.log(retVal);
            callback(null, retVal);
        }
    });
}


app.get('/getAll', async (req, res)=>{
    
    
    var uCount;
    await getUserCount((err, response)=>{
        if(err){
            console.log(err);
        }
        else{
            console.log("response is " + response);
            
            uCount = response;
            console.log("uCount is " + uCount);
    
            let i = 1;
            while(i < uCount+1){
                multi.hvals('user:'+i, (err, reply)=>{
                    if(err){
                        console.log(err);
                    }
                    else{
                        console.log(reply);
                    }
                });
                i++;
            }
            multi.exec((err,reply)=>{
                if(err){
                    console.log(reply);
                }
                else{
                    res.send(reply);
                }
            });

        }
    });
    
    

    

});

app.post('/newClient', (req, res) => {

    // console.log(req.body);
    var retVal = getUserCount();
        
    multi.hmset('user:'+retVal, 'fName', req.body.fName, 'lName', req.body.lName, 'dob', req.body.dob, 'balance', 0)
    multi.set("userCount", parseInt(retVal)+1)
    
    multi.exec((err, reply)=>{
        console.log(reply);
        res.send("ok");
    });

});

app.post('/putMoney', (req, res) => {
    var money = req.body.deposit;
    var user = 'user:' + req.body.id;
    multi.hset(user, 'balance', money);
    multi.exec((err, reply)=>{
        if(err){
            console.log(err);
        }
        else{
            res.send(money + " added to the account of the user " + user);
        }
    });
    
});

app.get('/checkBalance', (req, res) => {
    var user = 'user:' + req.body.id;
    multi.hget(user, 'balance');
    multi.exec((err, reply)=>{
        if(err){
            console.log(err);
        }
        else{
            console.log('Balance of ' + user + " is " + reply);
            res.send(reply);
        }
    });
});
