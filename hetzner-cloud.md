# Hetzner Cloud Docs

- Canonical docs: https://docs.hetzner.cloud/
- API reference: https://docs.hetzner.cloud/reference/cloud
- Changelog: https://docs.hetzner.cloud/changelog
- Tutorials: https://community.hetzner.com/tutorials
[Volume Actions](https://docs.hetzner.cloud/reference/cloud#tag/volume-actions)

- Floating IPs
- Expand Floating IPs


[Floating IPs](https://docs.hetzner.cloud/reference/cloud#tag/floating-ips)

- Expand Floating IP Actions


[Floating IP Actions](https://docs.hetzner.cloud/reference/cloud#tag/floating-ip-actions)

- Firewalls
- Expand Firewalls


[Firewalls](https://docs.hetzner.cloud/reference/cloud#tag/firewalls)

- Expand Firewall Actions


[Firewall Actions](https://docs.hetzner.cloud/reference/cloud#tag/firewall-actions)

- Load Balancers
- Expand Load Balancers


[Load Balancers](https://docs.hetzner.cloud/reference/cloud#tag/load-balancers)

- Expand Load Balancer Actions


[Load Balancer Actions](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions)

- Expand Load Balancer Types


[Load Balancer Types](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-types)

- Networks
- Expand Networks


[Networks](https://docs.hetzner.cloud/reference/cloud#tag/networks)

- Expand Network Actions


[Network Actions](https://docs.hetzner.cloud/reference/cloud#tag/network-actions)

- DNS
- Expand Zones


[Zones](https://docs.hetzner.cloud/reference/cloud#tag/zones)

- Expand Zone Actions


[Zone Actions](https://docs.hetzner.cloud/reference/cloud#tag/zone-actions)

- Expand Zone RRSets


[Zone RRSets](https://docs.hetzner.cloud/reference/cloud#tag/zone-rrsets)

- Expand Zone RRSet Actions


[Zone RRSet Actions](https://docs.hetzner.cloud/reference/cloud#tag/zone-rrset-actions)

- Security
- Expand Certificates


[Certificates](https://docs.hetzner.cloud/reference/cloud#tag/certificates)

- Expand Certificate Actions


[Certificate Actions](https://docs.hetzner.cloud/reference/cloud#tag/certificate-actions)

- Expand SSH Keys


[SSH Keys](https://docs.hetzner.cloud/reference/cloud#tag/ssh-keys)

- Locations
- Expand Locations


[Locations](https://docs.hetzner.cloud/reference/cloud#tag/locations)

- Expand Data Centers


[Data Centers](https://docs.hetzner.cloud/reference/cloud#tag/data-centers)

- Billing
- Expand Pricing


[Pricing](https://docs.hetzner.cloud/reference/cloud#tag/pricing)


[Powered by Scalar](https://www.scalar.com/)

v1.0.0

OAS 3.0.3

# Hetzner Cloud API

# Overview

This is the official documentation for the Hetzner Cloud API.

## Introduction

The Hetzner Cloud API operates over HTTPS and uses JSON as its data format. The API is a RESTful API and utilizes HTTP methods and HTTP status codes to specify requests and responses.

As an alternative to working directly with our API you may also consider to use:

- Our CLI program [hcloud](https://github.com/hetznercloud/cli)
- Our [library for Go](https://github.com/hetznercloud/hcloud-go)
- Our [library for Python](https://github.com/hetznercloud/hcloud-python)

You can find even more libraries, tools and integrations on our [Awesome List on GitHub](https://github.com/hetznercloud/awesome-hcloud).

### Open source credits

If you are developing an open-source project that supports or intends to add support for Hetzner APIs, you may be eligible for a free one-time credit of up to € 50 / $ 50 on your account. Please contact us via the support page on your [Hetzner Console](https://console.hetzner.cloud/support) and let us know the following:

- The name of the project you are working on
- A short description of the project
- Link to the project website or repo where the project is hosted
- Affiliation with / role in the project (e.g. project maintainer)
- Link to some other open-source work you have already done (if you have done so)

**Note:** We only consider rewards for projects that provide Hetzner-specific functionality or integrations. For example, our Object Storage exposes a standard S3 API without any Hetzner-specific extensions. Projects that focus solely on generic S3 capabilities (e.g., general S3 clients or SDKs) are not Hetzner-specific and are therefore not eligible for Hetzner Rewards.

## Getting Started

To get started using the API you first need an API token. Sign in into the [Hetzner Console](https://console.hetzner.com/) choose a Project, go to `Security` → `API Tokens`, and generate a new token. Make sure to copy the token because it won’t be shown to you again. A token is bound to a Project, to interact with the API of another Project you have to create a new token inside the Project. Let’s say your new token is `LRK9DAWQ1ZAEFSrCNEEzLCUwhYX1U3g7wMg4dTlkkDC96fyDuyJ39nVbVjCKSDfj`.

You’re now ready to do your first request against the API. To get a list of all Servers in your Project, issue the example request on the right side using [curl](https://curl.se/).

Make sure to replace the token in the example command with the token you have just created. Since your Project probably does not contain any Servers yet, the example response will look like the response on the right side. We will almost always provide a resource root like `servers` inside the example response. A response can also contain a `meta` object with information like [Pagination](https://docs.hetzner.cloud/reference/cloud#description/pagination).

**Example Request**

```shell
curl -H "Authorization: Bearer LRK9DAWQ1ZAEFSrCNEEzLCUwhYX1U3g7wMg4dTlkkDC96fyDuyJ39nVbVjCKSDfj" \
  https://api.hetzner.cloud/v1/servers
```

**Example Response**

```json
{
  "servers": [],
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 25,
      "previous_page": null,
      "next_page": null,
      "last_page": 1,
      "total_entries": 0
    }
  }
}
```

## Authentication

All requests to the Hetzner Cloud API must be authenticated via a API token. Include your secret API token in every request you send to the API with the `Authorization` HTTP header.

To create a new API token for your Project, switch into the [Hetzner Console](https://console.hetzner.com/) choose a Project, go to `Security` → `API Tokens`, and generate a new token.

**Example Authorization header**

```http
Authorization: Bearer LRK9DAWQ1ZAEFSrCNEEzLCUwhYX1U3g7wMg4dTlkkDC96fyDuyJ39nVbVjCKSDfj
```

## Errors

Errors are indicated by HTTP status codes. Further, the response of the request which generated the error contains an error code, an error message, and, optionally, error details. The schema of the error details object depends on the error code.

The error response contains the following keys:

| Keys | Meaning |
| --- | --- |
| `code` | Short string indicating the type of error (machine-parsable) |
| `message` | Textual description on what has gone wrong |
| `details` | An object providing for details on the error (schema depends on code) |

**Example response**

```json
{
  "error": {
    "code": "invalid_input",
    "message": "invalid input in field 'broken_field': is too long",
    "details": {
      "fields": [\
        {\
          "name": "broken_field",\
          "messages": ["is too long"]\
        }\
      ]
    }
  }
}
```

### Error Codes

| Status | Code | Description |
| --- | --- | --- |
| `400` | `json_error` | Invalid JSON input in your request. |
| `401` | `unauthorized` | Request was made with an invalid or unknown token. |
| `401` | `token_readonly` | The token is only allowed to perform GET requests. |
| `403` | `forbidden` | Insufficient permissions for this request. |
| `403` | `maintenance` | Cannot perform operation due to maintenance. |
| `403` | `resource_limit_exceeded` | Error when exceeding the maximum quantity of a resource for an account. |
| `404` | `not_found` | Entity not found. |
| `405` | `method_not_allowed` | The request method is not allowed |
| `409` | `uniqueness_error` | One or more of the objects fields must be unique. |
| `409` | `conflict` | The resource has changed during the request, please retry. |
| `410` | `deprecated_api_endpoint` | The API endpoint functionality was removed. |
| `412` | `resource_unavailable` | The requested resource is currently unavailable (e.g. not available for order). |
| `422` | `invalid_input` | Error while parsing or processing the input. |
| `422` | `service_error` | Error within a service. |
| `422` | `unsupported_error` | The corresponding resource does not support the Action. |
| `423` | `locked` | The item you are trying to access is locked (there is already an Action running). |
| `423` | `protected` | The Action you are trying to start is protected for this resource. |
| `429` | `rate_limit_exceeded` | Error when sending too many requests. |
| `500` | `server_error` | Error within the API backend. |
| `503` | `unavailable` | A service or product is currently not available. |
| `504` | `timeout` | The request could not be answered in time, please retry. |

**invalid\_input**

```json
{
  "error": {
    "code": "invalid_input",
    "message": "invalid input in field 'broken_field': is too long",
    "details": {
      "fields": [\
        {\
          "name": "broken_field",\
          "messages": ["is too long"]\
        }\
      ]
    }
  }
}
```

**uniqueness\_error**

```json
{
  "error": {
    "code": "uniqueness_error",
    "message": "SSH key with the same fingerprint already exists",
    "details": {
      "fields": [\
        {\
          "name": "public_key"\
        }\
      ]
    }
  }
}
```

**resource\_limit\_exceeded**

```json
{
  "error": {
    "code": "resource_limit_exceeded",
    "message": "project limit exceeded",
    "details": {
      "limits": [\
        {\
          "name": "project_limit"\
        }\
      ]
    }
  }
}
```

**deprecated\_api\_endpoint**

```json
{
  "error": {
    "code": "deprecated_api_endpoint",
    "message": "API functionality was removed",
    "details": {
      "announcement": "https://docs.hetzner.cloud/changelog#2023-07-20-foo-endpoint-is-deprecated"
    }
  }
}
```

## Actions

Actions represent asynchronous tasks within the API, targeting one or more resources. Triggering changes in the API may return a `running` action.

An action should be waited upon, until it reaches either the `success` or `error` state. Avoid polling the action's state too frequently to reduce the risk of exhausting your API requests and hitting the [rate limit](https://docs.hetzner.cloud/reference/cloud#description/rate-limiting).

If an action fails, it will contain details about the underlying error.

Once the asynchronous tasks have completed and the targeted resources are in a consistent state, the action is marked as succeeded.

In some cases, you may trigger multiple changes at once, and only wait for the returned actions at a later stage.

## Labels

Labels are `key/value` pairs that can be attached to all resources.

Valid label keys have two segments: an optional prefix and name, separated by a slash (`/`). The name segment is required and must be a string of 63 characters or less, beginning and ending with an alphanumeric character (`[a-z0-9A-Z]`) with dashes (`-`), underscores (`_`), dots (`.`), and alphanumerics between. The prefix is optional. If specified, the prefix must be a DNS subdomain: a series of DNS labels separated by dots (`.`), not longer than 253 characters in total, followed by a slash (`/`).

Valid label values must be a string of 63 characters or less and must be empty or begin and end with an alphanumeric character (`[a-z0-9A-Z]`) with dashes (`-`), underscores (`_`), dots (`.`), and alphanumerics between.

The `hetzner.cloud/` prefix is reserved and cannot be used.

**Example Labels**

```json
{
  "labels": {
    "environment": "development",
    "service": "backend",
    "example.com/my": "label",
    "just-a-key": ""
  }
}
```

## Label Selector

For resources with labels, you can filter resources by their labels using the label selector query language.

| Expression | Meaning |
| --- | --- |
| `k==v` / `k=v` | Value of key `k` does equal value `v` |
| `k!=v` | Value of key `k` does not equal value `v` |
| `k` | Key `k` is present |
| `!k` | Key `k` is not present |
| `k in (v1,v2,v3)` | Value of key `k` is `v1`, `v2`, or `v3` |
| `k notin (v1,v2,v3)` | Value of key `k` is neither `v1`, nor `v2`, nor `v3` |
| `k1==v,!k2` | Value of key `k1` is `v` and key `k2` is not present |

### Examples

- Returns all resources that have a `env=production` label and that don't have a `type=database` label:

`env=production,type!=database`

- Returns all resources that have a `env=testing` or `env=staging` label:

`env in (testing,staging)`

- Returns all resources that don't have a `type` label:

`!type`


## Pagination

Responses which return multiple items support pagination. If they do support pagination, it can be controlled with following query string parameters:

- A `page` parameter specifies the page to fetch. The number of the first page is 1.
- A `per_page` parameter specifies the number of items returned per page. The default value is 25, the maximum value is 50 except otherwise specified in the documentation.

Responses contain a `Link` header with pagination information.

Additionally, if the response body is JSON and the root object is an object, that object has a `pagination` object inside the `meta` object with pagination information:

**Example Pagination**

```json
{
    "servers": [...],
    "meta": {
        "pagination": {
            "page": 2,
            "per_page": 25,
            "previous_page": 1,
            "next_page": 3,
            "last_page": 4,
            "total_entries": 100
        }
    }
}
```

The keys `previous_page`, `next_page`, `last_page`, and `total_entries` may be `null` when on the first page, last page, or when the total number of entries is unknown.

**Example Pagination Link header**

```http
Link: <https://api.hetzner.cloud/v1/actions?page=2&per_page=5>; rel="prev",
      <https://api.hetzner.cloud/v1/actions?page=4&per_page=5>; rel="next",
      <https://api.hetzner.cloud/v1/actions?page=6&per_page=5>; rel="last"
```

Line breaks have been added for display purposes only and responses may only contain some of the above `rel` values.

## Rate Limiting

All requests, whether they are authenticated or not, are subject to rate limiting. If you have reached your limit, your requests will be handled with a `429 Too Many Requests` error. Burst requests are allowed. Responses contain several headers which provide information about your current rate limit status.

- The `RateLimit-Limit` header contains the total number of requests you can perform per hour.
- The `RateLimit-Remaining` header contains the number of requests remaining in the current rate limit time frame.
- The `RateLimit-Reset` header contains a UNIX timestamp of the point in time when your rate limit will have recovered, and you will have the full number of requests available again.

The default limit is 3600 requests per hour and per Project. The number of remaining requests increases gradually. For example, when your limit is 3600 requests per hour, the number of remaining requests will increase by 1 every second.

## Server Metadata

Your Server can discover metadata about itself by doing a HTTP request to specific URLs. The following data is available:

| Data | Format | Contents |
| --- | --- | --- |
| hostname | text | Name of the Server as set in the api |
| instance-id | number | ID of the server |
| public-ipv4 | text | Primary public IPv4 address |
| private-networks | yaml | Details about the private networks the Server is attached to |
| availability-zone | text | Name of the availability zone that Server runs in |
| region | text | Network zone, e.g. eu-central |

**Example: Summary**

```shell
$ curl http://169.254.169.254/hetzner/v1/metadata
```

```yaml
availability-zone: hel1-dc2
hostname: my-server
instance-id: 42
public-ipv4: 1.2.3.4
region: eu-central
```

**Example: Hostname**

```shell
$ curl http://169.254.169.254/hetzner/v1/metadata/hostname
my-server
```

**Example: Instance ID**

```shell
$ curl http://169.254.169.254/hetzner/v1/metadata/instance-id
42
```

**Example: Public IPv4**

```shell
$ curl http://169.254.169.254/hetzner/v1/metadata/public-ipv4
1.2.3.4
```

**Example: Private Networks**

```shell
$ curl http://169.254.169.254/hetzner/v1/metadata/private-networks
```

```yaml
- ip: 10.0.0.2
  alias_ips: [10.0.0.3, 10.0.0.4]
  interface_num: 1
  mac_address: 86:00:00:2a:7d:e0
  network_id: 1234
  network_name: nw-test1
  network: 10.0.0.0/8
  subnet: 10.0.0.0/24
  gateway: 10.0.0.1
- ip: 192.168.0.2
  alias_ips: []
  interface_num: 2
  mac_address: 86:00:00:2a:7d:e1
  network_id: 4321
  network_name: nw-test2
  network: 192.168.0.0/16
  subnet: 192.168.0.0/24
  gateway: 192.168.0.1
```

**Example: Availability Zone**

```shell
$ curl http://169.254.169.254/hetzner/v1/metadata/availability-zone
hel1-dc2
```

**Example: Region**

```shell
$ curl http://169.254.169.254/hetzner/v1/metadata/region
eu-central
```

## Sorting

Some responses which return multiple items support sorting. If they do support sorting the documentation states which fields can be used for sorting. You specify sorting with the `sort` query string parameter. You can sort by multiple fields. You can set the sort direction by appending `:asc` or `:desc` to the field name. By default, ascending sorting is used.

**Example: Sorting**

```bash
https://api.hetzner.cloud/v1/actions?sort=status
https://api.hetzner.cloud/v1/actions?sort=status:asc
https://api.hetzner.cloud/v1/actions?sort=status:desc
https://api.hetzner.cloud/v1/actions?sort=status:asc&sort=command:desc
```

## Deprecation Notices

You can find all announced deprecations in our [Changelog](https://docs.hetzner.cloud/changelog).

Server

Server:https://api.hetzner.cloud/v1

## AuthenticationRequired

Selected Auth Type: APIToken

|     |
| --- |
| Bearer Token : <br>Show Password |

Client Libraries

Shell

More Select from all clients

Shell Curl

## Actions

​Copy link

Actions represent asynchronous tasks within the API, targeting one or more resources.

See [Actions](https://docs.hetzner.cloud/reference/cloud#description/actions) for more details.

Actions Operations

- [get/actions](https://docs.hetzner.cloud/reference/cloud#tag/actions/get_actions)
- [get/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/actions/get_action)

### Get multiple Actions

​Copy link

Returns multiple Action objects specified by the `id` parameter.

**Note**: This endpoint previously allowed listing all actions in the project. This functionality was deprecated in July 2023 and removed on 30 January 2025.

- Announcement: [https://docs.hetzner.cloud/changelog#2023-07-20-actions-list-endpoint-is-deprecated](https://docs.hetzner.cloud/changelog#2023-07-20-actions-list-endpoint-is-deprecated)
- Removal: [https://docs.hetzner.cloud/changelog#2025-01-30-listing-arbitrary-actions-in-the-actions-list-endpoint-is-removed](https://docs.hetzner.cloud/changelog#2025-01-30-listing-arbitrary-actions-in-the-actions-list-endpoint-is-removed)

Query Parameters

- idCopy link to id



Type: array integer\[\]

required










Filter the actions by ID. Can be used multiple times. The response will only contain
actions matching the specified IDs.


Responses

- 200


Request succeeded.





application/json

- 4xx


Request failed with a user error.





application/json

- 5xx


Request failed with a server error.





application/json


Request Example for get/actions

Go

```go
package examples

import (
	"context"
	"os"

	"github.com/hetznercloud/hcloud-go/v2/hcloud"
)

func main() {
	token := os.Getenv("HCLOUD_TOKEN")

	client := hcloud.NewClient(hcloud.WithToken(token))
	ctx := context.TODO()

	actions, err := client.Action.AllWithOpts(ctx, hcloud.ActionListOpts{ID: []int64{123, 456}})
}
```

Status: 200Status: 4xxStatus: 5xx

Show Schema

```json
{
  "actions": [\
    {\
      "id": 42,\
      "command": "start_resource",\
      "status": "running",\
      "started": "2016-01-30T23:55:00Z",\
      "finished": "2016-01-30T23:55:00Z",\
      "progress": 100,\
      "resources": [\
        {\
          "id": 42,\
          "type": "server"\
        }\
      ],\
      "error": {\
        "code": "action_failed",\
        "message": "Action failed"\
      }\
    }\
  ]
}
```

Request succeeded.

### Get an Action

​Copy link

Returns a specific Action object.

Path Parameters

- idCopy link to id



Type: integerFormat: int64
max:
9007199254740991

required



Example

42











ID of the Action.


Responses

- 200


Request succeeded.





application/json

- 4xx


Request failed with a user error.





application/json

- 5xx


Request failed with a server error.





application/json


Request Example for get/actions/ _{id}_

Go

```go
package examples

import (
	"context"
	"os"

	"github.com/hetznercloud/hcloud-go/v2/hcloud"
)

func main() {
	token := os.Getenv("HCLOUD_TOKEN")

	client := hcloud.NewClient(hcloud.WithToken(token))
	ctx := context.TODO()

	action, _, err := client.Action.GetByID(ctx, 123)
}
```

Status: 200Status: 4xxStatus: 5xx

Show Schema

```json
{
  "action": {
    "id": 42,
    "command": "start_resource",
    "status": "running",
    "started": "2016-01-30T23:55:00Z",
    "finished": "2016-01-30T23:55:00Z",
    "progress": 100,
    "resources": [\
      {\
        "id": 42,\
        "type": "server"\
      }\
    ],
    "error": {
      "code": "action_failed",
      "message": "Action failed"
    }
  }
}
```

Request succeeded.

## Servers  (Collapsed)

​Copy link

Servers are virtual machines that can be provisioned.

Servers Operations

- [get/servers](https://docs.hetzner.cloud/reference/cloud#tag/servers/list_servers)
- [post/servers](https://docs.hetzner.cloud/reference/cloud#tag/servers/create_server)
- [get/servers/{id}](https://docs.hetzner.cloud/reference/cloud#tag/servers/get_server)
- [put/servers/{id}](https://docs.hetzner.cloud/reference/cloud#tag/servers/update_server)
- [delete/servers/{id}](https://docs.hetzner.cloud/reference/cloud#tag/servers/delete_server)
- [get/servers/{id}/metrics](https://docs.hetzner.cloud/reference/cloud#tag/servers/get_server_metrics)

Show More

## Server Actions  (Collapsed)

​Copy link

Server Actions Operations

- [get/servers/actions](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/list_servers_actions)
- [get/servers/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/get_servers_action)
- [get/servers/{id}/actions](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/list_server_actions)
- [post/servers/{id}/actions/add\_to\_placement\_group](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/add_server_to_placement_group)
- [post/servers/{id}/actions/attach\_iso](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/attach_server_iso)
- [post/servers/{id}/actions/attach\_to\_network](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/attach_server_to_network)
- [post/servers/{id}/actions/change\_alias\_ips](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/change_server_alias_ips)
- [post/servers/{id}/actions/change\_dns\_ptr](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/change_server_dns_ptr)
- [post/servers/{id}/actions/change\_protection](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/change_server_protection)
- [post/servers/{id}/actions/change\_type](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/change_server_type)
- [post/servers/{id}/actions/create\_image](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/create_server_image)
- [post/servers/{id}/actions/detach\_from\_network](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/detach_server_from_network)
- [post/servers/{id}/actions/detach\_iso](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/detach_server_iso)
- [post/servers/{id}/actions/disable\_backup](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/disable_server_backup)
- [post/servers/{id}/actions/disable\_rescue](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/disable_server_rescue)
- [post/servers/{id}/actions/enable\_backup](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/enable_server_backup)
- [post/servers/{id}/actions/enable\_rescue](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/enable_server_rescue)
- [post/servers/{id}/actions/poweroff](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/poweroff_server)
- [post/servers/{id}/actions/poweron](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/poweron_server)
- [post/servers/{id}/actions/reboot](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/reboot_server)
- [post/servers/{id}/actions/rebuild](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/rebuild_server)
- [post/servers/{id}/actions/remove\_from\_placement\_group](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/remove_server_from_placement_group)
- [post/servers/{id}/actions/request\_console](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/request_server_console)
- [post/servers/{id}/actions/reset](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/reset_server)
- [post/servers/{id}/actions/reset\_password](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/reset_server_password)
- [post/servers/{id}/actions/shutdown](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/shutdown_server)
- [get/servers/{id}/actions/{action\_id}](https://docs.hetzner.cloud/reference/cloud#tag/server-actions/get_server_action)

Show More

## Server Types  (Collapsed)

​Copy link

Server types define kinds of Servers offered. Each type has an hourly and a monthly cost. You will pay whichever cost is lower for your usage of this specific Server. Costs may differ between Locations.

All prices are displayed in the currency of the project owner's account.

Server Types Operations

- [get/server\_types](https://docs.hetzner.cloud/reference/cloud#tag/server-types/list_server_types)
- [get/server\_types/{id}](https://docs.hetzner.cloud/reference/cloud#tag/server-types/get_server_type)

Show More

## Images  (Collapsed)

​Copy link

Images are blueprints for your VM disks. They can be of different types:

### System Images

Distribution Images maintained by us, e.g. “Ubuntu 20.04”

### Snapshot Images

Maintained by you, for example “Ubuntu 20.04 with my own settings”. These are billed per GB per month.

### Backup Images

Daily Backups of your Server. Will automatically be created for Servers which have backups enabled (`POST /servers/{id}/actions/enable_backup`)

Bound to exactly one Server. If you delete the Server, you also delete all backups bound to it. You may convert backup Images to snapshot Images to keep them.

These are billed at 20% of your server price for 7 backup slots.

### App Images

Prebuild images with specific software configurations, e.g. “Wordpress”. All app images are created by us.

Images Operations

- [get/images](https://docs.hetzner.cloud/reference/cloud#tag/images/list_images)
- [get/images/{id}](https://docs.hetzner.cloud/reference/cloud#tag/images/get_image)
- [put/images/{id}](https://docs.hetzner.cloud/reference/cloud#tag/images/update_image)
- [delete/images/{id}](https://docs.hetzner.cloud/reference/cloud#tag/images/delete_image)

Show More

## Image Actions  (Collapsed)

​Copy link

Image Actions Operations

- [get/images/actions](https://docs.hetzner.cloud/reference/cloud#tag/image-actions/list_images_actions)
- [get/images/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/image-actions/get_images_action)
- [get/images/{id}/actions](https://docs.hetzner.cloud/reference/cloud#tag/image-actions/list_image_actions)
- [post/images/{id}/actions/change\_protection](https://docs.hetzner.cloud/reference/cloud#tag/image-actions/change_image_protection)
- [get/images/{id}/actions/{action\_id}](https://docs.hetzner.cloud/reference/cloud#tag/image-actions/get_image_action)

Show More

## ISOs  (Collapsed)

​Copy link

ISOs are read-only Images of DVDs. While we recommend using our Image functionality to install your Servers we also provide some stock ISOs so you can install more exotic operating systems by yourself.

On request our support uploads a private ISO just for you. These are marked with type `private` and only visible in your Project.

To attach an ISO to your Server use `POST /servers/{id}/actions/attach_iso`.

ISOs Operations

- [get/isos](https://docs.hetzner.cloud/reference/cloud#tag/isos/list_isos)
- [get/isos/{id}](https://docs.hetzner.cloud/reference/cloud#tag/isos/get_iso)

Show More

## Volumes  (Collapsed)

​Copy link

A Volume is a highly-available, scalable, and SSD-based block storage for Servers.

Pricing for Volumes depends on the Volume size and Location, not the actual used storage.

Please see [Hetzner Docs](https://docs.hetzner.com/cloud/#Volumes) for more details about Volumes.

Volumes Operations

- [get/volumes](https://docs.hetzner.cloud/reference/cloud#tag/volumes/list_volumes)
- [post/volumes](https://docs.hetzner.cloud/reference/cloud#tag/volumes/create_volume)
- [get/volumes/{id}](https://docs.hetzner.cloud/reference/cloud#tag/volumes/get_volume)
- [put/volumes/{id}](https://docs.hetzner.cloud/reference/cloud#tag/volumes/update_volume)
- [delete/volumes/{id}](https://docs.hetzner.cloud/reference/cloud#tag/volumes/delete_volume)

Show More

## Volume Actions  (Collapsed)

​Copy link

Volume Actions Operations

- [get/volumes/actions](https://docs.hetzner.cloud/reference/cloud#tag/volume-actions/list_volumes_actions)
- [get/volumes/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/volume-actions/get_volumes_action)
- [get/volumes/{id}/actions](https://docs.hetzner.cloud/reference/cloud#tag/volume-actions/list_volume_actions)
- [post/volumes/{id}/actions/attach](https://docs.hetzner.cloud/reference/cloud#tag/volume-actions/attach_volume)
- [post/volumes/{id}/actions/change\_protection](https://docs.hetzner.cloud/reference/cloud#tag/volume-actions/change_volume_protection)
- [post/volumes/{id}/actions/detach](https://docs.hetzner.cloud/reference/cloud#tag/volume-actions/detach_volume)
- [post/volumes/{id}/actions/resize](https://docs.hetzner.cloud/reference/cloud#tag/volume-actions/resize_volume)
- [get/volumes/{id}/actions/{action\_id}](https://docs.hetzner.cloud/reference/cloud#tag/volume-actions/get_volume_action)

Show More

## Floating IPs  (Collapsed)

​Copy link

Floating IPs help you to create highly available setups. You can assign a Floating IP to any Server. The Server can then use this IP. You can reassign it to a different Server at any time, or you can choose to unassign the IP from Servers all together.

Floating IPs can be used globally. This means you can assign a Floating IP to a Server in one Location and later reassign it to a Server in a different Location. For optimal routing and latency Floating IPs should be used in the Location they were created in.

For Floating IPs to work with your Server, you must configure them inside your operation system.

Floating IPs of type `ipv4` use a single IPv4 address as their `ip` property. Floating IPs of type `ipv6` use a /64 network such as `fc00::/64` as their `ip` property. Any IP address within that network can be used on your host.

Floating IPs are billed on a monthly basis.

Floating IPs Operations

- [get/floating\_ips](https://docs.hetzner.cloud/reference/cloud#tag/floating-ips/list_floating_ips)
- [post/floating\_ips](https://docs.hetzner.cloud/reference/cloud#tag/floating-ips/create_floating_ip)
- [get/floating\_ips/{id}](https://docs.hetzner.cloud/reference/cloud#tag/floating-ips/get_floating_ip)
- [put/floating\_ips/{id}](https://docs.hetzner.cloud/reference/cloud#tag/floating-ips/update_floating_ip)
- [delete/floating\_ips/{id}](https://docs.hetzner.cloud/reference/cloud#tag/floating-ips/delete_floating_ip)

Show More

## Floating IP Actions  (Collapsed)

​Copy link

Floating IP Actions Operations

- [get/floating\_ips/actions](https://docs.hetzner.cloud/reference/cloud#tag/floating-ip-actions/list_floating_ips_actions)
- [get/floating\_ips/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/floating-ip-actions/get_floating_ips_action)
- [get/floating\_ips/{id}/actions](https://docs.hetzner.cloud/reference/cloud#tag/floating-ip-actions/list_floating_ip_actions)
- [post/floating\_ips/{id}/actions/assign](https://docs.hetzner.cloud/reference/cloud#tag/floating-ip-actions/assign_floating_ip)
- [post/floating\_ips/{id}/actions/change\_dns\_ptr](https://docs.hetzner.cloud/reference/cloud#tag/floating-ip-actions/change_floating_ip_dns_ptr)
- [post/floating\_ips/{id}/actions/change\_protection](https://docs.hetzner.cloud/reference/cloud#tag/floating-ip-actions/change_floating_ip_protection)
- [post/floating\_ips/{id}/actions/unassign](https://docs.hetzner.cloud/reference/cloud#tag/floating-ip-actions/unassign_floating_ip)
- [get/floating\_ips/{id}/actions/{action\_id}](https://docs.hetzner.cloud/reference/cloud#tag/floating-ip-actions/get_floating_ip_action)

Show More

## Firewalls  (Collapsed)

​Copy link

Firewalls can limit the network access to or from your resources.

- When applying a firewall with no `in` rule all inbound traffic will be dropped. The default for `in` is `DROP`.
- When applying a firewall with no `out` rule all outbound traffic will be accepted. The default for `out` is `ACCEPT`.

Firewalls Operations

- [get/firewalls](https://docs.hetzner.cloud/reference/cloud#tag/firewalls/list_firewalls)
- [post/firewalls](https://docs.hetzner.cloud/reference/cloud#tag/firewalls/create_firewall)
- [get/firewalls/{id}](https://docs.hetzner.cloud/reference/cloud#tag/firewalls/get_firewall)
- [put/firewalls/{id}](https://docs.hetzner.cloud/reference/cloud#tag/firewalls/update_firewall)
- [delete/firewalls/{id}](https://docs.hetzner.cloud/reference/cloud#tag/firewalls/delete_firewall)

Show More

## Firewall Actions  (Collapsed)

​Copy link

Firewall Actions Operations

- [get/firewalls/actions](https://docs.hetzner.cloud/reference/cloud#tag/firewall-actions/list_firewalls_actions)
- [get/firewalls/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/firewall-actions/get_firewalls_action)
- [get/firewalls/{id}/actions](https://docs.hetzner.cloud/reference/cloud#tag/firewall-actions/list_firewall_actions)
- [post/firewalls/{id}/actions/apply\_to\_resources](https://docs.hetzner.cloud/reference/cloud#tag/firewall-actions/apply_firewall_to_resources)
- [post/firewalls/{id}/actions/remove\_from\_resources](https://docs.hetzner.cloud/reference/cloud#tag/firewall-actions/remove_firewall_from_resources)
- [post/firewalls/{id}/actions/set\_rules](https://docs.hetzner.cloud/reference/cloud#tag/firewall-actions/set_firewall_rules)
- [get/firewalls/{id}/actions/{action\_id}](https://docs.hetzner.cloud/reference/cloud#tag/firewall-actions/get_firewall_action)

Show More

## Load Balancers  (Collapsed)

​Copy link

Load Balancers Operations

- [get/load\_balancers](https://docs.hetzner.cloud/reference/cloud#tag/load-balancers/list_load_balancers)
- [post/load\_balancers](https://docs.hetzner.cloud/reference/cloud#tag/load-balancers/create_load_balancer)
- [get/load\_balancers/{id}](https://docs.hetzner.cloud/reference/cloud#tag/load-balancers/get_load_balancer)
- [put/load\_balancers/{id}](https://docs.hetzner.cloud/reference/cloud#tag/load-balancers/update_load_balancer)
- [delete/load\_balancers/{id}](https://docs.hetzner.cloud/reference/cloud#tag/load-balancers/delete_load_balancer)
- [get/load\_balancers/{id}/metrics](https://docs.hetzner.cloud/reference/cloud#tag/load-balancers/get_load_balancer_metrics)

Show More

## Load Balancer Actions  (Collapsed)

​Copy link

Load Balancer Actions Operations

- [get/load\_balancers/actions](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/list_load_balancers_actions)
- [get/load\_balancers/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/get_load_balancers_action)
- [get/load\_balancers/{id}/actions](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/list_load_balancer_actions)
- [post/load\_balancers/{id}/actions/add\_service](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/add_load_balancer_service)
- [post/load\_balancers/{id}/actions/add\_target](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/add_load_balancer_target)
- [post/load\_balancers/{id}/actions/attach\_to\_network](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/attach_load_balancer_to_network)
- [post/load\_balancers/{id}/actions/change\_algorithm](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/change_load_balancer_algorithm)
- [post/load\_balancers/{id}/actions/change\_dns\_ptr](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/change_load_balancer_dns_ptr)
- [post/load\_balancers/{id}/actions/change\_protection](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/change_load_balancer_protection)
- [post/load\_balancers/{id}/actions/change\_type](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/change_load_balancer_type)
- [post/load\_balancers/{id}/actions/delete\_service](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/delete_load_balancer_service)
- [post/load\_balancers/{id}/actions/detach\_from\_network](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/detach_load_balancer_from_network)
- [post/load\_balancers/{id}/actions/disable\_public\_interface](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/disable_load_balancer_public_interface)
- [post/load\_balancers/{id}/actions/enable\_public\_interface](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/enable_load_balancer_public_interface)
- [post/load\_balancers/{id}/actions/remove\_target](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/remove_load_balancer_target)
- [post/load\_balancers/{id}/actions/update\_service](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/update_load_balancer_service)
- [get/load\_balancers/{id}/actions/{action\_id}](https://docs.hetzner.cloud/reference/cloud#tag/load-balancer-actions/get_load_balancer_action)

Show More

## Networks  (Collapsed)

​Copy link

Networks is a private networks feature. These Networks are optional and they coexist with the public network that every Server has by default.

They allow Servers to talk to each other over a dedicated network interface using private IP addresses not available publicly.

The IP addresses are allocated and managed via the API, they must conform to [RFC1918](https://tools.ietf.org/html/rfc1918#section-3) standard. IPs and network interfaces defined under Networks do not provide public internet connectivity, you will need to use the already existing public network interface for that.

Each network has a user selected `ip_range` which defines all available IP addresses which can be used for Subnets within the Network.

To assign individual IPs to Servers you will need to create Network Subnets, described below.

Currently Networks support IPv4 only.

### Subnets

Subnets divide the `ip_range` from the parent Network object into multiple Subnetworks that you can use for different specific purposes.

For each subnet you need to specify its own `ip_range` which must be contained within the parent Network’s `ip_range`. Additionally each subnet must belong to one of the available Network Zones described below. Subnets can not have overlapping IP ranges.

Currently there are three types of subnet:

- type `cloud` is used to connect cloud Resources into your Network.
- type `server` was used to connect only cloud Servers into your Network. This type is deprecated and is replaced by type cloud.
- type `vswitch` allows you to connect [Dedicated Server vSwitch](https://docs.hetzner.com/robot/dedicated-server/network/vswitch) \- and all Dedicated Servers attached to it - into your Network

Subnets of type `vswitch` must set a `vswitch_id` which is the ID of the existing vSwitch in Hetzner Robot that should be coupled.

### Network Zones

Network Zones are groups of Locations which have special high-speed network connections between them. The [Location object](https://docs.hetzner.cloud/reference/cloud#locations-get-a-location) contains the `network_zone` property each Location belongs to. Currently these network zones exist:

| Network Zone | Contains Locations |
| --- | --- |
| eu-central | nbg1, fsn1, hel1 |
| us-east | ash |
| us-west | hil |
| ap-southeast | sin |

### IP address management

When a cloud Server is attached to a network without the user specifying an IP it automatically gets an IP address assigned from a subnet of type `server` in the same network zone. If you specify the optional `ip` parameter when attaching then we will try to assign that IP. Keep in mind that the Server’s location must be covered by the Subnet’s Network Zone if you specify an IP, or that at least one Subnet with the zone covering Server’s location must exist.

A cloud Server can also have more than one IP address in a Network by specifying aliases. For details see the [attach to network action](https://docs.hetzner.cloud/reference/cloud#server-actions-attach-a-server-to-a-network).

The following IP addresses are reserved in networks and can not be used:

- the first IP of the network `ip_range` as it will be used as a default gateway for the private Network interface.
- `172.31.1.1` as it is being used as default gateway for our public Network interfaces.

### Coupling Dedicated Servers

By using subnets of type `vswitch` you can couple the Cloud Networks with an existing [Dedicated Server vSwitch](https://docs.hetzner.com/robot/dedicated-server/network/vswitch) and enable dedicated and cloud servers to
talk to each other over the Network.
In order for this to work the dedicated servers may only use IPs from the subnet and must have a special network configuration. Please refer to [FAQ](https://docs.hetzner.com/cloud/networks/connect-dedi-vswitch). vSwitch Layer 2 features are not supported.

### Routes

Networks also support the notion of routes which are automatically applied to private traffic. A route makes sure that all packets for a given `destination` IP prefix will be sent to the address specified in its `gateway`.

Networks Operations

- [get/networks](https://docs.hetzner.cloud/reference/cloud#tag/networks/list_networks)
- [post/networks](https://docs.hetzner.cloud/reference/cloud#tag/networks/create_network)
- [get/networks/{id}](https://docs.hetzner.cloud/reference/cloud#tag/networks/get_network)
- [put/networks/{id}](https://docs.hetzner.cloud/reference/cloud#tag/networks/update_network)
- [delete/networks/{id}](https://docs.hetzner.cloud/reference/cloud#tag/networks/delete_network)

Show More

## Network Actions  (Collapsed)

​Copy link

Network Actions Operations

- [get/networks/actions](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/list_networks_actions)
- [get/networks/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/get_networks_action)
- [get/networks/{id}/actions](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/list_network_actions)
- [post/networks/{id}/actions/add\_route](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/add_network_route)
- [post/networks/{id}/actions/add\_subnet](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/add_network_subnet)
- [post/networks/{id}/actions/change\_ip\_range](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/change_network_ip_range)
- [post/networks/{id}/actions/change\_protection](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/change_network_protection)
- [post/networks/{id}/actions/delete\_route](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/delete_network_route)
- [post/networks/{id}/actions/delete\_subnet](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/delete_network_subnet)
- [get/networks/{id}/actions/{action\_id}](https://docs.hetzner.cloud/reference/cloud#tag/network-actions/get_network_action)

Show More

## Zones  (Collapsed)

​Copy link

A Zone represents a [Domain Name System (DNS) zone](https://wikipedia.org/wiki/DNS_zone) managed by Hetzner authoritative nameservers.
Please see [Hetzner Docs](https://docs.hetzner.com/dns-console/dns/general/dns-overview#the-difference-between-domain-and-zone) for the difference between zones and domains.

This API supports all zone names with [well-known public suffixes](https://publicsuffix.org/) (e.g. `.de`, `.com`, `.co.uk`).
Subdomains are not supported.

### Zone Modes

This API supports two types of zone modes.

- In _primary_ mode, resource record sets ( [RRSets](https://docs.hetzner.cloud/reference/cloud#tag/zone-rrsets)) and resource records (RRs) are managed via the Cloud API or Hetzner Console.
- In _secondary_ mode, Hetzner's nameservers query [RRSets](https://docs.hetzner.cloud/reference/cloud#tag/zone-rrsets) and RRs from given primary nameservers via [AXFR](https://en.wikipedia.org/wiki/DNS_zone_transfer).

The zone mode cannot be changed, the zone must be deleted and re-created with a new mode.

### SOA Serial

For zones in primary mode, Hetzner automatically increases the `SOA` record serial number.
As convention, a `YYYYMMDDnn` format with incrementing `nn` is used.

### Zone file import

This API supports importing a zone file in BIND (RFC [1034](https://datatracker.ietf.org/doc/html/rfc1034)/ [1035](https://datatracker.ietf.org/doc/html/rfc1035)) format.

Importing a zone file is only applicable for [Zones](https://docs.hetzner.cloud/reference/cloud#tag/zones) in primary mode.

During an import:

- An `$ORIGIN` directive may be present, it must match the [Zone](https://docs.hetzner.cloud/reference/cloud#tag/zones)'s name with an ending dot
- A `$TTL` directive may be present, it is used as new default [Zone](https://docs.hetzner.cloud/reference/cloud#tag/zones) Time To Live (TTL)
- Only `IN` (internet) class records are allowed
- The assigned authoritative Hetzner nameservers must be present as `NS` records
- A `SOA` record must be present
- Comments for individual records are imported, comments on their own lines are discarded

Zone file example:

```dns
$ORIGIN	example.com.
$TTL	3600

@	IN	SOA	hydrogen.ns.hetzner.com. dns.hetzner.com. 2024010100 86400 10800 3600000 3600

@	IN	10800	NS	hydrogen.ns.hetzner.com. ; Some comment.
@	IN	10800	NS	oxygen.ns.hetzner.com.
@	IN	10800	NS	helium.ns.hetzner.de.
```

Zones Operations

- [get/zones](https://docs.hetzner.cloud/reference/cloud#tag/zones/list_zones)
- [post/zones](https://docs.hetzner.cloud/reference/cloud#tag/zones/create_zone)
- [get/zones/{id\_or\_name}](https://docs.hetzner.cloud/reference/cloud#tag/zones/get_zone)
- [put/zones/{id\_or\_name}](https://docs.hetzner.cloud/reference/cloud#tag/zones/update_zone)
- [delete/zones/{id\_or\_name}](https://docs.hetzner.cloud/reference/cloud#tag/zones/delete_zone)
- [get/zones/{id\_or\_name}/zonefile](https://docs.hetzner.cloud/reference/cloud#tag/zones/get_zone_zonefile)

Show More

## Zone Actions  (Collapsed)

​Copy link

Zone Actions Operations

- [get/zones/actions](https://docs.hetzner.cloud/reference/cloud#tag/zone-actions/list_zones_actions)
- [get/zones/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/zone-actions/get_zones_action)
- [get/zones/{id\_or\_name}/actions](https://docs.hetzner.cloud/reference/cloud#tag/zone-actions/list_zone_actions)
- [get/zones/{id\_or\_name}/actions/{action\_id}](https://docs.hetzner.cloud/reference/cloud#tag/zone-actions/get_zone_action)
- [post/zones/{id\_or\_name}/actions/change\_primary\_nameservers](https://docs.hetzner.cloud/reference/cloud#tag/zone-actions/change_zone_primary_nameservers)
- [post/zones/{id\_or\_name}/actions/change\_protection](https://docs.hetzner.cloud/reference/cloud#tag/zone-actions/change_zone_protection)
- [post/zones/{id\_or\_name}/actions/change\_ttl](https://docs.hetzner.cloud/reference/cloud#tag/zone-actions/change_zone_ttl)
- [post/zones/{id\_or\_name}/actions/import\_zonefile](https://docs.hetzner.cloud/reference/cloud#tag/zone-actions/import_zone_zonefile)

Show More

## Certificates  (Collapsed)

​Copy link

TLS/SSL Certificates prove the identity of a Server and are used to encrypt client traffic.

Certificates Operations

- [get/certificates](https://docs.hetzner.cloud/reference/cloud#tag/certificates/list_certificates)
- [post/certificates](https://docs.hetzner.cloud/reference/cloud#tag/certificates/create_certificate)
- [get/certificates/{id}](https://docs.hetzner.cloud/reference/cloud#tag/certificates/get_certificate)
- [put/certificates/{id}](https://docs.hetzner.cloud/reference/cloud#tag/certificates/update_certificate)
- [delete/certificates/{id}](https://docs.hetzner.cloud/reference/cloud#tag/certificates/delete_certificate)

Show More

## Certificate Actions  (Collapsed)

​Copy link

Certificate Actions Operations

- [get/certificates/actions](https://docs.hetzner.cloud/reference/cloud#tag/certificate-actions/list_certificates_actions)
- [get/certificates/actions/{id}](https://docs.hetzner.cloud/reference/cloud#tag/certificate-actions/get_certificates_action)
- [get/certificates/{id}/actions](https://docs.hetzner.cloud/reference/cloud#tag/certificate-actions/list_certificate_actions)
- [post/certificates/{id}/actions/retry](https://docs.hetzner.cloud/reference/cloud#tag/certificate-actions/retry_certificate)
- [get/certificates/{id}/actions/{action\_id}](https://docs.hetzner.cloud/reference/cloud#tag/certificate-actions/get_certificate_action)

Show More

## Locations  (Collapsed)

​Copy link

Datacenters are organized by Locations. Datacenters in the same Location are connected with very low latency links.

Locations Operations

- [get/locations](https://docs.hetzner.cloud/reference/cloud#tag/locations/list_locations)
- [get/locations/{id}](https://docs.hetzner.cloud/reference/cloud#tag/locations/get_location)

Show More

## Data Centers  (Collapsed)

​Copy link

Each Datacenter represents a _virtual_ Datacenter which is made up of possible many physical Datacenters where Servers are hosted.

See the [Hetzner Locations Docs](https://docs.hetzner.com/cloud/general/locations/#what-datacenters-are-there) for more details about Datacenters.

Data Centers Operations

- [get/datacenters](https://docs.hetzner.cloud/reference/cloud#tag/data-centers/list_datacenters)
- [get/datacenters/{id}](https://docs.hetzner.cloud/reference/cloud#tag/data-centers/get_datacenter)

Show More

## Pricing  (Collapsed)

​Copy link

Returns prices for resources.

Pricing Operations

- [get/pricing](https://docs.hetzner.cloud/reference/cloud#tag/pricing/get_pricing)

### Get all prices

​Copy link

Returns prices for all resources available on the platform. VAT and currency of the Project owner are used for calculations.

Both net and gross prices are included in the response.

Responses

- 200


Request succeeded.





application/json

- 4xx


Request failed with a user error.





application/json

- 5xx


Request failed with a server error.





application/json


Request Example for get/pricing

Go

```go
package examples

import (
	"context"
	"os"

	"github.com/hetznercloud/hcloud-go/v2/hcloud"
)

func main() {
	token := os.Getenv("HCLOUD_TOKEN")

	client := hcloud.NewClient(hcloud.WithToken(token))
	ctx := context.TODO()

	pricing, _, err := client.Pricing.Get(ctx)
}
```

Status: 200Status: 4xxStatus: 5xx

Show Schema

```json
{
  "pricing": {
    "currency": "EUR",
    "vat_rate": "19.00",
    "primary_ips": [\
      {\
        "type": "ipv4",\
        "prices": [\
          {\
            "location": "fsn1",\
            "price_hourly": {\
              "net": "1.0000",\
              "gross": "1.1900"\
            },\
            "price_monthly": {\
              "net": "1.0000",\
              "gross": "1.1900"\
            }\
          }\
        ]\
      }\
    ],
    "floating_ips": [\
      {\
        "type": "ipv4",\
        "prices": [\
          {\
            "location": "fsn1",\
            "price_monthly": {\
              "net": "1.0000",\
              "gross": "1.1900"\
            }\
          }\
        ]\
      }\
    ],
    "image": {
      "price_per_gb_month": {
        "net": "1.0000",
        "gross": "1.1900"
      }
    },
    "volume": {
      "price_per_gb_month": {
        "net": "1.0000",
        "gross": "1.1900"
      }
    },
    "server_backup": {
      "percentage": "20.00"
    },
    "server_types": [\
      {\
        "id": 104,\
        "name": "cpx22",\
        "prices": [\
          {\
            "location": "fsn1",\
            "price_hourly": {\
              "net": "1.0000",\
              "gross": "1.1900"\
            },\
            "price_monthly": {\
              "net": "1.0000",\
              "gross": "1.1900"\
            },\
            "included_traffic": 654321,\
            "price_per_tb_traffic": {\
              "net": "1.0000",\
              "gross": "1.1900"\
            }\
          }\
        ]\
      }\
    ],
    "load_balancer_types": [\
      {\
        "id": 1,\
        "name": "lb11",\
        "prices": [\
          {\
            "location": "fsn1",\
            "price_hourly": {\
              "net": "1.0000",\
              "gross": "1.1900"\
            },\
            "price_monthly": {\
              "net": "1.0000",\
              "gross": "1.1900"\
            },\
            "included_traffic": 654321,\
            "price_per_tb_traffic": {\
              "net": "1.0000",\
              "gross": "1.1900"\
            }\
          }\
        ]\
      }\
    ]
  }
}
```

Request succeeded.

Show sidebar

Show search

- Close Group

Actions










  - [Get multiple Actions\\
    \\
    HTTP Method:\\
    GET](https://docs.hetzner.cloud/workspace/default/request/F-eNQKl3wXzwHWai3plLt)

  - [Get an Action\\
    \\
    HTTP Method:\\
    GET](https://docs.hetzner.cloud/workspace/default/request/xiZgr-KdejuAi3JxCFfyn)


- Open Group

Certificates

- Open Group

Certificate Actions

- Open Group

Data Centers

- Open Group

Firewalls

- Open Group

Firewall Actions

- Open Group

Floating IPs

- Open Group

Floating IP Actions

- Open Group

Images

- Open Group

Image Actions

- Open Group

ISOs

- Open Group

Load Balancers

- Open Group

Load Balancer Actions

- Open Group

Load Balancer Types

- Open Group

Locations

- Open Group

Networks

- Open Group

Network Actions

- Open Group

Placement Groups

- Open Group

Pricing

- Open Group

Primary IPs

- Open Group

Primary IP Actions

- Open Group

Servers

- Open Group

Server Actions

- Open Group

Server Types

- Open Group

SSH Keys

- Open Group

Volumes

- Open Group

Volume Actions

- Open Group

Zones

- Open Group

Zone Actions

- Open Group

Zone RRSets

- Open Group

Zone RRSet Actions


GET

Server: https://api.hetzner.cloud/v1

/actions

Send Send get request to https://api.hetzner.cloud/v1/actions

Close ClientClose Client

Get multiple Actions

AllAuthCookiesHeadersQuery

All

## AuthenticationRequired

Selected Auth Type: APIToken

|     |
| --- |
| Bearer Token : <br>Show Password |

## Variables

## Cookies

| Cookie Enabled | Cookie Key | Cookie Value |
| --- | --- | --- |
|  | Key | Value |

## Headers

Clear All Headers

| Header Enabled | Header Key | Header Value |
| --- | --- | --- |
|  | Accept | \*/\* |
|  | Key | Value |

## Query Parameters

| Parameter Enabled | Parameter Key | Parameter Value |
| --- | --- | --- |
|  | id<br>Required | Value |

## Code Snippet (Collapsed)

Go

Response

AllCookiesHeadersBody

All

[Powered By Scalar.com](https://www.scalar.com/)

.,,uod8B8bou,,. ..,uod8BBBBBBBBBBBBBBBBRPFT?l!i:. \|\|\|\|\|\|\|\|\|\|\|\|\|\|!?TFPRBBBBBBBBBBBBBBB8m=, \|\|\|\| '""^^!!\|\|\|\|\|\|\|\|\|\|TFPRBBBVT!:...! \|\|\|\| '""^^!!\|\|\|\|\|?!:.......! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\|, \|\|\|\|.........\` \|\|\|\|\|!!-.\_ \|\|\|\|.......;. ':!\|\|\|\|\|\|\|\|\|!!-.\_ \|\|\|\|.....bBBBBWdou,. bBBBBB86foi!\|\|\|\|\|\|\|!!-..:\|\|\|!..bBBBBBBBBBBBBBBY! ::!?TFPRBBBBBB86foi!\|\|\|\|\|\|\|\|!!bBBBBBBBBBBBBBBY..! :::::::::!?TFPRBBBBBB86ftiaabBBBBBBBBBBBBBBY....! :::;\`"^!:;::::::!?TFPRBBBBBBBBBBBBBBBBBBBY......! ;::::::...''^::::::::::!?TFPRBBBBBBBBBBY........! .ob86foi;::::::::::::::::::::::::!?TFPRBY..........\` .b888888888886foi;:::::::::::::::::::::::..........\` .b888888888888888888886foi;::::::::::::::::...........b888888888888888888888888888886foi;:::::::::......\`!Tf998888888888888888888888888888888886foi;:::....\` '"^!\|Tf9988888888888888888888888888888888!::..\` '"^!\|Tf998888888888888888888888889!! '\` '"^!\|Tf9988888888888888888!!\` iBBbo. '"^!\|Tf998888888889!\` WBBBBbo. '"^!\|Tf9989!\` YBBBP^' '"^!\` \`

Send Request

ctrlControl

↵Enter