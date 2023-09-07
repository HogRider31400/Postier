

import {io} from 'socket.io-client'
import { Socket } from 'socket.io-client'
import { Ref, WatchStopHandle, isRef,toRaw,toValue,watch } from 'vue'

function realValue(obj : any) : any {
    return JSON.parse(JSON.stringify(toRaw(obj)))
}

const ADD_EVENT = 'add'
const MODIFY_EVENT = 'modify'
const DELETE_EVENT = 'delete'

interface channelDictionnary {
    [index: string]: {
        type : 'ref' | 'reactive' ,
        val : any,
        oldValue : any,
        watcherStop : WatchStopHandle
    }
}

class Postier{
    private socket : Socket
    adresse : string
    port : string | number

    channelsSubscribed : channelDictionnary = {}


    constructor(adresse : string, port : string | number, connectFun : () => void = () => {}){
        const correctPort = port.toString()

        this.socket = io(adresse + ':' + port)
        this.adresse = adresse,
        this.port = correctPort
        this.onConnect(connectFun)
    }

    /**
     * @name onConnect
     * @param fun
     */
    private onConnect(fun : () => void) : void {
        this.socket.on('connect',() => {
            fun()
        })
        this.socket.on(MODIFY_EVENT, (data) => {
            this.handleModify(data)
        })
        this.socket.on(ADD_EVENT,(data) => {
            this.handleAdd(data)
        })
        this.socket.on(DELETE_EVENT, (data) => {
            this.handleDelete(data)
        })
    }

    private isCompliant(data : any) : boolean{
        if(!Object.keys(data).includes('channel')){
            console.log('Received invalid data :',data)
            return false;
        }
        if(!Object.keys(this.channelsSubscribed).includes(data.channel)){
            console.log('Received data from a non-subscribed channel :',data)
            return false;
        }
        return true
    }

    private handleAdd(data : any){
        if(!this.isCompliant(data)){
            return;
        }



        let dataObj = this.channelsSubscribed[data.channel];

        //On stop le watcher le temps de modif la fonction
        dataObj.watcherStop()

        for(var elem of data.value){
            dataObj.val.push(elem)
        }

        this.channelsSubscribed[data.channel].oldValue = realValue(dataObj.val)
        this.channelsSubscribed[data.channel].watcherStop = this.watcherFun(data.channel,dataObj.val,dataObj.type)
    }

    private handleDelete(data : any){
        if(!this.isCompliant(data)){
            return;
        }

        let dataObj = this.channelsSubscribed[data.channel];

        //On stop le watcher le temps de modif la fonction
        dataObj.watcherStop()

        var dec = 0;
        for(var elem of data.value){
            dataObj.val.splice(elem - dec,1)
            dec++;
        }
        this.channelsSubscribed[data.channel].oldValue = realValue(dataObj.val)
        this.channelsSubscribed[data.channel].watcherStop = this.watcherFun(data.channel,dataObj.val,dataObj.type)
    }

    private handleModify(data : any){
        if(!this.isCompliant(data)){
            return;
        }

        let dataObj = this.channelsSubscribed[data.channel]

        //On stop le watcher le temps de modif la fonction
        dataObj.watcherStop()

        if(dataObj.type == 'ref'){
            dataObj.val.value = data.value
        }
        else{
            for(var elem of data.value){
                //ce sont des objets du type {index : string|number,val:any}
                dataObj.val[elem.index] = elem.val
            }
        }
        
        this.channelsSubscribed[data.channel].oldValue = realValue(dataObj.val)
        this.channelsSubscribed[data.channel].watcherStop = this.watcherFun(data.channel,dataObj.val,dataObj.type)
    }

    /**
     * @name subscribe
     * @param channel 
     * @param obj
     */
    
    public subscribe(channel : string,obj : any) : void{
        console.log('subscribed to',channel)
        const objType = (isRef(obj) ? 'ref' : 'reactive')
        const oldValue = realValue(obj)
        console.log(objType,oldValue)
        this.channelsSubscribed[channel] = {
            type : objType,
            val : obj,
            oldValue : oldValue,
            watcherStop : this.watcherFun(channel,obj,objType)
        }
        this.sendSubscription(channel)
    }

    private watcherFun(channel : string, obj : any,objType : any){
        return watch(obj,(newValue) => {
            const oldValue = this.channelsSubscribed[channel].oldValue
            if(objType == 'reactive'){
                try {
                    console.log(newValue.length,oldValue.length)
                    console.log(newValue,oldValue)
                    if(newValue.length > oldValue.length){
                        this.emitAdd(channel,newValue,oldValue)
                    }
                    else if(newValue.length < oldValue.length){
                        this.emitDelete(channel,newValue,oldValue)
                    }
                    else{
                        this.emitModification(channel,objType,newValue,oldValue)
                    }
                }
                catch(error){
                    this.emitModification(channel,objType,newValue,oldValue)
                }
            }
            else{
                this.emitModification(channel,objType,newValue,oldValue)
            }
            this.channelsSubscribed[channel].oldValue = realValue(newValue)
        })
    }

    private emitModification(channel : string,type : 'ref' | 'reactive',newValue : any,oldValue : any){
        console.log('sending',realValue(newValue))

        if(type == 'ref'){
            var toSend = realValue(newValue)
        }
        else{
            var toSend : any = []
            for(var elem of Object.keys(realValue(newValue))){
                if(newValue[elem] !== oldValue[elem]){
                    toSend.push({
                        index : elem,
                        val : newValue[elem]
                    })
                }
            }
        }

        this.socket.emit('modify',{
            channel : channel,
            value : toSend
        })

        this.channelsSubscribed[channel].oldValue = realValue(newValue)
    }

    private emitAdd(channel : string, newValue : any,oldValue : any){
        const elemsAdded = [];
        for(var i = oldValue.length; i < newValue.length;i++){
            elemsAdded.push(newValue[i])
        }
        console.log('got an add')
        this.socket.emit('add',{
            channel : channel,
            value : elemsAdded
        })
    }
    private emitDelete(channel : string, newValue : any,oldValue : any){
        const elemsDeleted = [];

        for(var i = 0; i < oldValue.length;i++){
            var isDeleted = false
            for(var elem of newValue){
                if(JSON.stringify(elem)==JSON.stringify(oldValue[i])){
                    console.log("trouve")
                    isDeleted = true
                    break
                }
            }

            if(!isDeleted){
                elemsDeleted.push(i);
            }
        }

        this.socket.emit('delete',{
            channel : channel,
            value : elemsDeleted
        })

    }

    public unsubscribe(channel : string){
        if(!Object.keys(this.channelsSubscribed).includes(channel)){
            return
        }
        this.channelsSubscribed[channel].watcherStop();
        this.socket.emit('unsubscribe',{
            channel : channel
        })
    }

    /**
     * @name sendSubscription
     * @param channel 
     */

    private sendSubscription(channel : string){
        this.socket.emit('subscribe', {
            channel : channel
        })
    }
}

function createPostier(adresse : string = 'localhost', port : string | number = 1234) : Postier{


    const newPostier = new Postier(
        adresse,
        port
    )

    return newPostier
}

export {createPostier}