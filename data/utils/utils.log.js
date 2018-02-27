window.onerror = function(msg, url, line, column, error) {
    var txt = msg + "\n\n" + error;

    if (url) txt = "url:" + url + "\n" + msg + "\nL:" + line + " C:" + column + "\n\n" + error;
    if (error !== undefined) txt += "\n" + error.stack;

    debug_alert(txt);
};

function debug_alert(str) {
    debug_log(str);
    alert(str);
}

function debug_log(msg) {
    log(msg);
    debug(msg);
}

function log(txt) {
    var c = document.createElement("div");
    c.innerHTML = txt;
    document.getElementById("log").appendChild(c);
}

function clearLog() {
    document.getElementById("log").innerHTML = '';
}

function debug(msg) {
    $.ajax({
        url: 'log.jss',
        type: 'post',
        data: { msg },
        async: false
    });
}
