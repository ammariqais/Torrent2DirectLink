const WebTorrent = require('webtorrent')
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const client = new WebTorrent()


var link = '';
const path = '/Users/qaisammari/Downloads';

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

/*app.get('/watch/:torrentId', (req, res) => {
    const magnet = "magnet:?"+req.params.torrentId;
    console.log(magnet)
    const torrent = client.get(magnet)
    if(torrent === null){
        res.sendFile(__dirname + '/index.html');
        return;
    }

    var file = torrent.files.find(function (file) {
        console.log(file.name);
        return file.name.endsWith('.mkv') || file.name.endsWith('.mp4')
    })
    if(file.name.endsWith(".mkv")){
        res.download(file.path,file.name);
    } else{
        res.sendFile(file.path);
    }

});*/

app.get('/download/:folder/:filename', (req, res) => {
    const filePath = path + "/" + req.params.folder + "/" + req.params.filename ;
    console.log(filePath)
    res.download(filePath,req.params.filename);
});

app.get('/watch/:folder/:filename', (req, res) => {
    const filePath = path + "/" + req.params.folder + "/" + req.params.filename ;
    console.log(filePath)
    if(req.params.filename.endsWith(".mp4")){
        res.sendFile(filePath,req.params.filename);
    } else{
        res.download(filePath,req.params.filename);
    }
});

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('startDownload',(msg)=>{
        link = msg;
        DownloadTorrent();
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});

client.on('error',function (err) {
    console.log("error : "+err)
    io.emit("error",err)
});

function DownloadTorrent(){
    const torrent = client.get(link);
    if(torrent !== null){
        var msg = "";
        if(torrent.done){
            msg = torrent.name + " already downloaded";
            torrent.files.forEach(function (file) {
                const fileInfo = {
                    "name": "Watch Online : " + file.name,
                    "link": encodeURI("watch/"+torrent.name+"/"+file.name)
                }
                console.log("folder : "+torrent.name);
                console.log("file : "+file.name);
                console.log("url : "+"watch/"+torrent.name+"/"+file.name)
                io.emit("getFile",fileInfo)
            });
        } else{
          msg = torrent.name + " on downloading ..."
        }
        io.emit("error",msg)
        return;
    }

    io.emit("action","onDownloading");
    io.emit("error","Getting MetaData ...");
    client.add(link,{ path: path },function (torrent) {
        io.emit("error","Start Downloading "+torrent.name);

        var file = torrent.files.find(function (file) {
            return file.name.endsWith('.mp4')
        });

        if(file !== null){
            const fileInfo = {
                "name": "Watch Online : " + file?.name,
                "link": encodeURI("watch/"+torrent.name+"/"+file?.name)
            }
            io.emit("getFile",fileInfo)
        }

        // Print out progress every 5 seconds
        var interval = setInterval(function () {
            console.log('Progress: ' + (torrent.progress * 100).toFixed(1) + '%')
            const progress = torrent.progress * 100;
            const info = {
                "progress":(progress).toFixed(1) + '%',
                "peers" : torrent.numPeers,
                "download_speed" : torrent.downloadSpeed,
                "upload_speed" : torrent.uploadSpeed,
            };
            io.emit("onDownloading",info);
            if(progress >= 100){
                clearInterval(interval)
            }
        }, 1000);

        torrent.on('done', function () {
            torrent.files.forEach(function (file) {
                const fileInfo = {
                    "name": file.name,
                    "link": encodeURI("download/"+torrent.name+"/"+file.name)
                }
                io.emit("getFile",fileInfo)
                torrent.destroy();
            });
            console.log('torrent download finished')
        });
    });
}
