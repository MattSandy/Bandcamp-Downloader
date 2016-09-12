var http            = require('http');
var fs              = require('fs');
var cli             = false;

if(typeof(process.argv[2])!="undefined") {
    cli = true;
    var bandcamp_url = process.argv[2];
    console.log(bandcamp_url);
}

//static files
var index           = fs.readFileSync(__dirname + '/public/index.html');
var stylesheet      = fs.readFileSync(__dirname + '/public/style.css');
var init_js         = fs.readFileSync(__dirname + '/public/init.js');


if(!cli) {
    //web server
    var app = http.createServer(function(req, res) {
        if(req.url=="/") {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(index);
        } else if(req.url=="/style.css") {
            res.writeHead(200, {'Content-Type': 'text/css'});
            res.end(stylesheet);
        } else if(req.url=="/init.js") {
            res.writeHead(200, {'Content-Type': 'text/javascript'});
            res.end(init_js);
        } else {
            res.end();
        }
    });
    //sockets for displaying progress
    var io = require('socket.io').listen(app);
    io.on('connection', function(socket) {
        // Use socket to communicate with this particular client only, sending it it's own id
        socket.emit('progress', { "progress": "Enter a Bandcamp URL Above to Get Started", id: socket.id });
        socket.on('i am client', console.log);
        socket.on('bandcamp_url', function (data) {
            console.log(data);
            var url_functions = require('url');
            var bandcamp_url = url_functions.parse(data.url);
            var options = {
                host: bandcamp_url.host,
                path: bandcamp_url.path
            };
            init(socket,options);
        });
    });
    app.listen(3000);
} else {
    var url_functions = require('url');
    var bandcamp_url = url_functions.parse(bandcamp_url);
    var options = {
        host: bandcamp_url.host,
        path: bandcamp_url.path
    };
    init(null,options);
}
function init(socket,options) {
    var request = http.request(options, function (res) {
        var data = '';
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function () {
            scan_page(socket, data);
        });
    });
    request.on('error', function (e) {
        console.log("Error on init: " + e.message);
    });
    request.end();
}
function scan_page(socket, data) {
    var pattern         = new RegExp(/artist: \"(.*?)\"\,/);
    var matches         = data.match(pattern);
    var artist          = matches[1];
    var track_info      = [];

    pattern             = new RegExp(/album_title: \"(.*?)\"\,/);
    matches             = data.match(pattern);
    var album           = matches[1];

    pattern             = new RegExp(/\[{(.*?)"encoding_pending(.*?)}]/);
    matches             = data.match(pattern);

    try {
        var tracks      = JSON.parse(matches[0]);
    } catch (e) {
        console.warn('Bad user input', matches[0], e);
    }

    //Sends Artist Info to Browser
    var message = "Downloading Tracks from " + artist + "'s album " + album;
    if(socket!=null) {
        socket.emit('progress', { "progress": message, id: socket.id });
    } else {
        console.log(message);
    }

    //creates albums directory
    if (!fs.existsSync('./albums')){
        fs.mkdirSync('./albums');
    }
    //creates artist directory
    if (!fs.existsSync('./albums/' + artist)){
        fs.mkdirSync('./albums/' + artist);
    }
    //creates album directory
    if (!fs.existsSync('./albums/' + artist + "/" + album)){
        fs.mkdirSync('./albums/' + artist + "/" + album);
    }
    for(var i=0;i<tracks.length;i++) {
        try {
            if(tracks[i].file["mp3-128"].substr(0,4)!="http") {
                tracks[i].file["mp3-128"] = "http:" + tracks[i].file["mp3-128"];
            }
            track_info = {"id": i, "artist": artist, "album": album, "track": tracks[i].title, "stream": tracks[i].file["mp3-128"]};
            save_track(track_info,socket);
        } catch (e) {
            console.log(track_info);
        }
    }
}
function save_track(track_info,socket) {
    //console.dir(track_info);
    http.get(track_info.stream, function(res) {
        track_uri = res.headers.location;
        http.get(track_uri, function(response) {
            //updates track_info with file size
            track_info.size = (response.headers['content-length']);
            var folder = './albums/' + track_info.artist + "/" + track_info.album + "/";
            var file_name =  (track_info.artist + " - " + track_info.track + ".mp3").replace(/\//g, "");
            response.pipe(fs.createWriteStream(folder + file_name));

            //displays the path and filename
            console.log(folder + file_name);

            //display percent downloaded
            setTimeout(function(){send_progress(track_info,socket)}.bind(track_info,socket), 1000);
        })
    }.bind(track_info)).on('error', function(e) {
        console.log("Got error: " + e.message);
    });
}
function send_progress(track_info, socket) {
    //displays the progress by comparing the content-length with filesize on disk
    var folder = './albums/' + track_info.artist + "/" + track_info.album + "/";
    var file_name =  (track_info.artist + " - " + track_info.track + ".mp3").replace(/\//g, "");
    var stats = fs.statSync(folder + file_name);
    if(stats.isFile()) {
        var progress = parseInt(parseFloat(stats["size"] / track_info.size) * 100);
        //console.log(track_info.track + ': ' + progress + '%');
        //send to the browser (id for list element)
        if(socket!=null) {
            socket.emit('progress', { "id": track_info.id, "progress": track_info.track + ': ' + progress + '%' });
        }
        if(progress != 100) {
            setTimeout(function(){send_progress(track_info,socket)}.bind(track_info,socket), 1000);
        }
    } else {
        setTimeout(function(){send_progress(track_info,socket)}.bind(track_info,socket), 1000);
    }

}