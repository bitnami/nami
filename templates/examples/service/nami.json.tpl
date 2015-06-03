{
  "id": "{{id}}",
  "name": "{{name}}",
  "extends": ["Service"],
  "revision": "{{revision}}",
  "author": {"name": "Your Company", "url": "https://example.com"},
  "version": "{{version}}",
  "owner": {"username": "daemon"},
  "properties": {
    "port": {"default": 3456, "description": "Port"},
    "dummyparameter": {"default": "Dummy value", "description": "Dummy Parameter"}
  },
  "exports": {
    "helloworld" : {"arguments": ["name"], "options": {"shout": false}}
  },
  "service": {
    "pidFile": "tmp/{{name}}.pid",
    "ports": ["\{{$app.port}}"],
    "logFile": "logs/{{name}}.log",
    "socketFile": "tmp/{{name}}.sock",
    "start": {
      "timeout": 10,
      "command": "echo 'Service {{name}} started!' && sleep 1000  & echo $! > \{{$app.service.pidFile}}"
    }
  },
  "installation": {
    "prefix": "{{name}}",
    "packaging": {
      "components": [{
        "name": "default",
        "owner": "root",
        "folders": [{
          "name": "test",
          "files": [{"origin": ["files/*", "scripts"]}],
          "tags": [{"name": "data", "pattern": "*/data"}]
        }],
        "tagOperations": {
          "data": [{
            "setPermissions": {"owner": "daemon", "permissions": "0777"}
          }]
        }
      }]
    }
  }
}
