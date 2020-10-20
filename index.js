const express = require('express');
const redis = require("redis");
const app = express();
const bodyParser = require("body-parser");
const randInt = require('random-int');

app.use(bodyParser.json());

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
                    console.log(err);
                }
                else{
                    res.send(reply);
                }
            });

        }
    });
    
    

    

});

app.post('/newAccount', (req, res)=>{
    var userId = 'user:' + req.body.id;
    var acc_no = 'LT' + randInt(100000000000000000, 999999999999999999);
    multi.hset(userId, 'acc_no', acc_no);
    multi.hmset('account:'+acc_no, 'acc_no', acc_no, 'user_id', userId, 'balance', 0, 'currency', 'EUR');
    multi.exec((err, reply)=>{
        if(err){
            console.log(err);
        }
        else{
            console.log(reply);
            res.send('cool beans');
        }
    });
});

app.post('/newClient', (req, res) => {

    var id = randInt(1000, 9999);
    var firstName = req.body.fName;
    var lastName = req.body.lName;
    var dob = req.body.dob;
    if(req.body.isAcc){
        var acc_no = 'LT' + randInt(100000000000000000, 999999999999999999);
    }

    if(acc_no){
        multi.hmset('user:'+id, 'firstName', firstName, 'lastName', lastName, 'dob', dob, 'acc_no', acc_no);
        multi.hmset('account:'+acc_no, 'acc_no', acc_no, 'user_id', 'user:'+id, 'balance', 0, 'currency', 'EUR');
    }
    else{
        multi.hmset('user:'+id, 'firstName', firstName, 'lastName', lastName, 'dob', dob);
    }
    
    multi.exec((err, reply)=>{
        if(err){
            console.log(err);
        }
        else{
            console.log(reply);
        }
        res.send("ok");
    });
    

});



app.put('/sendMoney', (req, res)=>{
    var s_id = req.body.senderID;
    var r_id = req.body.receiverID;
    var amount = req.body.amount;
    var r_acc_id = req.body.receiverAccID;
    var tr_id = randInt(1000, 10000);

    client.hget('user:'+s_id, 'acc_no', (error, s_acc_id)=>{
        
        multi.hmset('transaction:'+tr_id, 'senderID', s_id, 'senderAccID', s_acc_id, 'receiverID', r_id, 'receiverAccID', r_acc_id, 'amount', amount, 'status', 'PENDING');
        client.hget('account:'+s_acc_id, 'balance', (err, reply)=>{
            if(reply >= amount){
                console.log("reply is more than amount");
                multi.hincrby('account:'+s_acc_id, 'balance', -amount);
                multi.hincrby('account:'+r_acc_id, 'balance', amount);
                multi.hset('transaction:'+tr_id, 'status', 'COMPLETED');
            }
            else{
                multi.hset('transaction:'+tr_id, 'status', 'CANCELLED');
            }
            multi.exec((err,reply)=>{
                if(err){
                    console.log(err);
                }
                else{
                    console.log(reply);
                    res.send("everything will be okay");
                }
            });
        });
        
    });

    
});




app.put('/updateInfo', (req, res)=>{
    var id = req.body.id;
    var data = req.body.data;
    var values = [];
    var keys = [];
    for (var item in data){
        keys.push(`${item}`);
        values.push(`${data[item]}`);
    }
    for(let i =0; i < keys.length; i++){
        multi.hset('user:'+id, keys[i], values[i]);
    }
    multi.exec((err, reply)=>{
        if(err){
            console.log(err)
        }
        else{
            console.log(reply);
            res.send("ok");
        }
    })
});






app.delete('/deleteUser', (req, res)=>{
    var id = req.body.id;

    client.hget('user:'+id, 'acc_no', (err, reply)=>{
        if(err){
            console.log(err);
        }
        else{
            if(reply != null){
                multi.del('user:'+id);
                multi.del('account:'+reply);
                console.log("reply is not null");
            }
            else{
                multi.del('user:'+id);
                console.log("reply is null");
            }
            multi.exec((err, resp)=>{
                if(err){
                    console.log(err);
                }
                else{
                    console.log(resp);
                    res.send('wazeeep');
                }
            });
        }
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
