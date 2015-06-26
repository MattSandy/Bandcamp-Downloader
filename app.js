var http            = require('http');
var fs              = require('fs');
var url             = require("url");
var bandcamp_url    = url.parse(process.argv[2]);

var options = {
    host: bandcamp_url.host,
    path: bandcamp_url.path
};
var request = http.request(options, function (res) {
    var data = '';
    res.on('data', function (chunk) {
        data += chunk;
    });
    res.on('end', function () {
        scan_page(data);
    });
});
request.on('error', function (e) {
    console.log(e.message);
});
request.end();
function scan_page(data) {
    var pattern         = new RegExp(/artist: \"(.*?)\"\,/);
    var matches         = data.match(pattern);
    var artist          = matches[1];
    var track_info      = [];

    pattern             = new RegExp(/album_title: \"(.*?)\"\,/);
    matches             = data.match(pattern);
    album               = matches[1];

    pattern             = new RegExp(/\[{(.*?)"encoding_pending(.*?)}]/);
    matches             = data.match(pattern);

    try {
        tracks          = JSON.parse(matches[0]);
    } catch (e) {
        console.warn('Bad user input', matches[0], e);
    }

    //creates artist directory
    if (!fs.existsSync('./' + artist)){
        fs.mkdirSync('./' + artist);
    }
    //creates album directory
    if (!fs.existsSync('./' + artist + "/" + album)){
        fs.mkdirSync('./' + artist + "/" + album);
    }
    for(var i=0;i<tracks.length;i++) {
        track_info = {"id": i, "artist": artist, "album": album, "track": tracks[i].title, "stream": tracks[i].file["mp3-128"]};
        save_track(track_info);
    }
}
function save_track(track_info) {
    //console.dir(track_info);
    http.get(track_info.stream, function(res) {
        track_uri = res.headers.location;
        http.get(track_uri, function(response) {
            //updates track_info with file size
            track_info.size = (response.headers['content-length']);
            var folder = './' + track_info.artist + "/" + track_info.album + "/";
            var file_name =  (track_info.artist + " - " + track_info.track + ".mp3").replace(/\//g, "");
            response.pipe(fs.createWriteStream(folder + file_name));

            //displays the path and filename
            console.log(folder + file_name);

            //display percent downloaded for downloads still in progress
            //timeout is so the filenames are displayed first
            setTimeout(function(){display_progress(track_info)}.bind(track_info), 5 * 1000);
        })
    }.bind(track_info)).on('error', function(e) {
        console.log("Got error: " + e.message);
    });
}
function display_progress(track_info) {
    //displays the progress by comparing the content-length with filesize on disk
    var folder = './' + track_info.artist + "/" + track_info.album + "/";
    var file_name =  (track_info.artist + " - " + track_info.track + ".mp3").replace(/\//g, "");
    var stats = fs.statSync(folder + file_name);
    if(stats.isFile()) {
        var progress = parseInt(parseFloat(stats["size"] / track_info.size) * 100);
        console.log(track_info.track + ': ' + progress + '%');
        if(progress != 100) {
            setTimeout(function(){display_progress(track_info)}.bind(track_info), 5000);
        }
    } else {
        setTimeout(function(){display_progress(track_info)}.bind(track_info), 5000);
    }

}