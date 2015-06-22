var http            = require('http');
var fs              = require('fs');
var url             = require("url");
var bandcamp_url    = url.parse("https://takuakaflip.bandcamp.com/album/re-wrk-vol-i");

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

    pattern             = new RegExp(/\[{"encoding_pending(.*?)}]/);
    matches             = data.match(pattern);
    tracks              = JSON.parse(matches[0]);

    //artist directory
    if (!fs.existsSync('./' + artist)){
        fs.mkdirSync('./' + artist);
    }
    //creates the album directory
    if (!fs.existsSync('./' + artist + "/" + album)){
        fs.mkdirSync('./' + artist + "/" + album);
    }
    for(var i=0;i<tracks.length;i++) {
        track_info = {"artist": artist, "album": album, "track": tracks[i].title, "stream": tracks[i].file["mp3-128"]};
        save_track(track_info);
    }
}
function save_track(track_info) {
    //console.dir(track_info);
    http.get(track_info.stream, function(res) {
        track_uri = res.headers.location;
        console.log(track_info.track);
        console.log(track_uri);
        http.get(track_uri, function(response) {
            var folder = './' + track_info.artist + "/" + track_info.album + "/";
            var file_name =  (track_info.artist + " - " + track_info.track + ".mp3").replace(/\//g, "");
            response.pipe(fs.createWriteStream(folder + file_name));
        })
    }.bind(track_info)).on('error', function(e) {
        console.log("Got error: " + e.message);
    });
}