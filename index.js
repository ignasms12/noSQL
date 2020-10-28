const express = require('express');
const redis = require("redis");
const app = express();
const bodyParser = require("body-parser");
const randInt = require('random-int');

app.use(bodyParser.json());

const client = redis.createClient('//dev-server:6379');
const multi = client.multi();

const body_possibleValues = ['firstName', 'lastName', 'dob'];

sendErr = function (res, err){
    if(err.length > 0){
        console.log(err);
        res.status(500).json({ 
            status: 'error',
            message: err.message
        });
    }
    else{
        console.log('Field not found');
        res.status(404).json({ 
            status: 'error',
            message: 'Field not found'
        });
    }
}

app.listen(5678, () => {
    
    console.log("Listening at 5678 port");

    client.on('connect', () => {
        console.log("connected");
    });
} );



app.get('/getAll', async (req, res)=>{
    
    
    client.keys('user*', (err, reply)=>{
        if(err){
            sendErr(res, err);
        }
        else if(reply.length <= 0){
            res.status(404).json({
                status: 'error',
                message: 'No users found'
            });
        }
        else{
            console.log(reply);
            res.send(reply);
        }
    });

});

app.post('/newAccount', (req, res)=>{
    var userId = 'user:' + req.body.id;
    var acc_no = 'LT' + randInt(100000000000000000, 999999999999999999);
    client.exists(userId, (err, reply)=>{
        if(reply == 1){
            multi.hset(userId, 'acc_no', acc_no);
            multi.hmset('account:'+acc_no, 'acc_no', acc_no, 'user_id', userId, 'balance', 0, 'currency', 'EUR');
            multi.exec((error, resp)=>{
                if(err){
                    sendErr(res, error);
                }
                else{
                    console.log(resp);
                    res.send(`Account ${acc_no} has been successfully created for user ${userId}`);
                }
            });
        }
        else{
            res.status(404).json({
                status: 'error',
                message: `${userId} was not found`
            });
        }
    });
    
});

app.post('/newClient', (req, res) => {

    var id = randInt(1000, 9999);
    var firstName = req.body.fName;
    var lastName = req.body.lName;
    var dob = req.body.dob;
    if(!firstName || !lastName || !dob){
        res.status(500).json({
            status: 'error',
            message: 'Missing fields'
        });
        return 0;
    }
    // if(firstName.length == 0 || lastName.length == 0 || dob.length == 0){
    //     res.status(500).json({
    //         status: 'error',
    //         message: 'Provided fields cannot be empty'
    //     });
    // }

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
            sendErr(res, err);
        }
        else{
            console.log(reply);
            if(acc_no){
                res.send(`User with id - ${id} - and account number - ${acc_no} - has been successfully created`);
            }
            else{
                res.send(`User with id - ${id} - has been successfully created`);
            }
            
        }
        
    });
    

});



