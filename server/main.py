import socketio

sio = socketio.Server(cors_allowed_origins="*")

subscribers = {
    'counter' : []
}

channels = {
    'counter' : []
}


@sio.event
def connect(sid,environ,auth):
    print(sid)

@sio.on('subscribe')
def subscribe_event(sid,data):
    if not 'channel' in data:
        return
    
    subscribers[data['channel']].append(sid)
    sio.enter_room(sid,data['channel'])

def is_compliant(data):
    if not 'channel' in data:
        return False
    return True

@sio.on('modify')
def modify_event(sid,data):
    if not is_compliant(data):
        return

    channels[data['channel']] = data['value']

    sio.emit('modify',{'channel' : data['channel'] , 'value' : data['value']},room=data['channel'],skip_sid=sid)

@sio.on('delete')
def delete_event(sid,data):
    if not is_compliant(data):
        return
    
    dec = 0
    for elem in data['value']:
        channels[data['channel']].pop(elem-dec)
        dec+=1
    
    sio.emit('delete',{'channel' : data['channel'], 'value' : data['value']})

@sio.on('add')
def add_event(sid,data):
    if not is_compliant(data):
        return
    print('received',data)
    for elem in data['value']:
        channels[data['channel']].append(elem)
    
    sio.emit('add',{'channel' : data['channel'],'value' : data['value']})



app = socketio.WSGIApp(sio)
import eventlet
eventlet.wsgi.server(eventlet.listen(('', 1234)), app)