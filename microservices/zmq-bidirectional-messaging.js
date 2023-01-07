'use strict';
const zmq = require('zeromq');
const cluster = require('cluster');
const os = require('os');

const maxWorkers = os.cpus().length;

if (cluster.isMaster) {
    
    // Master process binds push and pull sockets
    const pushWork = zmq.socket('push').bind('ipc://work.ipc');
    const pullReadiness = zmq.socket('pull').bind('ipc://readiness.ipc');

    let readyWorkers = 0;

    pullReadiness.on('message', data => {
        const message = JSON.parse(data);
        if (message.status == 'ready') {
            console.log(`Process ${message.pid} is ${message.status}`);
        }
    });

    // Listen for workers to come online.
    cluster.on('online',
        worker => {
            console.log(`Worker ${worker.process.pid} is online.`)
            readyWorkers++;
            if (readyWorkers == 3) {
                for( let i = 1; i < 30; i++ ) {
                    pushWork.send(JSON.stringify({message: `Send work #${i}`}));
                }
            }
        });
    
    for( let i = 0; i < maxWorkers; i++ ) {
        cluster.fork();
    }

} else {

    // Worker process connects with a push and pull socket
    const pullWork = zmq.socket('pull').connect('ipc://work.ipc');
    const pushReadiness = zmq.socket('push').connect('ipc://readiness.ipc');

    pullWork.on('message', data => {
        const message = JSON.parse(data);
        console.log(message.message);
    });

    pushReadiness.send(JSON.stringify({
        pid: process.pid,
        status: 'ready'
    }));
};