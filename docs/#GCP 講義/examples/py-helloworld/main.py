import os
from flask import Flask, request
#from cloudevents.http import from_http

app = Flask(__name__)

@app.route("/")
def hello_world():
    name = os.environ.get("NAME", "World")
    print(f"Hello {name}")
    return f"Hello {name}!"

@app.route("/storage", methods=['POST'])
def hello_world_storage():
    event = request.get_json()
    print(f"Hello from storage:", event)
    return f"Hello storage!"

@app.route("/user")
def hello_world_user():
    print(f"Hello user!")
    return f"Hello user!"

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))

