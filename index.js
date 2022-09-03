// dependencies
const AWS = require("aws-sdk");
const sharp = require('sharp');

// get reference to S3 client
const s3 = new AWS.S3();

const baseFolder = "public/resize"

const transforms = [
  { name: "1280", width: 1280 , fit:'inside', quality: 95},
  { name: "full", width: null ,fit:'inside', quality: 95},
];

const resizeType = function(item) {
  if (item.fit) {
    return { width: item.width, height: item.width, fit: item.fit }
  }
  return { width: item.width }
};

exports.handler = async (event, context, callback) => {
  const srcBucket = event.Records[0].s3.bucket.name;
  const srcKey = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );

  const key = event.Records[0].s3.object.key;
  const sanitizedKey = key.replace(/\+/g, " ");
  const parts = sanitizedKey.split("/");
  const filename = parts[parts.length - 1];
  const fname = filename.split('.')[0];

  const dstBucket = srcBucket;

  // Infer the image type from the file suffix.
  const typeMatch = srcKey.match(/\.([^.]*)$/);
  if (!typeMatch) {
    console.log("Could not determine the image type.");
    return;
  }

  // Check that the image type is supported
  const imageType = typeMatch[1].toLowerCase();
  if (imageType != "jpg" && imageType != "png" && imageType != "jpeg") {
    console.log(`Unsupported image type: ${imageType}`);
    return;
  }

  // Download the image from the S3 source bucket.

  try {
    const params = {
      Bucket: srcBucket,
      Key: srcKey,
    };
    var origimage = await s3.getObject(params).promise();
    const metadata = await sharp(origimage.Body).metadata();
    console.log(` \n width: ${metadata.width} \n height: ${metadata.height}`);

  } catch (error) {
    console.log(error);
    return;
  }
  // Upload the thumbnail image to the destination bucket
  try {
    await Promise.all(
      transforms.map(async (item) => {
        const metadata = await sharp(origimage.Body).metadata();
        const longSide = metadata.width >= metadata.height ? metadata.width : metadata.height;
        if (longSide > item.width){
          const buffer = await sharp(origimage.Body)
            .resize(resizeType(item))
            .webp({ quality: item.quality })
            .toBuffer();
  
          const destparams = {
            Bucket: dstBucket,
            Key: `${baseFolder}/${item.name}/${fname}.webp`, // w_200/iamgefile.jpg...
            Body: buffer,
            ContentType: "image",
          };
          return await s3.putObject(destparams).promise();
        }
        return
      })
    );
  } catch (error) {
    console.log(error);
    return;
  }

  console.log("Successfully resized");
};