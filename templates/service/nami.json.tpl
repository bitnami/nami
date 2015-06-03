{
  "id": "{{id}}",
  "name": "{{name}}",
  "extends": ["Service"],
  "revision": "{{revision}}",
  "author": {"name": "Your Company", "url": "https://example.com"},
  "version": "{{version}}",
  "owner": {"username": "daemon"},
  "properties": {
    "port": {"default": 3456, "description": "Port"}
  },
  "exports": {
  },
  "service": {
    "pidFile": "\{{$app.tmpDir}}/{{name}}.pid",
    "ports": ["\{{$app.port}}"],
    "logFile": "\{{$app.logsDir}}/{{name}}.log",
    "socketFile": "\{{$app.tmpDir}}/{{name}}.sock",
    "start": {
      "timeout": 10,
      "command": "echo 'Service {{name}} started!' && sleep 1000  & echo $! > \{{$app.pidFile}}"
    }
  },
  "installation": {}
}
