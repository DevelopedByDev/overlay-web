# R2

Store large amounts of unstructured data without egress fees

> Links below point directly to Markdown versions of each page. Any page can also be retrieved as Markdown by sending an `Accept: text/markdown` header to the page's URL without the `index.md` suffix (for example, `curl -H "Accept: text/markdown" https://developers.cloudflare.com/r2/`).
>
> For other Cloudflare products, see the [Cloudflare documentation directory](https://developers.cloudflare.com/llms.txt).
>
> Use [R2 llms-full.txt](https://developers.cloudflare.com/r2/llms-full.txt) for the complete R2 documentation in a single file, intended for offline indexing, bulk vectorization, or large-context models.

## Overview

- [Cloudflare R2](https://developers.cloudflare.com/r2/index.md): Cloudflare R2 is a cost-effective, scalable object storage solution for cloud-native apps, web content, and data lakes without egress fees.

## Get started

- [Get started](https://developers.cloudflare.com/r2/get-started/index.md): Create your first R2 bucket and store objects using the dashboard, S3-compatible tools, or Workers.
- [CLI](https://developers.cloudflare.com/r2/get-started/cli/index.md): Use R2 from the command line with Wrangler, rclone, or AWS CLI.
- [S3](https://developers.cloudflare.com/r2/get-started/s3/index.md): Use R2 with S3-compatible SDKs like boto3 and the AWS SDK.
- [Workers API](https://developers.cloudflare.com/r2/get-started/workers-api/index.md): Use R2 from Cloudflare Workers with the Workers API.

## How R2 works

- [How R2 works](https://developers.cloudflare.com/r2/how-r2-works/index.md): Find out how R2 works.

## Data migration

- [Data migration](https://developers.cloudflare.com/r2/data-migration/index.md)
- [Migration Strategies](https://developers.cloudflare.com/r2/data-migration/migration-strategies/index.md)
- [Sippy](https://developers.cloudflare.com/r2/data-migration/sippy/index.md)
- [Super Slurper](https://developers.cloudflare.com/r2/data-migration/super-slurper/index.md)

## Buckets

- [Buckets](https://developers.cloudflare.com/r2/buckets/index.md)
- [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/index.md)
- [Configure CORS](https://developers.cloudflare.com/r2/buckets/cors/index.md)
- [Create new buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/index.md)
- [Event notifications](https://developers.cloudflare.com/r2/buckets/event-notifications/index.md)
- [Local uploads](https://developers.cloudflare.com/r2/buckets/local-uploads/index.md)
- [Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/index.md)
- [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/index.md)
- [Storage classes](https://developers.cloudflare.com/r2/buckets/storage-classes/index.md)

## R2 Data Catalog

- [R2 Data Catalog](https://developers.cloudflare.com/r2/data-catalog/index.md): A managed Apache Iceberg data catalog built directly into R2 buckets.
- [DuckDB](https://developers.cloudflare.com/r2/data-catalog/config-examples/duckdb/index.md)
- [PyIceberg](https://developers.cloudflare.com/r2/data-catalog/config-examples/pyiceberg/index.md)
- [Snowflake](https://developers.cloudflare.com/r2/data-catalog/config-examples/snowflake/index.md)
- [Spark (PySpark)](https://developers.cloudflare.com/r2/data-catalog/config-examples/spark-python/index.md)
- [Spark (Scala)](https://developers.cloudflare.com/r2/data-catalog/config-examples/spark-scala/index.md)
- [StarRocks](https://developers.cloudflare.com/r2/data-catalog/config-examples/starrocks/index.md)
- [Apache Trino](https://developers.cloudflare.com/r2/data-catalog/config-examples/trino/index.md)
- [Deleting data](https://developers.cloudflare.com/r2/data-catalog/deleting-data/index.md): How to properly delete data from R2 Data Catalog
- [Getting started](https://developers.cloudflare.com/r2/data-catalog/get-started/index.md): Learn how to enable the R2 Data Catalog on your bucket, load sample data, and run your first query.
- [Manage catalogs](https://developers.cloudflare.com/r2/data-catalog/manage-catalogs/index.md): Understand how to manage Iceberg REST catalogs associated with R2 buckets
- [Table maintenance](https://developers.cloudflare.com/r2/data-catalog/table-maintenance/index.md): Learn how R2 Data Catalog automates table maintenance

## R2 SQL

- [R2 SQL](https://developers.cloudflare.com/r2/r2-sql/index.md): R2 SQL is a serverless SQL interface for Cloudflare R2, enabling querying and analyzing data.

## Tutorials

- [Tutorials](https://developers.cloudflare.com/r2/tutorials/index.md)
- [Protect an R2 Bucket with Cloudflare Access](https://developers.cloudflare.com/r2/tutorials/cloudflare-access/index.md): You can secure access to R2 buckets using Cloudflare Access, which allows you to only allow specific users, groups or applications within your organization to access objects within a bucket.
- [Mastodon](https://developers.cloudflare.com/r2/tutorials/mastodon/index.md): This guide explains how to configure R2 to be the object storage for a self hosted Mastodon instance. You can set up a self-hosted instance in multiple ways.
- [Postman](https://developers.cloudflare.com/r2/tutorials/postman/index.md): Learn how to configure Postman to interact with R2.
- [Use event notification to summarize PDF files on upload](https://developers.cloudflare.com/r2/tutorials/summarize-pdf/index.md): Use event notification to summarize PDF files on upload. Use Workers AI to summarize the PDF and store the summary as a text file.
- [Log and store upload events in R2 with event notifications](https://developers.cloudflare.com/r2/tutorials/upload-logs-event-notifications/index.md): This example provides a step-by-step guide on using event notifications to capture and store R2 upload logs in a separate bucket.

## Videos

- [Videos](https://developers.cloudflare.com/r2/video-tutorials/index.md)

## Demos and architectures

- [Demos and architectures](https://developers.cloudflare.com/r2/demos/index.md): Explore Cloudflare R2 demos and reference architectures for fullstack applications, storage, and AI, with examples and use cases.

## Platform

- [Platform](https://developers.cloudflare.com/r2/platform/index.md)
- [Audit Logs](https://developers.cloudflare.com/r2/platform/audit-logs/index.md)
- [Event subscriptions](https://developers.cloudflare.com/r2/platform/event-subscriptions/index.md)
- [Limits](https://developers.cloudflare.com/r2/platform/limits/index.md)
- [Metrics and analytics](https://developers.cloudflare.com/r2/platform/metrics-analytics/index.md)
- [Release notes](https://developers.cloudflare.com/r2/platform/release-notes/index.md)
- [Choose a storage product](https://developers.cloudflare.com/r2/platform/storage-options/index.md)
- [Troubleshooting](https://developers.cloudflare.com/r2/platform/troubleshooting/index.md)

## Pricing

- [Pricing](https://developers.cloudflare.com/r2/pricing/index.md)

## api

- [Error codes](https://developers.cloudflare.com/r2/api/error-codes/index.md)
- [S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/index.md)
- [Extensions](https://developers.cloudflare.com/r2/api/s3/extensions/index.md)
- [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/index.md)
- [Authentication](https://developers.cloudflare.com/r2/api/tokens/index.md)
- [Workers API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/index.md)
- [Use R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/index.md)
- [Use the R2 multipart API from Workers](https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/index.md)

## examples

- [Authenticate against R2 API using auth tokens](https://developers.cloudflare.com/r2/examples/authenticate-r2-auth-tokens/index.md)
- [aws CLI](https://developers.cloudflare.com/r2/examples/aws/aws-cli/index.md)
- [aws-sdk-go](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-go/index.md)
- [aws-sdk-java](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/index.md)
- [aws-sdk-js](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js/index.md)
- [aws-sdk-js-v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/index.md)
- [aws-sdk-net](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-net/index.md)
- [aws-sdk-php](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-php/index.md): Example of how to configure `aws-sdk-php` to use R2.
- [aws-sdk-ruby](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-ruby/index.md)
- [aws-sdk-rust](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-rust/index.md)
- [aws4fetch](https://developers.cloudflare.com/r2/examples/aws/aws4fetch/index.md)
- [boto3](https://developers.cloudflare.com/r2/examples/aws/boto3/index.md)
- [Configure custom headers](https://developers.cloudflare.com/r2/examples/aws/custom-header/index.md)
- [s3mini](https://developers.cloudflare.com/r2/examples/aws/s3mini/index.md)
- [Use the Cache API](https://developers.cloudflare.com/r2/examples/cache-api/index.md)
- [Multi-cloud setup](https://developers.cloudflare.com/r2/examples/multi-cloud/index.md)
- [Rclone](https://developers.cloudflare.com/r2/examples/rclone/index.md)
- [Use SSE-C](https://developers.cloudflare.com/r2/examples/ssec/index.md): The following tutorial shows some snippets for how to use Server-Side Encryption with Customer-Provided Keys (SSE-C) on Cloudflare R2.
- [Terraform](https://developers.cloudflare.com/r2/examples/terraform/index.md)
- [Terraform (AWS)](https://developers.cloudflare.com/r2/examples/terraform-aws/index.md)

## objects

- [Delete objects](https://developers.cloudflare.com/r2/objects/delete-objects/index.md)
- [Download objects](https://developers.cloudflare.com/r2/objects/download-objects/index.md)
- [Upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/index.md)

## reference

- [Consistency model](https://developers.cloudflare.com/r2/reference/consistency/index.md)
- [Data location](https://developers.cloudflare.com/r2/reference/data-location/index.md)
- [Data security](https://developers.cloudflare.com/r2/reference/data-security/index.md)
- [Durability](https://developers.cloudflare.com/r2/reference/durability/index.md)
- [Partners](https://developers.cloudflare.com/r2/reference/partners/index.md)
- [Snowflake](https://developers.cloudflare.com/r2/reference/partners/snowflake-regions/index.md)
- [Unicode interoperability](https://developers.cloudflare.com/r2/reference/unicode-interoperability/index.md)
- [Wrangler commands](https://developers.cloudflare.com/r2/reference/wrangler-commands/index.md)
- 