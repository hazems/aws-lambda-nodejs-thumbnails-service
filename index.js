var async = require('async');
var AWS = require('aws-sdk');
var sharp = require('sharp');
var s3 = new AWS.S3();

exports.handler = function(event, context, callback) {
    var srcBucket = event.Records[0].s3.bucket.name;
    var sourceFileName = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    var destBucket = "processed-thumbnail-images";
    var destFileName = "resized-" + sourceFileName + new Date().getTime();
    var width = 150; // Assume that our thumbnail image width will be 150 px

    var typeMatch = sourceFileName.match(/\.([^.]*)$/);
    if (!typeMatch) {
        callback("Image type is invalid ...");
        return;
    }
    
    var imageType = typeMatch[1].toLowerCase();
    if (imageType != "jpg" && imageType != "png" && imageType != "jpeg") {
        callback('Only JPG and PNG images are supported!');
        return;
    }
    
    async.waterfall([
        async.apply(download, srcBucket, sourceFileName),
        async.apply(transform, width, imageType),
        async.apply(upload, destBucket, destFileName),
        ], 
        async.apply(finalize, callback, srcBucket, sourceFileName, destBucket, destFileName)
    );
};

function download(srcBucket, sourceFileName, next) {
    s3.getObject({
        Bucket: srcBucket,
        Key: sourceFileName
    },
    next);
}

function transform(width, imageType, response, next) {
    sharp(response.Body)
        .resize(width)
            .toBuffer(imageType, function(err, buffer) {
                if (err) {
                    next(err);
                } else {
                    next(null, response.ContentType, buffer);
                }
            });
}

function upload(destBucket, destFileName, contentType, data, next) {
    s3.putObject({
            Bucket: destBucket,
            Key: destFileName,
            Body: data,
            ContentType: contentType
        },
        next);
}

function finalize(callback, srcBucket, sourceFileName, destBucket, destFileName, err) {
    if (err) {
        console.error(
            'Unable to resize ' + srcBucket + '/' + sourceFileName +
            ' and upload to ' + destBucket + '/' + destFileName +
            ' due to an error: ' + err
        );
    } else {
        console.log(
            'Successfully resized ' + srcBucket + '/' + sourceFileName +
            ' and uploaded to ' + destBucket + '/' + destFileName
        );
    }

    callback(null, "message");
}