app.put('/sendMoney', (req, res)=>{
    var s_id = req.body.senderID;
    var r_id = req.body.receiverID;
    var amount = req.body.amount;
    var r_acc_id = req.body.receiverAccID;
    var tr_id = randInt(1000, 10000);
    var status;
    var message;
    var funStat;

    client.exists(`user:${s_id}`, (err, reply)=>{
        if(reply == 1){
            client.exists(`user:${r_id}`, (err, reply)=>{
                if(reply == 1){
                    
                    client.hget(`user:${r_id}`, 'acc_no', (err, reply)=>{
                        if(err){
                            console.log(err);
                        }
                        if(reply == r_acc_id){
                            console.log(`Provided account number is the same as the receiver's account number`);
                        }
                        else{
                            res.status(500).json({
                                status: 'error',
                                message: `Provided account number does not match the receiver's account number`
                            });
                            funStat = 0;
                        }
                    });

                    if(funStat = 0){
                        return 0;
                    }
                    
                    client.hget('user:'+s_id, 'acc_no', (error, s_acc_id)=>{
                        status = 'PENDING';
                        multi.hmset('transaction:'+tr_id, 'senderID', s_id, 'senderAccID', s_acc_id, 'receiverID', r_id, 'receiverAccID', r_acc_id, 'amount', amount, 'status', status);
                        console.log(`Transaction ${tr_id} has been created with status ${status}`);
                        client.hget('account:'+s_acc_id, 'balance', (err, reply)=>{
                
                            if(reply >= amount){
                                multi.hincrby('account:'+s_acc_id, 'balance', -amount);
                                multi.hincrby('account:'+r_acc_id, 'balance', amount);
                                status = 'COMPLETED';
                                multi.hset('transaction:'+tr_id, 'status', status);
                            }
                            else{
                                status = 'CANCELLED';
                                message = 'Insufficient funds'
                                multi.hset('transaction:'+tr_id, 'status', status);
                            }
                            multi.exec((err,reply)=>{
                                if(err){
                                    sendErr(res, err);
                                }
                                else{
                                    console.log(`Transaction ${tr_id} has been updated with status - ${status}`);
                                    console.log(`Reply from database is: ${reply}`);
                                    if(message){
                                        res.send(`Transaction ${tr_id} has been updated with status - ${status}, reason - ${message}`);
                                    }
                                    else{
                                        res.send(`Transaction ${tr_id} has been updated with status - ${status}`);
                                    }
                                }
                            });
                        });
                        
                    });


                }
                else{
                    res.status(404).json({
                        status: 'error',
                        message: `User:${r_id} does not exist`
                    })
                }
            });
        }
        else{
            res.status(404).json({
                status: 'error',
                message: `User:${s_id} does not exist`
            })
        }
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

    for(let i=0; i < keys.length; i++){
        if(body_possibleValues.includes(keys[i]) == false){
            res.status(404).json({
                status: 'error',
                message: 'Invalid fields'
            });
            return 0;
        } 
    }

    client.exists('user:'+id, (err, reply)=>{

        if(reply == 1){
            for(let i =0; i < keys.length; i++){
                multi.hset('user:'+id, keys[i], values[i]);
            }
            multi.exec((err, reply)=>{
                if(err){
                    sendErr(res, err);
                }
                else{
                    console.log(reply);
                    res.send(`Data has been updated for user:${id}`);
                }
            });
        }
        else{
            res.status(404).json({
                status: 'error',
                message: `User:${id} was not found`
            });
        }
    });
});






app.delete('/deleteUser', (req, res)=>{
    var id = req.body.id;

    client.exists('user:'+id, (err, response)=>{
        if(response == 1){
            client.hget('user:'+id, 'acc_no', (err, reply)=>{
                if(err){
                    console.log(err);
                    sendErr(res, err);
                }
                else{
                    if(reply != null){
                        multi.del('user:'+id);
                        multi.del('account:'+reply);
                    }
                    else{
                        multi.del('user:'+id);
                    }
                    multi.exec((error, resp)=>{
                        if(error){
                            sendErr(res, error);
                        }
                        else{
                            console.log(resp);
                            res.send(`User:${id} has been deleted`);
                        }
                    });
                }
            });
        }
        else{
            res.status(404).json({
                status: 'error',
                message: `User:${id} was not found`
            });
        }
    });
    
    
});

app.post('/putMoney', (req, res) => {
    var money = req.body.deposit;
    var user = 'user:' + req.body.id;
    if(Number.isInteger(parseInt(money)) == false){
        res.status(500).json({ 
            status: 'error',
            message: 'Deposit has to be an integer'
        });
        return 0;
    };

    client.hget(user, 'acc_no', (err, resp)=>{
        if(err){
            sendErr(res, err);
        }
        multi.hincrby(`account:${resp}`, 'balance', money);
        multi.exec((error, reply)=>{
            if(error){
                console.log(error);
            }
            else{
                res.send(`${money} added to the account ${resp}`);
            }
        });

    });
    
    
});

app.get('/checkBalance', (req, res) => {
    var user = 'user:' + req.body.id;
    client.hget(user, 'acc_no', (err, resp)=>{

        multi.hget('account:'+resp, 'balance');
        multi.exec((err, reply)=>{
            if(err){
                sendErr(res, err);
            }
            else{
                console.log(`Balance of ${user} is ${reply}`);
                res.send(`Balance of ${user} (${resp}) is ${reply}`);
            }
        });

    });
    
});
