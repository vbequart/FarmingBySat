var http = require('http');
var fs = require('fs');
var name4;
var name8;

/* Chargement du fichier index.html affiché au client */
var server = http.createServer(function(req, res) {
    fs.readFile('./home.html', 'utf-8', function(error, content) {
        res.writeHead(200, {"Content-Type": "text/html"});
        res.end(content);
    });
});

/* Chargement de socket.io */
var io = require('socket.io').listen(server);

/* Begin of synchronous listening of server */
io.sockets.on('connection', function (socket) {

    socket.emit('message', 'Vous êtes bien connecté ! ');

    socket.on('message', function (message) {
      console.log(message);
    });

/* Function wich delete raws files and folders from data download  */
    socket.on('deleteData', function (message) {
      deleteFile('OSquery-result.xml');
      deleteFile('product_list');
      deleteFolder('logs/');
      deleteFolder('MANIFEST/');
      console.log('files deleted successfully!');
    });

/* Extract only images from the download zip and delete this archive */
    socket.on('extractFile', function (message) {
      var fs = require('fs');
      var parse = require('csv-parse');
      var myName = [];
      fs.createReadStream("product-list.csv")
        .pipe(parse({delimiter: ','}))
        .on('data', function(csvrow) {
        myName.push(csvrow[0]);
      })
      .on('end',function() {
        //console.log("Finish get Copernicus package name : " + myName);
        var Zip = require('adm-zip');
        for (var i = 0; i < myName.length; i++) {
          if(fs.existsSync("farmingData/"+myName[i]+".zip")){
            var myzip = new Zip("farmingData/"+myName[i]+".zip");
            //myzip.extractAllTo("farmingData/"+myName, true);
            /*  Extract Only IMG_DATA  */
            var zipEntries = myzip.getEntries();
            zipEntries.forEach(function(zipEntry) {
              var myString = "IMG_DATA/";
              var position = zipEntry.entryName.indexOf(myString);
    		      if (position != -1) {
                var total = position + myString.length;
                if( total == zipEntry.entryName.length){
                  myzip.extractEntryTo( zipEntry.entryName,"farmingData/"+myName[i], false, true);
                }
    		      }
    	      });
            deleteFile('farmingData/'+myName[i]+'.zip');
            console.log("Extraction of " + myName[i] + " is finished!");
          }
        }
      });
    });

/* Download a package from copernicus */
// TODO : handle coordinates
    socket.on('coordinates', function (message) {
      console.log("Une requete de téléchargement! Il veut les coordonnées suivantes: ");
      console.log(message);

      /*  Modify coordinates to utm (usefull later) */
      /*var utm = require('utm-latlng');
      var utmObj = new utm();
      var utmObj = utmObj.convertLatLngToUtm(message[0], message[1]);
      console.log("convert done");
      console.log(utmObj);*/

      /*  Begin Download thanks to sh file  */
      const exec = require('child_process').exec;
      const testscript = exec('"./recupDonnees.sh" -c '+message[1]+','+message[0]+':'+message[3]+','+message[2]); // Longitude et lattitude
      console.log("Téléchargement lancé?");
      testscript.stdout.on('data', function(data){
         //TODO: When Download is finished, call extract, then call delete
          console.log("Heyheyhey"+data);
      });
      testscript.stderr.on('data', function(data){
          console.log(data);
      });
    });

    /*  Execute Java code to convert images  */
    socket.on('execJava', function(message) {
      var exec = require('child_process').exec;
      var child = exec('java -jar hello.jar', function (error, stdout, stderr){
        console.log('Output -> ' + stdout);
        if(error !== null){
          console.log("Error -> "+error);
        }
      });
    });

    /*  Find images name to send them to java program */
    socket.on('findImagesName', function(data){
      var fs = require('fs');
      var parse = require('csv-parse');
      var myName = [];
      fs.createReadStream("product-list.csv")
        .pipe(parse({delimiter: ','}))
        .on('data', function(csvrow) {
        myName.push(csvrow[0]);
      })
      .on('end',function() {
        console.log("Finish get Copernicus package name : " + myName[0] +" For detection." );
        if(fs.existsSync("farmingData/"+myName[0])){
          console.log("Coucou tout le monde!");
        }
        if( fs.existsSync("farmingData/"+myName[0]+"/R10m") ) {
          console.log("Folder 10 exist!");
          var myPath = "farmingData/"+myName[0]+"/R10m";
          fs.readdirSync(myPath).forEach(function(file) {
            findNames("B04", "B08", myPath, file);
          });
          console.log(name4 + " and " + name8);
        }else if(fs.existsSync("farmingData/"+myName[0]+"/R20m")  ){
          var myPath = "farmingData/"+myName[0]+"/R10m";
          fs.readdirSync(myPath).forEach(function(file) {
            findNames("B04", "B8A", myPath, file);
          });
          console.log(name4 + " and " + name8);
        }else if(fs.existsSync("farmingData/"+myName[0]+"/R60m")  ){
          var myPath = "farmingData/"+myName[0]+"/R10m";
          fs.readdirSync(myPath).forEach(function(file) {
            findNames("B04", "B8A", myPath, file);
          });
          console.log(name4 + " and " + name8);
        }else {
          console.log("Just take images!");
          var myPath = "farmingData/"+myName[0];
          fs.readdirSync(myPath).forEach(function(file) {
            findNames("B04", "B08", myPath, file);
          });
          console.log(name4 + " and " + name8);
        }
        /*var spawn = require("child_process").spawn;
        var process = spawn('python',["imageNDVI.py", name4, name8 ]);
        process.stdout.on('data', function (data){
          console.log("Traitement fini!");
        });*/

        var PythonShell = require('python-shell');
        var options = {
          pythonPath: 'python3',
          args: [name4, name8,myName[0]]
        }
        PythonShell.run('imageNDVI.py', options, function (err,results){
          console.log('results: %j', results);
        });
        /*pyshell.on('message', function(message){
          console.log(message);
        });
        pyshell.end(function (err) {
          if(err){
            throw err;
          }
          console.log('finished');
        });*/
      });
    });

});

/* Allow server to delete one file to a passing path */
function deleteFile(path) {
  fs.stat(path, function (err, stats) {
    if (err) {
      return console.error(err);
    }
    fs.unlink(path,function(err){
      if(err) return console.log(err);
    });
  });
  console.log("File deleted!" + path);
}

/*  Allow server to recursively delete a folder and it content by passing it path */
function deleteFolder(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file) {
      var curPath = path + "/" + file;
        if(fs.statSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
    });
    fs.rmdirSync(path);
  }
}

/*  For later, in final version, to reduce my code  */
function findNames(myString4, myString8, myPath, file){
  var curPath = myPath + "/" + file;
  var position4 = file.indexOf(myString4);
  var position8 = file.indexOf(myString8);
  if(position4 != -1){
    name4 = curPath;
  }else if(position8 != -1){
    name8 = curPath;
  }
}

server.listen(8080);