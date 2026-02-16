import { PutObjectCommand } from "@aws-sdk/client-s3";

import s3Client from "./s3";
import yandexS3 from "./ys3";

export async function uploadToBothBuckets(
  username: string,
  buffer: Buffer,
  outputFilename: string,
  contentType: string
): Promise<string> {
  const s3Key = `${username}/${outputFilename}`;
  const commonParams = {
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  };

  const primaryBucket = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";
  const yandexBucket = process.env.ACTIVE_ENV === "prod" ? "korner-pro" : "korner-lol";

  await Promise.all([
    s3Client.send(new PutObjectCommand({ ...commonParams, Bucket: primaryBucket })),
    yandexS3.send(new PutObjectCommand({ ...commonParams, Bucket: yandexBucket })),
  ]);

  const baseUrl =
    process.env.ACTIVE_ENV === "prod" ? "https://cdn.korner.pro" : "https://cdn.korner.lol";

  return `${baseUrl}/${s3Key}`;
}
