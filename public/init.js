var socket = io();

socket.on('init', function(data) {
    console.log(data);
    // Respond with a message including this clients' id sent from the server
    socket.emit('init', {id: data.id});
});
socket.on('progress', function(data) {
    display_progress(data);
});
socket.on('error', console.error.bind(console));
socket.on('progress', console.log.bind(console));

function display_progress(data) {
    if(data.id===parseInt(data.id)) {
        if($('#track_' + data.id).length) {
            $('#track_' + data.id).html(data.progress);
        } else {
            $('<li id="track_' + data.id + '">' + data.progress + '</li>').appendTo("#tracks");
        }
    } else {
        $('h1').html(data.progress);
    }
}
function send_url() {
    var url = $('#bandcamp_url').val();
    socket.emit('bandcamp_url', {"url": url});
}
$(document).ready(function() {
    $("#bandcamp_url").keyup(function(e) {
        if(e.keyCode == 13) {
            send_url();
        }
    });
});