'use strict'
const requestPromise = require('request-promise-native').defaults({ simple: false });
const request = require('request');
const j = request.jar();
const moment = require('moment');
const uuidv4 = require('uuid/v4');

const rp = require('request-promise');
const {google} = require('googleapis');

const {
	dialogflow,
	UpdatePermission
} = require('actions-on-google');

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const serviceAccount = require('./ards-229510-firebase-adminsdk-hzv3u-b721a75bc4.json');
const jwtClient = new google.auth.JWT(
  serviceAccount.client_email, null, serviceAccount.private_key,
  ['https://www.googleapis.com/auth/actions.fulfillment.conversation'],
  null
);

admin.initializeApp();
const db = admin.firestore();
const app = dialogflow({debug: true});

/** Dialogflow Parameters {@link https://dialogflow.com/docs/actions-and-parameters#parameters} */
const Parameters = {
	ACTIVITITY: 'activity',
	USER: 'user',
  };

/** Collections and fields names in Firestore */
const FirestoreNames = {
	ACTIVITIES: 'activities',
	USERS: 'users',
}

const API = 'https://bigact.sozolab.jp/';

const loginAPI = `${API}login`
const user = {login: '',password: ''};
const userSelf = {"id": 45,"name": "ardseneact"};
const loginOptions = {uri: loginAPI,jar: j,method: "POST",json: true,body: user};

app.intent('addActivity', (conv, params) => {
	
	let targetUser = {};
	
	let usersRef = db.collection(FirestoreNames.USERS);
	let activitiesRef = db.collection(FirestoreNames.ACTIVITIES);
	
	if(params[Parameters.USER] !== null){
		usersRef = usersRef.where("name", '==', params[Parameters.USER]);
	}

	if (params[Parameters.ACTIVITITY] !== null) {
		activitiesRef = activitiesRef.where("name", '==', params[Parameters.ACTIVITITY]);
	}


	return usersRef
    .get().then((userSnapshot) => {

		if (userSnapshot.size > 0) {
			const users = userSnapshot.docs;
			const user = users[0];
			targetUser.id = user.get('id');
			targetUser.name = user.get('name');
		}else{
			targetUser = userSelf;
		}

		return activitiesRef
		.get()
		.then((activitySnapshot) => {

			if (activitySnapshot.size > 0) {

				const activities = activitySnapshot.docs;
				const activity = activities[0];
				const activity_name = activity.get('name');
				const activity_id = activity.get('id');

				return requestPromise( loginOptions )
				.then( body => {
					const cookie = j.getCookieString(loginAPI); 
					
					const uploadAPI = `${API}sensors/0/upload`
					const timestamp =  moment().format();
					const uuid = uuidv4(); 
					const version = '8.8';
					const type = 'label';

					const date = new Date();
					const time = date.getTime();
					const rand = Math.floor(Math.random() * 100000);
					const filename =  `${type}_${time}_${rand}.csv`;
					
					let startRecord = {
						filename: filename, type: type, version: version, 
						data: `${timestamp},${activity_id},${activity_name},true,${targetUser.id};,${uuid},`
					};
					const startOptions = {uri: uploadAPI, headers: {'cookie': cookie},method: "POST",json: true,body: startRecord};
			
					return requestPromise( startOptions )
					.then( body => {

						let stopRecord = {
							filename: filename, type: type, version: version, 
							data: `${timestamp},${activity_id},${activity_name},false,${targetUser.id};,${uuid},`
						};
						const stopOptions = {uri: uploadAPI,headers: {'cookie': cookie},method: "POST",json: true,body: stopRecord};
				
						return requestPromise( stopOptions )
						.then( body => {
							const screenOutput = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
							const message = `${activity_name} added! to ${targetUser.name}`;
							if (!screenOutput) {
							conv.ask(message);
							}
							conv.ask(message);
							return Promise.resolve('Upload success');
						}).catch(uploadErr => {
							return Promise.resolve('Upload failed');
						});

					}).catch(uploadErr => {
						return Promise.resolve('Upload failed');
					});
		
				}).catch(error => {return Promise.resolve('Login failed')});	
			}else{

				const screenOutput = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
				const message = `No ${params[Parameters.ACTIVITITY]} found in database!`;
				if (!screenOutput) {
					conv.ask(message);
				}
				conv.ask(message);
				return Promise.resolve(`No ${params[Parameters.ACTIVITITY]} found in database!`);
			}
			
		}).catch((error) => {throw new Error(`Firestore query activities error: ${error}`);});

	}).catch((error) => {throw new Error(`Firestore query users error: ${error}`);});


	
	
});

app.intent('getActivities', (conv) => {
	
	return requestPromise( loginOptions )
    .then( body => {
		const cookie = j.getCookieString(loginAPI); 
		const activitiesAPI = `${API}activity_types.json`
		const activityOptions = {uri: activitiesAPI, headers: {'cookie': cookie},method: "GET",json: true};

		return requestPromise( activityOptions )
		.then( body => {

			let batch = db.batch();
			let activitiesRef = db.collection(FirestoreNames.ACTIVITIES);
			body.forEach((activity) => {
			  let activityRef = activitiesRef.doc();
			  batch.set(activityRef, activity);
			});
			batch.commit()
			  .then(() => {
				return Promise.resolve('Activities DB succesfully stored');
			  })
			  .catch((error) => {
				throw new Error(`Error storing activities DB: ${error}`);
			  });

			conv.ask("Updated activities");
			return Promise.resolve('Updated activities');
		
		}).catch(error => {return Promise.resolve('Login failed')});
	
    }).catch(error => {return Promise.resolve('Login failed')});
	

});


app.intent('getUsers', (conv) => {
	
	return requestPromise( loginOptions )
    .then( body => {
		const cookie = j.getCookieString(loginAPI); 
		const usersAPI = `${API}users.json`
		const usersOptions = {uri: usersAPI, headers: {'cookie': cookie},method: "GET",json: true};

		return requestPromise( usersOptions )
		.then( body => {

			let batch = db.batch();
			let usersRef = db.collection(FirestoreNames.USERS);
			body.forEach((user) => {
			  let userRef = usersRef.doc();
			  batch.set(userRef, user);
			});
			batch.commit()
			  .then(() => {
				return Promise.resolve('Users DB succesfully stored');
			  })
			  .catch((error) => {
				throw new Error(`Error storing users DB: ${error}`);
			  });

			conv.ask("Updated users");
			return Promise.resolve('Updated users');
		
		}).catch(error => {return Promise.resolve('Login failed')});
	
    }).catch(error => {return Promise.resolve('Login failed')});
	

});


exports.fulfillment = functions.https.onRequest(app);


