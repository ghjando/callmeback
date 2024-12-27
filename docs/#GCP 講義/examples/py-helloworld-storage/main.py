import os
import json
#import base64
from flask import Flask, request
from google.cloud import storage

app = Flask(__name__)

@app.route("/")
def hello_world():
    """Example Hello World route."""
    name = os.environ.get("NAME", "World")
    return f"Hello {name}!"

def download_blob_into_memory(bucket_name, blob_name):
    """Downloads a blob into memory."""
    # The ID of your GCS bucket
    # bucket_name = "your-bucket-name"

    # The ID of your GCS object
    # blob_name = "storage-object-name"

    storage_client = storage.Client()

    bucket = storage_client.bucket(bucket_name)

    # Construct a client side representation of a blob.
    # Note `Bucket.blob` differs from `Bucket.get_blob` as it doesn't retrieve
    # any content from Google Cloud Storage. As we don't need additional data,
    # using `Bucket.blob` is preferred here.
    blob = bucket.blob(blob_name)
    contents = blob.download_as_bytes()

    print(
        "Downloaded storage object {} from bucket {} as the following bytes object: {}.".format(
            blob_name, bucket_name, contents.decode("utf-8")
        )
    )

@app.route("/storage", methods=['POST'])
def hello_storage():
    """Receive and parse Pub/Sub messages containing Cloud Storage event data."""
    event_data = request.get_json()
    if not event_data:
        msg = "no Pub/Sub message received"
        print(f"error: {msg}")
        return f"Bad Request: {msg}", 400

    if not isinstance(event_data, dict):
        msg = "invalid Pub/Sub message format"
        print(f"error: {msg}")
        return f"Bad Request: {msg}", 400

    print("event_data:", event_data)

    # Validate the message is a Cloud Storage event.
    if not event_data["name"] or not event_data["bucket"]:
        msg = (
            "Invalid Cloud Storage notification: "
            "expected name and bucket properties"
        )
        print(f"error: {msg}")
        return f"Bad Request: {msg}", 400

    try:
        download_blob_into_memory(event_data['bucket'], event_data['name'])
        return ("", 204)    # success (no content and need not refresh)

    except Exception as e:
        print(f"error: {e}")
        return ("", 500)

    return ("", 500)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))

