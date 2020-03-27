const https = require('https');
const express = require('express')
const request = require("request");
const Keyv = require('keyv')
const webpush = require('web-push');
const fs = require('fs')

const vapidKeys = { "publicKey":"",
                    "privateKey":""
                }


webpush.setVapidDetails(
    'mailto:example@yourdomain.org',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

var app = express()

var API_ENDPOINT = 'https://hpb.health.gov.lk/api/get-current-statistical'
var pushSubsStore = new Keyv('sqlite://pushSubs.sqlite', { namespace: 'pushSubs' })

pushSubsStore.on('error', err => console.log(err))

global.total_local_cases = 0
global.total_local_cases = 0

// SSL Certificates
const privateKey = fs.readFileSync('privkey.pem', 'utf8');
const certificate = fs.readFileSync('cert.pem', 'utf8');
const ca = fs.readFileSync('chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

const secServer = https.createServer(credentials, app)

const io = require('socket.io').listen(secServer)
secServer.listen(8080)


io.on("connection", (socket => {
    console.log('client_connected', socket.id)
    getDataFromApi().then(data => {
        socket.emit('data', data)
        console.log('data_sent', socket.id)
    }).catch(err =>{
        console.log(err)
    })
    socket.on('disconnect', () => {
        console.log('Client disconnected')
    })
    socket.on('new_subscription', (sub) =>{ // Push notification subscription event.
        console.log('new_subscription', socket.id)
        addSub(sub)
    })
}))
function notifySubSuccess(sub) {
    
    var notificationPayload =  {
        "notification": {
            "title": "Subscription",
            "badge": "https://icons.iconarchive.com/icons/icons8/ios7/512/Healthcare-Virus-icon.png",
            "body": "You will receive realtime notifications on COVID-19 cases in Sri Lanka from now on.",
            "icon": "https://image.flaticon.com/icons/png/512/2050/2050058.png"
        }
      };

    webpush.sendNotification(sub, JSON.stringify(notificationPayload)).then(() =>{
        console.log('USER_NOTIFY_SUBSCRIPTION')
    })
}

function sendNotifications(type, number, total) {
    
    console.log('send_noti', type)

    if(type === 'cases_update') {

        var notificationPayload =  {
            "notification": {
              "badge": "https://icons.iconarchive.com/icons/icons8/ios7/512/Healthcare-Virus-icon.png",
              "title": "Status update",
              "body": `Positive COVID-19 cases have risen to ${total}. Reported ${number} new cases so far.`,
              "icon": "https://image.flaticon.com/icons/png/512/2050/2050058.png"
            }
          };

    } else if(type === 'deaths_update') {

        var notificationPayload =  {
            "notification": {
              "badge": "https://icons.iconarchive.com/icons/icons8/ios7/512/Healthcare-Virus-icon.png",
              "title": "Status update",
              "body": `Fatal cases have risen to ${total}. Reported ${number} new fatal cases so far.`,
              "icon": "https://image.flaticon.com/icons/png/512/2050/2050058.png"
            }
          };

    }

    pushSubsStore.get('userSubs').then(allSubscriptions =>{

        if (typeof allSubscriptions === 'object') {

        var newUserSubArray = []
        var itemsProcessed = 0;

        allSubscriptions.forEach(sub => {
            webpush.sendNotification(sub, JSON.stringify(notificationPayload)).then(() =>{
                
                newUserSubArray.push(sub)
                itemsProcessed++;
                if(itemsProcessed === allSubscriptions.length){
                    
                    console.log('newArray Length', newUserSubArray.length)
                    updateArray(newUserSubArray)
                }
            }).catch(err => {
                
                itemsProcessed++;
                if(itemsProcessed === allSubscriptions.length){
                    
                    console.log('newArray Length', newUserSubArray.length)
                    updateArray(newUserSubArray)
                }
            })

            
            
            
        })
    } else {
        console.log('no users to send notifications.')
    }

    })

    
}

function updateArray(newArray) {
    pushSubsStore.set('userSubs', newArray).then(() => console.log('New array updated !'))
}

function addSub(sub) {
   
    pushSubsStore.get('userSubs').then(data =>{
         if(data === undefined) {
           let tmpObject = [sub]
           pushSubsStore.set('userSubs', tmpObject).then(() => {console.log('user_obj_init')})
         } else {
             if(typeof data === 'object'){
                 let tmpObject = [sub]
                 let fullArray = tmpObject.concat(data) 
                 pushSubsStore.set('userSubs', fullArray).then(() => {
                     console.log('aded_to_sub_array AL:', fullArray.length)
                     notifySubSuccess(sub) //Sending subscription details
                    })
             }
        }
    }).catch(err =>{
        console.log(err)
    })
}

function initVars() {

        getDataFromApi().then((data) =>{
            global.total_local_cases = data.local_total_cases;
            global.total_local_deaths = data.local_deaths;
            console.log('data fetched')
            console.log('CURRENT_CASES', total_local_cases)
            console.log('CURRENT_DEATHS', total_local_deaths)
            console.log('starting daemon thread.')
            let waitTime = 7 // min 
            setInterval(checkDataFromAPI, waitTime * 60000) 
        }).catch(err => {
            console.log(err)
            console.log("rechecking ..")
            setTimeout(initVars, 5000)
        })
    
}

function checkDataFromAPI() {
    getDataFromApi().then(data =>{
	console.log('checking_update')
        if(total_local_cases < data.local_total_cases) {
            console.log('new_cases_update')
            sendNotifications('cases_update', data.local_new_cases, data.local_total_cases)
            global.total_local_cases = data.local_total_cases
        } else {
            console.log('NO_UPDATE_CASES')
        }

        if(total_local_deaths < data.local_new_deaths) {
            console.log('new_deaths_update')
            sendNotifications('deaths_update', data.local_new_deaths, data.local_deaths)
            global.total_local_deaths = data.local_deaths
        } else {
            console.log('NO_UPDATE_DEATHS')
        }

        io.emit('data', data)

    }).catch(err => {
        console.log(err)
    })

}

function getDataFromApi() {
    var options = { method: 'GET',
                    url: API_ENDPOINT,
                    headers: { 'cache-control': 'no-cache' } 
                   };
    return new Promise((resolve, reject) =>{
        
        request(options, (err, res, body ) =>{
            if (err) {
                reject(err)
            } else {
                let { data } = JSON.parse(body);
                resolve(data)
            }
        }) 
    })
}


initVars()