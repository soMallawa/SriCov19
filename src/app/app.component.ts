import { Component, OnInit } from '@angular/core';
import { SocketioService } from '../app/services/socketio.service'
import { LocalStorage } from '@ngx-pwa/local-storage';
import { SwPush } from '@angular/service-worker'


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  
  title = 'Sri COVID-19 Tracker';
  
  readonly VAPID_PUBLIC_KEY = "BKnJGaegkKf81lb0sB8jJP1gJ1KMoeM6_05aDx2Nv8RQma0tK4laU7D6Cu-JKV8daj2r8e__HSwe_l-V5Yp4sYk";
  
  isOnline: boolean;
  isSubscribed: any;
  isGlobal:false;
  data: any;
  timestamp: any;

  constructor(private socketService: SocketioService, private storage:LocalStorage, private swPush:SwPush) {}
  
  ngOnInit() {
    this.initData()
    this.connectionEvents()
    this.checkSubscribeEvents()

    this.socketService.listen('data').subscribe(svdata =>{
      this.storage.setItem('data', svdata).toPromise().then(() =>{
        console.log('DATA_UPDATED')
        this.reLoadData()
      })
    })
    
    this.swPush.notificationClicks.subscribe(event =>{
      window.open('https://sricov.live')
    })
    
  }
  checkValue(event: any){
    this.isGlobal = event.currentTarget.checked;
  }
  unSubscribeFormNotifications() {
    this.swPush.unsubscribe().then(() =>{
      console.log('S 0')
    })
  }
  subscribeToNotifications() {
    this.swPush.requestSubscription({
      serverPublicKey:this.VAPID_PUBLIC_KEY
    }).then(sub => {
      this.socketService.emit('new_subscription', sub)
    }).catch(err => {
      console.log(err)
    })
    
  }
  

  initData() {
    this.storage.getItem('data').toPromise().then(data => {
      this.data = data
    })
  }
  
  reLoadData() {
    this.storage.getItem('data').toPromise().then(data =>{
      this.data = data
    })
  }

  checkSubscribeEvents() {
    this.swPush.subscription.subscribe(data =>{
      this.isSubscribed = data;
    })  
  }

  connectionEvents() {
    this.socketService.listen('disconnect').subscribe((data) =>{
      this.isOnline = false;
    })

    this.socketService.listen('connect').subscribe((data) =>{
      this.isOnline = true;
    }) 
   
  }



}

