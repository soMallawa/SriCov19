import { Injectable } from '@angular/core';
import * as io from 'socket.io-client';

import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketioService {
  socket: any;
  SOCKET_ENDPOINT = '' // socket.io server.
  
  constructor() {
    this.setupSocketConnection()
  }

  setupSocketConnection(){
    this.socket = io(this.SOCKET_ENDPOINT);
    //this.socket.on('connect', (data) =>{console.log('Connected to the server.')})
  }

  listen(eventName:string) {
    return new Observable((Subscriber) =>{
      this.socket.on(eventName, (data) =>{
        Subscriber.next(data)
      })
    })
  }

  emit(eventName:string, data:any) {
    this.socket.emit(eventName, data)
  }
  
}
